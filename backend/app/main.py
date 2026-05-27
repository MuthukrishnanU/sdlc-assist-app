from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import CodeGenerationRequest, CodeGenerationResponse, SimulationRequest, SimulationResponse, GitHubPushRequest
from .generator import generator
import uvicorn
from datetime import datetime
import csv
import io
import base64
import httpx
import json
import os
import time
from pymongo import MongoClient
from dotenv import load_dotenv
import dns.resolver

# Configure dnspython to use public DNS servers (bypasses unstable local router DNS)
try:
    dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
    dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4', '1.1.1.1']
except Exception:
    pass

# Reload environment variables on file change
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

app = FastAPI(title="SDLC Assist API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "SDLC Assist API is running"}

@app.get("/metadata")
async def get_metadata():
    try:
        if not MONGODB_URI:
            raise HTTPException(status_code=500, detail="MONGODB_URI is not set in environment variables")
        client = MongoClient(MONGODB_URI)
        db = client["bankingSdlcDB"]
        collections = db.list_collection_names()
        
        metadata = {}
        for col_name in collections:
            if col_name.startswith("system."):
                continue
            doc = db[col_name].find_one()
            if doc:
                # Extract fields and ignore MongoDB internal '_id' field
                fields = [key for key in doc.keys() if key != '_id']
                metadata[col_name] = fields
            else:
                metadata[col_name] = []
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def filter_records_by_logic(records: list, logic: str) -> tuple:
    if not logic or not records:
        return records, 0, 0
    try:
        prompt = f"""
        You are a translation assistant that converts natural language data filtering logic into a safe Python boolean expression.
        
        Variables available (row keys): {list(records[0].keys())}
        
        Here are some sample rows from the dataset to help you see the format and typical values of fields:
        {json.dumps(records[:5], default=str)}
        
        Logic to convert: "{logic}"
        
        Rules for the Python expression:
        1. It must evaluate to a boolean-like value (True/False or truthy/falsy) for a dict named `row`.
        2. Access fields using `row.get('field_name')`.
        3. Do not use any imports, classes, functions, or built-in functions (like eval, exec, open, bool, str).
        4. Handle case insensitivity where appropriate (e.g. convert string values to lowercase if the user query is case-insensitive, using `.lower()` on strings if they are not None).
        5. Handle None/null checks safely (e.g., `row.get('loan_type') and 'auto' in row.get('loan_type').lower()`).
        6. Return a JSON object with exactly one key "expression" containing the string of the Python expression.
        
        Example Logic: "loan status is Active and loan type is auto loan"
        Example JSON:
        {{
          "expression": "row.get('loan_status') and row.get('loan_status').lower() == 'active' and row.get('loan_type') and 'auto' in row.get('loan_type').lower()"
        }}
        """
        
        response = await generator.client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        expression_str = result.get("expression")
        if not expression_str:
            return records, 0, 0
            
        compiled_expr = compile(expression_str, "<string>", "eval")
        
        filtered = []
        for r in records:
            try:
                # Safely evaluate without builtins
                is_match = eval(compiled_expr, {"__builtins__": {}}, {"row": r})
                if bool(is_match):
                    filtered.append(r)
            except Exception as e:
                # Ignore row evaluation errors
                pass
                
        p_tokens = response.usage.prompt_tokens if response.usage else 0
        c_tokens = response.usage.completion_tokens if response.usage else 0
        return filtered, p_tokens, c_tokens
    except Exception as e:
        print(f"Error in logic-aware filtering: {e}")
        return records, 0, 0


@app.post("/simulate", response_model=SimulationResponse)
async def simulate_data(request: SimulationRequest):
    start_time = time.time()
    records_processed = 0
    try:
        if not MONGODB_URI:
            raise HTTPException(status_code=500, detail="MONGODB_URI is not set in environment variables")
        client = MongoClient(MONGODB_URI)
        db = client["bankingSdlcDB"]

        # Fetch schemas for selected tables to help LLM optimize the query
        schemas = {}
        for table in request.tables:
            meta_doc = db['semanticMetaStore'].find_one({"collection_name": table})
            if meta_doc:
                schemas[table] = [
                    {
                        "field_name": f["field_name"],
                        "friendly_name": f["friendly_name"],
                        "description": f["description"],
                        "data_type": f["data_type"]
                    }
                    for f in meta_doc.get("fields", [])
                ]
            else:
                sample = db[table].find_one()
                if sample:
                    schemas[table] = [{"field_name": k, "friendly_name": k.replace('_', ' ').title(), "description": f"Field '{k}' in {table}", "data_type": "string"} for k in sample.keys() if k != '_id']
                else:
                    schemas[table] = []

        driving_table = request.tables[0] if request.tables else None
        mongo_filter = {}
        sim_prompt_tokens = 0
        sim_completion_tokens = 0

        if request.logic and request.tables:
            try:
                opt_prompt = f"""
                You are a database query optimizer.
                Analyze the user's natural language logic and the list of selected tables and their fields.
                Determine which table should be the primary driving table to query first from MongoDB to retrieve the most relevant subset of data, and generate a MongoDB query filter for that table.
                
                Selected Tables: {request.tables}
                
                Table Schemas (fields and descriptions):
                {json.dumps(schemas, indent=2)}
                
                User Logic: "{request.logic}"
                
                Rules:
                1. The driving table must be one of the selected tables: {request.tables}.
                2. If the logic contains filtering conditions on a specific table's fields (e.g., "loan type is Home" filters loanInfo; "KYC status is Verified" filters customerDetails), select that table as the driving table.
                3. If multiple tables have filters, select the one that seems most restrictive (filters out the most records, e.g. loans or transactions). If none have filters, default to the first table in the selected list: {request.tables[0]}.
                4. Generate a valid MongoDB query filter (JSON object) to apply to the driving table to retrieve only the records matching the logic's filters for that table.
                5. The MongoDB query filter must only use fields belonging to the selected driving table.
                6. Use standard MongoDB query operators if needed (like $eq, $gt, $in, $regex, etc.).
                7. Reference the fields' descriptions which list typical values (e.g., loan_type description says "Type of loan (Home, Personal, Auto)", so use "Home" for Home Loan, "Personal" for Personal Loan, and "Auto" for Auto Loan). Keep the filter exact if it matches schema descriptions, otherwise use case-insensitive regex.
                8. Return a JSON object with exactly these keys:
                   - "driving_table": (string, name of the chosen driving table)
                   - "mongo_filter": (object, the MongoDB query filter for the driving table. Return {{}} if no filters apply to this table)
                """
                
                opt_response = await generator.client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": opt_prompt}],
                    response_format={"type": "json_object"}
                )
                sim_prompt_tokens += opt_response.usage.prompt_tokens if opt_response.usage else 0
                sim_completion_tokens += opt_response.usage.completion_tokens if opt_response.usage else 0
                
                opt_data = json.loads(opt_response.choices[0].message.content)
                candidate_table = opt_data.get("driving_table")
                if candidate_table in request.tables:
                    driving_table = candidate_table
                mongo_filter = opt_data.get("mongo_filter") or {}
            except Exception as e:
                print(f"Error determining driving table and filter: {e}")

        # Fetch and clean data from selected collections
        data_by_table = {}

        # 1. Fetch driving table records
        if driving_table:
            cursor = db[driving_table].find(mongo_filter).limit(request.sample_data_size)
            primary_records = []
            for doc in cursor:
                records_processed += 1
                doc_cleaned = {}
                for k, v in doc.items():
                    if k == '_id':
                        continue
                    if isinstance(v, datetime):
                        doc_cleaned[k] = v.strftime("%Y-%m-%d %H:%M:%S")
                    else:
                        doc_cleaned[k] = v
                primary_records.append(doc_cleaned)
            data_by_table[driving_table] = primary_records

            # Collect join keys from the driving table to filter secondary tables
            join_keys_to_fetch = {}
            for col in ["customer_id", "account_id"]:
                vals = [r[col] for r in primary_records if col in r and r[col] is not None]
                if vals:
                    join_keys_to_fetch[col] = list(set(vals))

            # 2. Fetch secondary tables specifically matching driving table keys to ensure high join rate
            for table in request.tables:
                if table == driving_table:
                    continue
                query = {}
                meta_doc = db['semanticMetaStore'].find_one({"collection_name": table})
                fields_in_table = []
                if meta_doc:
                    fields_in_table = [f["field_name"] for f in meta_doc.get("fields", [])]
                
                # If metadata didn't have it, try a quick find_one lookup
                if not fields_in_table:
                    sample_doc = db[table].find_one()
                    if sample_doc:
                        fields_in_table = list(sample_doc.keys())
                
                filter_key = None
                for key in ["customer_id", "account_id"]:
                    if key in join_keys_to_fetch and key in fields_in_table:
                        filter_key = key
                        break
                        
                if filter_key:
                    query = {filter_key: {"$in": join_keys_to_fetch[filter_key]}}
                
                cursor = db[table].find(query).limit(request.sample_data_size)
                records = []
                for doc in cursor:
                    records_processed += 1
                    doc_cleaned = {}
                    for k, v in doc.items():
                        if k == '_id':
                            continue
                        if isinstance(v, datetime):
                            doc_cleaned[k] = v.strftime("%Y-%m-%d %H:%M:%S")
                        else:
                            doc_cleaned[k] = v
                    records.append(doc_cleaned)
                data_by_table[table] = records

        if not request.tables:
            return SimulationResponse(dataframe=[], column_details={})

        # Start with driving table
        joined_records = data_by_table.get(driving_table, [])

        # Dynamic join logic
        for table in request.tables:
            if table == driving_table:
                continue
            other_records = data_by_table.get(table, [])
            if not joined_records or not other_records:
                continue
            
            # Find common keys
            common_keys = set(joined_records[0].keys()).intersection(other_records[0].keys())
            join_key = None
            if 'customer_id' in common_keys:
                join_key = 'customer_id'
            elif 'account_id' in common_keys:
                join_key = 'account_id'
            elif common_keys:
                join_key = list(common_keys)[0]

            if join_key:
                lookup = {}
                for r in other_records:
                    k_val = r.get(join_key)
                    if k_val:
                        if k_val not in lookup:
                            lookup[k_val] = r
                
                merged_records = []
                for r in joined_records:
                    k_val = r.get(join_key)
                    matching = lookup.get(k_val, {})
                    merged_records.append({**r, **matching})
                joined_records = merged_records

        # Precalculate customer UPI transaction counts and total transaction counts
        customer_upi_counts = {}
        customer_total_tx_counts = {}
        tx_records = data_by_table.get("transactionsInfo", [])
        if not tx_records and MONGODB_URI:
            try:
                # Fallback if transactionsInfo was not explicitly selected but present in DB
                tx_records = list(db["transactionsInfo"].find({}, {"customer_id": 1, "channel": 1}))
            except Exception:
                pass
        
        for tx in tx_records:
            c_id = tx.get("customer_id")
            if c_id:
                customer_total_tx_counts[c_id] = customer_total_tx_counts.get(c_id, 0) + 1
                if tx.get("channel") == "UPI":
                    customer_upi_counts[c_id] = customer_upi_counts.get(c_id, 0) + 1

        for r in joined_records:
            c_id = r.get("customer_id")
            if c_id:
                r["_customer_upi_count"] = customer_upi_counts.get(c_id, 0)
                r["_customer_transaction_count"] = customer_total_tx_counts.get(c_id, 0)
            else:
                r["_customer_upi_count"] = 0
                r["_customer_transaction_count"] = 0

        computed_columns_def = []

        # Analyze logic for computed columns first
        if request.logic and joined_records:
            try:
                comp_prompt = f"""
                You are a Data Engineering logic compiler.
                Analyze the user's business logic query and identify any NEW computed/derived/flag columns (like credit score buckets, amount buckets, customer transaction inclinations, etc.) that the user wants to add to the output dataset.
                
                Logic: "{request.logic}"
                
                Variables available in `row` (keys): {list(joined_records[0].keys())}
                
                Also available as helper keys in `row`:
                - `_customer_upi_count`: Total count of UPI transactions for this customer.
                - `_customer_transaction_count`: Total count of transactions for this customer.
                
                Rules for Python value expressions:
                1. Access fields using `row.get('field_name')`.
                2. Ensure safe default fallbacks to avoid NoneType comparison errors (e.g., `(row.get('credit_score') or 0) < 650`).
                3. Do not use imports, classes, functions, or built-in functions.
                4. Return a JSON object with a key "computed_columns" which is a list of objects containing:
                   - "column_name": (string, snake_case name of the column, e.g. "credit_score_bucket")
                   - "friendly_name": (string, friendly display name, e.g. "Credit Score Bucket")
                   - "description": (string, brief explanation of the bucket ranges)
                   - "expression": (string, safe Python inline expression for evaluation, e.g., "'Risky' if (row.get('credit_score') or 0) < 650 else 'Average' if (row.get('credit_score') or 0) <= 750 else 'Good' if (row.get('credit_score') or 0) <= 850 else 'Excellent'")
                
                If no computed columns are requested, return an empty list for "computed_columns".
                """
                response = await generator.client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": comp_prompt}],
                    response_format={"type": "json_object"}
                )
                sim_prompt_tokens += response.usage.prompt_tokens if response.usage else 0
                sim_completion_tokens += response.usage.completion_tokens if response.usage else 0
                
                comp_data = json.loads(response.choices[0].message.content)
                computed_columns_def = comp_data.get("computed_columns", [])
            except Exception as e:
                print(f"Error extracting computed columns: {e}")

        # Apply logic filtering via LLM if provided
        if request.logic and joined_records:
            joined_records, filter_p_tokens, filter_c_tokens = await filter_records_by_logic(joined_records, request.logic)
            sim_prompt_tokens += filter_p_tokens
            sim_completion_tokens += filter_c_tokens

        # Evaluate computed columns for the filtered records
        for col_def in computed_columns_def:
            col_name = col_def["column_name"]
            expr_str = col_def["expression"]
            try:
                compiled_val_expr = compile(expr_str, "<string>", "eval")
                for r in joined_records:
                    try:
                        val = eval(compiled_val_expr, {"__builtins__": {}}, {"row": r})
                        r[col_name] = val
                    except Exception as e:
                        r[col_name] = None
            except Exception as e:
                print(f"Error compiling computed column expression for {col_name}: {e}")

        # Retrieve column details from semanticMetaStore
        column_details = {}
        for table in request.tables:
            meta_doc = db['semanticMetaStore'].find_one({"collection_name": table})
            if meta_doc:
                for field in meta_doc.get("fields", []):
                    f_name = field["field_name"]
                    if f_name in request.columns:
                        column_details[f_name] = {
                            "friendly_name": field["friendly_name"],
                            "description": field["description"],
                            "data_type": field["data_type"],
                            "role": field["role"],
                            "classification": field["classification"],
                            "lineage": field.get("lineage")
                        }

        # Add computed columns to column_details
        for col_def in computed_columns_def:
            col_name = col_def["column_name"]
            column_details[col_name] = {
                "friendly_name": col_def["friendly_name"],
                "description": col_def["description"],
                "data_type": "string",
                "role": "dimension",
                "classification": "public",
                "lineage": {
                    "source_tables": request.tables,
                    "source_columns": [c for c in request.columns if c in col_def["expression"]],
                    "transformation": f"Computed logic: {col_def['description']}"
                }
            }

        # Handle columns not explicitly detailed in meta store (fallback)
        for col in request.columns:
            if col not in column_details:
                column_details[col] = {
                    "friendly_name": col.replace('_', ' ').title(),
                    "description": f"Attribute representing '{col}'.",
                    "data_type": "string",
                    "role": "dimension",
                    "classification": "public",
                    "lineage": {
                        "source_tables": request.tables[:1] if request.tables else ["unknown"],
                        "source_columns": [col],
                        "transformation": "Direct ingest (derived dataset lookup)"
                    }
                }

        # Select only the final columns (standard + computed)
        final_dataframe = []
        all_display_cols = list(column_details.keys())
        for r in joined_records:
            filtered_row = {col: r.get(col) for col in all_display_cols}
            # Fill missing with None
            for col in all_display_cols:
                if col not in filtered_row:
                    filtered_row[col] = None
            final_dataframe.append(filtered_row)

        # Calculate real Data Quality insights from the queried dataset
        row_count = len(final_dataframe)
        null_count = 0
        empty_strings_count = 0
        for r in final_dataframe:
            for val in r.values():
                if val is None or val == "":
                    null_count += 1
                if isinstance(val, str) and val.strip() == "":
                    empty_strings_count += 1

        row_strings = [json.dumps(row, sort_keys=True) for row in final_dataframe]
        duplicate_count = len(row_strings) - len(set(row_strings))
        distinct_rows_count = len(set(row_strings))

        # Find primary numeric column (prefer measures)
        numeric_col = None
        for col, details in column_details.items():
            if details["role"] == "measure" and details["data_type"] in ("integer", "double", "float"):
                numeric_col = col
                break
        if not numeric_col:
            for col, details in column_details.items():
                if details["data_type"] in ("integer", "double", "float"):
                    numeric_col = col
                    break

        minimum = None
        maximum = None
        average = None

        if numeric_col:
            numeric_values = []
            for r in final_dataframe:
                val = r.get(numeric_col)
                if val is not None:
                    try:
                        numeric_values.append(float(val))
                    except (ValueError, TypeError):
                        pass
            if numeric_values:
                minimum = min(numeric_values)
                maximum = max(numeric_values)
                average = round(sum(numeric_values) / len(numeric_values), 2)

        dq_insights = {
            "row_count": row_count,
            "null_values": null_count,
            "duplicate_rows": duplicate_count,
            "minimum": minimum,
            "maximum": maximum,
            "average": average,
            "distinct_values": distinct_rows_count,
            "empty_strings": empty_strings_count
        }

        # Calculate DQ insights for each individual selected table
        table_dq_insights = {}
        for table in request.tables:
            table_records = data_by_table.get(table, [])
            
            # Retrieve fields from semanticMetaStore to find the numeric columns
            meta_doc = db['semanticMetaStore'].find_one({"collection_name": table})
            meta_fields = meta_doc.get("fields", []) if meta_doc else []
            
            # Calculate row count
            t_row_count = len(table_records)
            
            # Calculate null count and empty strings
            t_null_count = 0
            t_empty_strings_count = 0
            for r in table_records:
                for val in r.values():
                    if val is None or val == "":
                        t_null_count += 1
                    if isinstance(val, str) and val.strip() == "":
                        t_empty_strings_count += 1
                        
            # Calculate duplicates
            t_row_strings = [json.dumps(row, sort_keys=True) for row in table_records]
            t_duplicate_count = len(t_row_strings) - len(set(t_row_strings))
            t_distinct_rows_count = len(set(t_row_strings))
            
            # Find primary numeric column for this table
            t_numeric_col = None
            for field in meta_fields:
                if field.get("role") == "measure" and field.get("data_type") in ("integer", "double", "float"):
                    t_numeric_col = field.get("field_name")
                    break
            if not t_numeric_col:
                for field in meta_fields:
                    if field.get("data_type") in ("integer", "double", "float"):
                        t_numeric_col = field.get("field_name")
                        break
                        
            t_minimum = None
            t_maximum = None
            t_average = None
            
            if t_numeric_col:
                t_numeric_values = []
                for r in table_records:
                    val = r.get(t_numeric_col)
                    if val is not None:
                        try:
                            t_numeric_values.append(float(val))
                        except (ValueError, TypeError):
                            pass
                if t_numeric_values:
                    t_minimum = min(t_numeric_values)
                    t_maximum = max(t_numeric_values)
                    t_average = round(sum(t_numeric_values) / len(t_numeric_values), 2)
                    
            table_dq_insights[table] = {
                "row_count": t_row_count,
                "null_values": t_null_count,
                "duplicate_rows": t_duplicate_count,
                "minimum": t_minimum,
                "maximum": t_maximum,
                "average": t_average,
                "distinct_values": t_distinct_rows_count,
                "empty_strings": t_empty_strings_count
            }

        # Calculate columnwise and tablewise DQI and primary keys
        column_dq_insights = {}
        primary_keys = {}

        # Get primary key metadata
        for table in request.tables:
            meta_doc = db['semanticMetaStore'].find_one({"collection_name": table})
            pk = "customer_id"  # default fallback
            if meta_doc and "primary_key" in meta_doc:
                pk = meta_doc["primary_key"]
            primary_keys[table] = pk

        if request.tables:
            primary_keys["Output Table"] = primary_keys.get(request.tables[0], "customer_id")

        # Function to calculate DQ insights for a single column in a dataset
        def calculate_col_dq(records: list, col: str) -> dict:
            row_count = len(records)
            null_count = sum(1 for r in records if r.get(col) is None or r.get(col) == "")
            empty_string_count = sum(1 for r in records if isinstance(r.get(col), str) and r.get(col).strip() == "")
            
            non_null_vals = [r.get(col) for r in records if r.get(col) is not None and r.get(col) != ""]
            duplicate_count = len(non_null_vals) - len(set(non_null_vals))
            distinct_values_count = len(set(non_null_vals))
            
            numeric_values = []
            for val in non_null_vals:
                try:
                    numeric_values.append(float(val))
                except (ValueError, TypeError):
                    pass
            
            minimum = min(numeric_values) if numeric_values else None
            maximum = max(numeric_values) if numeric_values else None
            average = round(sum(numeric_values) / len(numeric_values), 2) if numeric_values else None
            
            return {
                "row_count": row_count,
                "null_values": null_count,
                "duplicate_rows": duplicate_count,
                "minimum": minimum,
                "maximum": maximum,
                "average": average,
                "distinct_values": distinct_values_count,
                "empty_strings": empty_string_count
            }

        # Calculate for Output Table columns
        output_col_insights = {}
        for col in request.columns:
            output_col_insights[col] = calculate_col_dq(final_dataframe, col)
        column_dq_insights["Output Table"] = output_col_insights

        # Calculate for each selected table columns
        for table in request.tables:
            table_records = data_by_table.get(table, [])
            table_col_insights = {}
            if table_records:
                # Find all fields present in the table records
                cols = list(table_records[0].keys())
                for col in cols:
                    table_col_insights[col] = calculate_col_dq(table_records, col)
            column_dq_insights[table] = table_col_insights

        # Calculate execution time in milliseconds
        execution_time_ms = int((time.time() - start_time) * 1000)
        execution_time_ms = max(1, execution_time_ms)
        
        # Resolve query/code format details
        fmt = (request.format or "SQL").upper()
        
        # Software requirements and steps based on execution language
        if "PYSPARK" in fmt:
            software_reqs = ["pyspark (Python package)", "Java Development Kit (JDK 8 or 11)", "Apache Spark 3.x", "MongoDB Spark Connector"]
            exec_steps = [
                "Install Java (JDK 8 or 11) and configure JAVA_HOME environment variable.",
                "Install PySpark using pip: pip install pyspark dnspython",
                "Save the generated PySpark script to a local python file (e.g. process_data.py).",
                "Execute the script via command line: python process_data.py (or submit via spark-submit)."
            ]
            special_inst = "Make sure the Spark Session configuration is loaded with appropriate MongoDB jar packages if fetching live data from Atlas."
        elif "MONGODB" in fmt or "NOSQL" in fmt or "PYTHON" in fmt:
            software_reqs = ["pymongo (Python package)", "dnspython (Python package)", "Python 3.8+"]
            exec_steps = [
                "Set up a virtual environment and run command: pip install pymongo dnspython",
                "Create a local environment file (.env) with your MONGODB_URI set.",
                "Save the generated script into query.py.",
                "Run the query script: python query.py"
            ]
            special_inst = "Check that your local IP address is whitelisted in your MongoDB Atlas cluster Network Access page."
        else: # SQL
            software_reqs = ["DuckDB, SQLite, or PostgreSQL server", "Database GUI client (DBeaver, pgAdmin or MongoDB Compass)"]
            exec_steps = [
                "Connect to your database engine (PostgreSQL, SQLite, etc.) using your database credentials.",
                "Open a new SQL Editor tab.",
                "Copy and paste the generated SQL code block.",
                "Run/execute the query statement to fetch records."
            ]
            special_inst = "Ensure that the table schemas, names, and column bindings are loaded and match your target relational datastore."

        # Compute cost estimation
        if request.logic:
            execution_cost = "Estimated cost: ~$0.0065 USD (OpenAI API GPT-4o compilation request: ~1k prompt tokens + ~100 completion tokens; local Python evaluation compute is free)."
        else:
            execution_cost = "Estimated cost: Negligible / $0.00 USD (runs locally using client-side execution; MongoDB read operations are covered by Atlas M0 Free Tier)."

        # Fallback query text if not provided
        query_text = request.generated_code or f"-- Code not generated yet. Select columns and click Generate first."

        execution_explanation = {
            "query": query_text,
            "execution_time_ms": execution_time_ms,
            "records_processed": records_processed,
            "software_requirements": software_reqs,
            "execution_steps": exec_steps,
            "special_instructions": special_inst,
            "execution_cost": execution_cost,
            "prompt_tokens": sim_prompt_tokens,
            "completion_tokens": sim_completion_tokens
        }

        return SimulationResponse(
            dataframe=final_dataframe,
            column_details=column_details,
            dq_insights=dq_insights,
            table_dq_insights=table_dq_insights,
            column_dq_insights=column_dq_insights,
            primary_keys=primary_keys,
            execution_explanation=execution_explanation
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate", response_model=CodeGenerationResponse)
async def generate_code(request: CodeGenerationRequest):
    try:
        result = await generator.generate(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
def convert_to_csv(data):
    if not data:
        return ""
    output = io.StringIO()
    headers = data[0].keys()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    for row in data:
        writer.writerow(row)
    return output.getvalue()

@app.post("/github/push")
async def push_to_github(request: GitHubPushRequest):
    try:
        github_token = os.getenv("GITHUB_TOKEN")
        if not github_token:
            raise HTTPException(
                status_code=400, 
                detail="GITHUB_TOKEN is not configured in backend/.env file."
            )
            
        repo = request.repo_name or os.getenv("GITHUB_REPO")
        if not repo:
            raise HTTPException(
                status_code=400, 
                detail="GITHUB_REPO is not configured in backend/.env file."
            )
            
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # 1. Determine file names
        data_file_name = (request.data_file_name or "").strip() or f"simulated_data_{timestamp}.csv"
        if not data_file_name.endswith('.csv'):
            data_file_name += '.csv'
            
        ext = ".sql"
        fmt = (request.format or "").lower()
        if "pyspark" in fmt or "python" in fmt:
            ext = ".py"
        elif "mongodb" in fmt or "noscript" in fmt or "js" in fmt or "firestore" in fmt:
            ext = ".js"
            
        code_file_name = (request.query_file_name or "").strip() or f"query_{timestamp}{ext}"
        if not code_file_name.endswith(ext):
            code_file_name += ext

        # 2. Build structured path
        pod = request.pod_name or "data-pod-1"
        project = request.project_name or "sdlc-data-engineering"
        
        data_path = f"{pod}/{project}/data/{data_file_name}"
        code_path = f"{pod}/{project}/queries/{code_file_name}"
        
        # 3. Convert and push dataframe CSV
        csv_content = convert_to_csv(request.dataframe)
        base64_data_content = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")
        
        headers = {
            "Authorization": f"Bearer {github_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        data_url = f"https://api.github.com/repos/{repo}/contents/{data_path}"
        
        async with httpx.AsyncClient() as client:
            # Check if CSV file already exists
            get_resp = await client.get(data_url, headers=headers)
            sha = get_resp.json().get("sha") if get_resp.status_code == 200 else None
            
            body = {
                "message": f"Upload simulated database dataframe: {data_file_name}",
                "content": base64_data_content,
            }
            if sha:
                body["sha"] = sha
                
            put_resp = await client.put(data_url, headers=headers, json=body)
            if put_resp.status_code not in (200, 201):
                error_detail = put_resp.json().get("message", "Unknown GitHub API error")
                raise HTTPException(status_code=put_resp.status_code, detail=f"GitHub API CSV Error: {error_detail}")
                
            data_html_url = put_resp.json().get("content", {}).get("html_url", "")
            
            code_html_url = ""
            
            # 4. Push generated code query if present
            if request.generated_code:
                code_url = f"https://api.github.com/repos/{repo}/contents/{code_path}"
                
                base64_code_content = base64.b64encode(request.generated_code.encode("utf-8")).decode("utf-8")
                
                get_code_resp = await client.get(code_url, headers=headers)
                code_sha = get_code_resp.json().get("sha") if get_code_resp.status_code == 200 else None
                
                code_body = {
                    "message": f"Upload generated query code: {code_file_name}",
                    "content": base64_code_content,
                }
                if code_sha:
                    code_body["sha"] = code_sha
                    
                put_code_resp = await client.put(code_url, headers=headers, json=code_body)
                if put_code_resp.status_code not in (200, 201):
                    error_detail = put_code_resp.json().get("message", "Unknown GitHub API error")
                    raise HTTPException(status_code=put_code_resp.status_code, detail=f"GitHub API Code Error: {error_detail}")
                    
                code_html_url = put_code_resp.json().get("content", {}).get("html_url", "")
                
            return {
                "status": "success",
                "data_file_path": data_path,
                "data_html_url": data_html_url,
                "code_file_path": code_path,
                "code_html_url": code_html_url
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
