import os
import json
from openai import AsyncOpenAI
from .schemas import CodeGenerationRequest, CodeGenerationResponse, DQInsights
from dotenv import load_dotenv

load_dotenv(override=True)

def parse_llm_json(content: str) -> dict:
    content = content.strip()
    start_idx = content.find("{")
    end_idx = content.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
        json_str = content[start_idx:end_idx+1]
        try:
            return json.loads(json_str)
        except Exception:
            pass
    return json.loads(content)

def sanitize_dq_insights(dq_in: dict) -> dict:
    if not isinstance(dq_in, dict):
        dq_in = {}
    
    cleaned = {}
    
    # Integer fields
    for key in ["row_count", "null_values", "duplicate_rows", "distinct_values", "empty_strings"]:
        val = dq_in.get(key, 0)
        if isinstance(val, dict):
            cleaned[key] = sum(v for v in val.values() if isinstance(v, (int, float)))
        elif isinstance(val, list):
            cleaned[key] = sum(v for v in val if isinstance(v, (int, float)))
        elif isinstance(val, (int, float)):
            cleaned[key] = int(val)
        elif isinstance(val, str):
            try:
                cleaned[key] = int(float(val))
            except ValueError:
                cleaned[key] = 0
        else:
            cleaned[key] = 0
            
    # Float fields (minimum, maximum, average)
    for key in ["minimum", "maximum", "average"]:
        val = dq_in.get(key, None)
        if val is None:
            cleaned[key] = None
        elif isinstance(val, dict):
            numeric_vals = [v for v in val.values() if isinstance(v, (int, float))]
            cleaned[key] = float(numeric_vals[0]) if numeric_vals else None
        elif isinstance(val, list):
            numeric_vals = [v for v in val if isinstance(v, (int, float))]
            cleaned[key] = float(numeric_vals[0]) if numeric_vals else None
        elif isinstance(val, (int, float)):
            cleaned[key] = float(val)
        elif isinstance(val, str):
            try:
                cleaned[key] = float(val)
            except ValueError:
                cleaned[key] = None
        else:
            cleaned[key] = None
            
    return cleaned


class CodeGenerator:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
    async def generate(self, request: CodeGenerationRequest) -> CodeGenerationResponse:
        try:
            # Fetch schemas from MongoDB semanticMetaStore if available
            mongodb_uri = os.getenv("MONGODB_URI")
            schema_context = ""
            if mongodb_uri:
                try:
                    from pymongo import MongoClient
                    client = MongoClient(mongodb_uri)
                    db = client["bankingSdlcDB"]
                    schema_docs = list(db['semanticMetaStore'].find({"collection_name": {"$in": request.tables}}))
                    
                    schema_context_list = []
                    for doc in schema_docs:
                        col_name = doc.get("collection_name")
                        desc = doc.get("description", "")
                        pk = doc.get("primary_key", "")
                        fields = doc.get("fields", [])
                        
                        fields_desc = []
                        for f in fields:
                            f_name = f.get("field_name")
                            f_type = f.get("data_type")
                            f_desc = f.get("description")
                            fields_desc.append(f"- {f_name} ({f_type}): {f_desc}")
                            
                        relations = doc.get("relations", [])
                        relations_desc = []
                        for r in relations:
                            relations_desc.append(f"Foreign key `{r.get('local_field')}` links to `{r.get('referenced_collection')}({r.get('referenced_field')})`")
                            
                        schema_info = f"Table: {col_name}\nDescription: {desc}\nPrimary Key: {pk}\nColumns:\n" + "\n".join(fields_desc)
                        if relations_desc:
                            schema_info += "\nRelations:\n" + "\n".join(relations_desc)
                        schema_context_list.append(schema_info)
                    
                    if schema_context_list:
                        schema_context = "\n\n=== Table Schemas ===\n" + "\n\n".join(schema_context_list)
                except Exception as e:
                    print(f"Failed to fetch schemas from semanticMetaStore: {e}")

            prompt = f"""
            You are an expert Data Engineer and AI Assistant specializing in SDLC automation.
            Generate the requested code based on the following input:
            
            Format: {request.format}
            Tables: {", ".join(request.tables)}
            Columns: {", ".join(request.columns)}
            Logic: {request.logic}
            Sample Data Size: {request.sample_data_size}
            {schema_context}
            
            === Categorical Values in the Database ===
            Here are the exact string values stored in the database for certain fields. When writing filter conditions based on natural language logic, you MUST map user terminology to these exact case-sensitive string values:
            - Table `customerDetails` -> column `kyc_status`: 'Verified', 'Pending', 'Failed'
            - Table `accountBalances` -> column `account_type`: 'Savings', 'Current'
            - Table `loanInfo` -> column `loan_type`: 'Home', 'Personal', 'Auto' (e.g. if the user query asks for "home loans", "personal loans", or "auto loans", you MUST use the exact string values 'Home', 'Personal', or 'Auto' in your filters)
            - Table `loanInfo` -> column `loan_status`: 'Active', 'Closed', 'Default' (e.g. if the user query asks for "active loans" or "active status", use 'Active')
            - Table `transactionsInfo` -> column `channel`: 'UPI', 'NetBanking', 'ATM', 'POS'
            - Table `transactionsInfo` -> column `status`: 'Success', 'Failed', 'Flagged' (e.g. if the user query asks for "successful transactions" or "success status", use 'Success')
            
            Instructions:
            1. Generate highly optimized and clean code in the requested format.
               Follow these formatting conventions:
               - PySpark: Generate standard Python code using the PySpark DataFrame API (e.g. `df.select().filter()`).
               - SparkSQL: Generate Python code that executes SQL using the Spark Session (e.g. `spark.sql('''SELECT ...''')`).
               - SQL, PostgreSQL, MySQL, BigQuery, Snowflake, Oracle, Apache Iceberg: Generate raw SQL statements only.
               - PL/SQL: Generate a SINGLE raw SQL SELECT statement using DECLARE/BEGIN/END blocks, cursors, or procedural PL/SQL syntax.
               - MongoDB NoSQL: Generate MongoDB Python query code (e.g. `db.collection.aggregate([...])`).
            2. ALWAYS use the exact case-sensitive table names and column names as defined in the schemas above to ensure proper query execution.
            3. The generated code MUST project, select, and output all the columns specified in the 'Columns' list (i.e. {", ".join(request.columns)}).
               HOWEVER, you must also analyze the 'Logic' to smartly determine if the user query requires any computed, derived, or aggregated columns (e.g. sums, counts, averages, date/month extractions, conditional buckets, etc.).
               If computed columns are needed:
               - Smartly define and include these computed columns in the output projection/selection of the query/code.
               - To prevent Column Resolution Errors, you MUST ensure that every column selected in your final select statement is present in the final joined DataFrame.
               - Specifically, if columns like `merchant_name`, `channel`, or `transaction_type` are in the 'Columns' list, you MUST perform a detail-level/row-level join of the `transactionsInfo` table directly to the main DataFrame: e.g. `final_df = customer_loans.join(transactionsInfo, "customer_id", "left")` (do NOT just join an aggregated subquery that omits these columns).
               - When joining detail tables like `transactionsInfo` at the row level, calculate customer-level aggregates (such as counting UPI transactions per customer) using window functions (e.g., PySpark `Window.partitionBy("customer_id")` or SQL `OVER (PARTITION BY customer_id)`) rather than `groupBy`, so that the detail rows are not collapsed and all requested transaction-level columns can be projected.
               - To prevent row duplication when joining a detail table (like `transactionsInfo`) to a customer-level table, you MUST deduplicate the joined dataset so that the final output row count matches the primary table (e.g., exactly 254 rows for active home loans):
                  * For PySpark/Pandas: call `.dropDuplicates(["customer_id"])` on the final DataFrame.
                  * For SQL-based formats (SQL, SparkSQL, PL/SQL, PostgreSQL, MySQL, BigQuery, Snowflake, etc.), including within PL/SQL cursors: deduplicate the detail table (like `transactionsInfo`) before joining it, by using a CTE/subquery with `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY timestamp DESC) as rn` and filtering for `rn = 1` inside that CTE/subquery, and then performing a `LEFT JOIN` on this deduplicated set. Alternatively, wrap the entire query in a CTE/subquery, calculate `ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY timestamp DESC) as rn`, and filter for `WHERE rn = 1` in the outer query. Ensure that customers with no transactions are NOT filtered out by the WHERE clause (i.e. use LEFT JOIN and place the rn filter inside the JOIN condition or a subquery).
               - Give all computed columns clear, descriptive names.
            4. Provide realistic simulated aggregate Data Quality (DQ) insights for the entire result set.
            5. Return the response as a JSON object with exactly these keys: 
               - "generated_code": (string) The full code block.
               - "flow_explanation": (string) A detailed step-by-step description of how the code was generated, detailing which tables and columns were referred, how much sample data was referred, and the transformation logic applied.
               - "dq_insights": (object) 
                 - "row_count": (integer) Total number of rows.
                 - "null_values": (integer) Total number of nulls across all columns.
                 - "duplicate_rows": (integer) Number of duplicate records.
                 - "minimum": (number/float) The lowest value in the primary numeric column.
                 - "maximum": (number/float) The highest value in the primary numeric column.
                 - "average": (number/float) The mean value of the primary numeric column.
                 - "distinct_values": (integer) Number of distinct/unique rows.
                 - "empty_strings": (integer) Number of empty string values across all columns.
            
            IMPORTANT: Every value in "dq_insights" must be a single number (int or float), NOT an object or list.
            """

            requested_model = request.model or "gpt-4o"
            
            if requested_model == "gpt-4o":
                response = await self.client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.0
                )
                data = parse_llm_json(response.choices[0].message.content)
                prompt_tokens = response.usage.prompt_tokens if response.usage else 0
                completion_tokens = response.usage.completion_tokens if response.usage else 0
                
            elif requested_model in ["gemini-2.5-flash", "gemini-3.1-flash", "gemini-3.5-flash"]:
                gemini_key = os.getenv("GEMINI_API_KEY")
                if not gemini_key:
                    raise ValueError("GEMINI_API_KEY is not set in backend/.env file.")
                
                gemini_mapping = {
                    "gemini-2.5-flash": "gemini-2.5-flash",
                    "gemini-3.1-flash": "gemini-3.1-flash-lite",
                    "gemini-3.5-flash": "gemini-3.5-flash"
                }
                gemini_model = gemini_mapping.get(requested_model, "gemini-2.5-flash")
                
                import httpx
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
                headers = {"Content-Type": "application/json"}
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.0
                    }
                }
                async with httpx.AsyncClient() as client:
                    response = await client.post(url, headers=headers, json=payload, timeout=60.0)
                    if response.status_code != 200:
                        raise Exception(f"Gemini API Error ({response.status_code}): {response.text}")
                    
                    res_json = response.json()
                    text = res_json['candidates'][0]['content']['parts'][0]['text']
                    data = parse_llm_json(text)
                    
                    usage = res_json.get('usageMetadata', {})
                    prompt_tokens = usage.get('promptTokenCount', 0)
                    completion_tokens = usage.get('candidatesTokenCount', 0)
                    
            elif requested_model == "mistral":
                mistral_key = os.getenv("MISTRALAI_API_KEY")
                if not mistral_key:
                    raise ValueError("MISTRALAI_API_KEY is not set in backend/.env file.")
                
                from langchain_mistralai import ChatMistralAI
                
                llm = ChatMistralAI(
                    model="mistral-large-latest",
                    api_key=mistral_key,
                    temperature=0.0
                )
                llm_json = llm.bind(response_format={"type": "json_object"})
                response = await llm_json.ainvoke(prompt)
                
                data = parse_llm_json(response.content)
                
                usage_metadata = getattr(response, "usage_metadata", None) or {}
                if usage_metadata:
                    prompt_tokens = usage_metadata.get("input_tokens", 0)
                    completion_tokens = usage_metadata.get("output_tokens", 0)
                else:
                    response_metadata = getattr(response, "response_metadata", None) or {}
                    token_usage = response_metadata.get("token_usage", {})
                    prompt_tokens = token_usage.get("prompt_tokens", 0)
                    completion_tokens = token_usage.get("completion_tokens", 0)
                    
            elif requested_model in ["llama", "qwen", "kimi"]:
                together_key = os.getenv("TOGETHER_API_KEY")
                if not together_key:
                    raise ValueError("TOGETHER_API_KEY is not set in backend/.env file.")
                
                together_mapping = {
                    "llama": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                    "qwen": "Qwen/Qwen2.5-7B-Instruct-Turbo",
                    "kimi": "moonshotai/Kimi-K2.6"
                }
                together_model = together_mapping.get(requested_model)
                if not together_model:
                    raise ValueError(f"Together AI model mapping not found for {requested_model}")
                
                together_client = AsyncOpenAI(
                    api_key=together_key,
                    base_url="https://api.together.xyz/v1"
                )
                response = await together_client.chat.completions.create(
                    model=together_model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.0
                )
                data = parse_llm_json(response.choices[0].message.content)
                prompt_tokens = response.usage.prompt_tokens if response.usage else 0
                completion_tokens = response.usage.completion_tokens if response.usage else 0
            else:
                raise ValueError(f"Unsupported model: {requested_model}")
            
            return CodeGenerationResponse(
                generated_code=data["generated_code"],
                dq_insights=DQInsights(**sanitize_dq_insights(data.get("dq_insights", {}))),
                flow_explanation=data.get("flow_explanation", "Standard code generation execution completed."),
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens
            )
        except Exception as e:
            print(f"Error in generation: {e}")
            # Fallback mock for demonstration
            return CodeGenerationResponse(
                generated_code=f"Error - {str(e)}",
                dq_insights=DQInsights(
                     row_count=request.sample_data_size,
                     null_values=5,
                     duplicate_rows=2,
                     minimum=10.5,
                     maximum=500.0,
                     average=255.25,
                     distinct_values=max(1, request.sample_data_size - 2),
                     empty_strings=0
                ),
                flow_explanation=f"Error encountered during code generation: {str(e)}. Fallback mock response returned.",
                prompt_tokens=0,
                completion_tokens=0
            )

    async def generate_pandas_simulation(self, format: str, code_str: str, tables: list, columns: list, logic: str, model: str = "gpt-4o") -> str:
        try:
            # Fetch schemas from MongoDB semanticMetaStore if available
            mongodb_uri = os.getenv("MONGODB_URI")
            schema_context = ""
            if mongodb_uri:
                try:
                    from pymongo import MongoClient
                    client = MongoClient(mongodb_uri)
                    db = client["bankingSdlcDB"]
                    schema_docs = list(db['semanticMetaStore'].find({"collection_name": {"$in": tables}}))
                    
                    schema_context_list = []
                    for doc in schema_docs:
                        col_name = doc.get("collection_name")
                        desc = doc.get("description", "")
                        pk = doc.get("primary_key", "")
                        fields = doc.get("fields", [])
                        
                        fields_desc = []
                        for f in fields:
                            f_name = f.get("field_name")
                            f_type = f.get("data_type")
                            f_desc = f.get("description")
                            fields_desc.append(f"- {f_name} ({f_type}): {f_desc}")
                            
                        relations = doc.get("relations", [])
                        relations_desc = []
                        for r in relations:
                            relations_desc.append(f"Foreign key `{r.get('local_field')}` links to `{r.get('referenced_collection')}({r.get('referenced_field')})`")
                            
                        schema_info = f"Table: {col_name}\nDescription: {desc}\nPrimary Key: {pk}\nColumns:\n" + "\n".join(fields_desc)
                        if relations_desc:
                            schema_info += "\nRelations:\n" + "\n".join(relations_desc)
                        schema_context_list.append(schema_info)
                    
                    if schema_context_list:
                        schema_context = "\n\n=== Table Schemas ===\n" + "\n\n".join(schema_context_list)
                except Exception as e:
                    print(f"Failed to fetch schemas for simulation: {e}")

            prompt = f"""
            You are an expert Data Engineer specializing in Python and Pandas.
            Your task is to write a Python script containing a function `simulate(dfs: dict) -> pd.DataFrame` that takes a dictionary `dfs` where the keys are the table names (as strings) and values are pandas DataFrames containing the table data.
            This function MUST return a single pandas DataFrame representing the exact outcome of the generated query/code below.

            Target Format of Generated Code: {format}
            Generated Code:
            {code_str}

            User Logic / Request: {logic}
            Tables: {", ".join(tables)}
            Columns Selected: {", ".join(columns)}
            {schema_context}

            Instructions for the Python code:
            1. Define a function `simulate(dfs: dict) -> pd.DataFrame:`.
            2. Access each DataFrame from the `dfs` dictionary by its exact table name, e.g., `df_txn = dfs.get('transactionsInfo')`. Always check if a DataFrame exists and is not empty. If it is empty, handle it gracefully (e.g., return an empty DataFrame).
            3. Implement the exact logic specified in the generated code and user request (joins between tables, where/having filters, group by clauses, aggregates like sum/count/avg, window functions, and order by sorting).
            4. If the generated code performs aggregation (like grouping by month and channel, and calculating sum and count), your Python code MUST perform the exact same grouping and calculation, returning a DataFrame with those grouped and aggregated columns (e.g. `month`, `channel`, `total_amount`, `transaction_count`).
            5. If the generated code does not aggregate, but instead generates row-level computed columns (like `credit_score_bucket` or custom categories), calculate them and return the DataFrame containing these computed columns along with the requested columns.
            6. Handle date/timestamp parsing safely. For example, if a column is a timestamp, parse it with `pd.to_datetime` before extracting parts like month. E.g. `pd.to_datetime(df_txn['timestamp']).dt.strftime('%B')`.
            7. Ensure the returned DataFrame contains the computed/derived/aggregated columns with clear, descriptive header names that match the generated query's select list.
            8. Return the response as a JSON object with exactly one key "python_code" containing the python script as a string. Do not include markdown blocks (```python) or any other explanation inside the python_code string or JSON.
            """

            requested_model = model or "gpt-4o"
            python_code = ""

            if requested_model == "gpt-4o":
                response = await self.client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.0
                )
                data = parse_llm_json(response.choices[0].message.content)
                python_code = data.get("python_code", "")
                
            elif requested_model in ["gemini-2.5-flash", "gemini-3.1-flash", "gemini-3.5-flash"]:
                gemini_key = os.getenv("GEMINI_API_KEY")
                if not gemini_key:
                    raise ValueError("GEMINI_API_KEY is not set.")
                
                gemini_mapping = {
                    "gemini-2.5-flash": "gemini-2.5-flash",
                    "gemini-3.1-flash": "gemini-3.1-flash-lite",
                    "gemini-3.5-flash": "gemini-3.5-flash"
                }
                gemini_model = gemini_mapping.get(requested_model, "gemini-2.5-flash")
                
                import httpx
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
                headers = {"Content-Type": "application/json"}
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.0
                    }
                }
                async with httpx.AsyncClient() as client:
                    response = await client.post(url, headers=headers, json=payload, timeout=60.0)
                    if response.status_code == 200:
                        res_json = response.json()
                        text = res_json['candidates'][0]['content']['parts'][0]['text']
                        data = parse_llm_json(text)
                        python_code = data.get("python_code", "")
                    
            elif requested_model == "mistral":
                mistral_key = os.getenv("MISTRALAI_API_KEY")
                if mistral_key:
                    from langchain_mistralai import ChatMistralAI
                    llm = ChatMistralAI(model="mistral-large-latest", api_key=mistral_key, temperature=0.0)
                    llm_json = llm.bind(response_format={"type": "json_object"})
                    response = await llm_json.ainvoke(prompt)
                    data = parse_llm_json(response.content)
                    python_code = data.get("python_code", "")
                    
            elif requested_model in ["llama", "qwen", "kimi"]:
                together_key = os.getenv("TOGETHER_API_KEY")
                if together_key:
                    together_mapping = {
                        "llama": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                        "qwen": "Qwen/Qwen2.5-7B-Instruct-Turbo",
                        "kimi": "moonshotai/Kimi-K2.6"
                    }
                    together_model = together_mapping.get(requested_model)
                    if together_model:
                        together_client = AsyncOpenAI(api_key=together_key, base_url="https://api.together.xyz/v1")
                        response = await together_client.chat.completions.create(
                            model=together_model,
                            messages=[{"role": "user", "content": prompt}],
                            response_format={"type": "json_object"},
                            temperature=0.0
                        )
                        data = parse_llm_json(response.choices[0].message.content)
                        python_code = data.get("python_code", "")

            # If the model request didn't return code, fall back to gpt-4o
            if not python_code and requested_model != "gpt-4o":
                response = await self.client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.0
                )
                data = parse_llm_json(response.choices[0].message.content)
                python_code = data.get("python_code", "")

            return python_code
        except Exception as e:
            print(f"Error generating simulation code: {e}")
            return ""

    async def translate_pyspark_to_sql(self, code_str: str, tables: list) -> str:
        prompt = f"""
        You are an expert Data Engineer.
        Your task is to translate the following PySpark DataFrame API code into a single standard SQL SELECT query compatible with DuckDB.
        
        PySpark Code:
        {code_str}
        
        Tables Involved: {", ".join(tables)}
        
        Instructions:
        1. Translate all PySpark logic (joins, filters, projections, aggregations, custom columns, deduplication) into a clean, syntactically correct SQL query.
        2. Specifically, when joining a detail table (like transactionsInfo), calculate customer-level aggregates (like counting UPI transactions) and ensure that duplicate rows are resolved correctly.
        3. Do NOT include any markdown code block formatting (e.g. ```sql). Just return the raw SQL query as a plain string.
        """
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Error in translate_pyspark_to_sql: {e}")
            return ""

generator = CodeGenerator()
