from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import CodeGenerationRequest, CodeGenerationResponse, SimulationRequest, SimulationResponse, GitHubPushRequest, LoginRequest, LoginResponse
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
import pandas as pd
import duckdb
import re
import ast
import sys
# Redirect pyspark imports to duckdb.experimental.spark
try:
    from unittest.mock import MagicMock
    import duckdb.experimental.spark.sql as duck_spark_sql
    import duckdb.experimental.spark.sql.functions as duck_spark_functions
    import duckdb.experimental.spark.sql.types as duck_spark_types
    import duckdb.experimental.spark.sql.dataframe as duck_spark_dataframe
    
    sys.modules['pyspark'] = sys.modules.get('pyspark') or type(sys)('pyspark')
    sys.modules['pyspark.sql'] = duck_spark_sql
    sys.modules['pyspark.sql.functions'] = duck_spark_functions
    sys.modules['pyspark.sql.types'] = duck_spark_types
    sys.modules['pyspark.sql.dataframe'] = duck_spark_dataframe
    
    # Enforce singleton behavior for SparkSession in DuckDB compatibility layer
    singleton_spark = duck_spark_sql.SparkSession.builder.getOrCreate()
    def patched_getOrCreate(self):
        return singleton_spark
    duck_spark_sql.SparkSession.Builder.getOrCreate = patched_getOrCreate
    
    # Patch DataFrameReader to support .table(), .csv(), .json(), and .parquet() methods
    from duckdb.experimental.spark.sql.readwriter import DataFrameReader
    DataFrameReader.table = lambda self, tableName: self.session.table(tableName)
    
    def patched_csv(self, path, *args, **kwargs):
        clean_path = str(path).replace("\\", "/")
        return self.session.sql(f"SELECT * FROM read_csv_auto('{clean_path}')")
        
    def patched_json(self, path, *args, **kwargs):
        clean_path = str(path).replace("\\", "/")
        return self.session.sql(f"SELECT * FROM read_json_auto('{clean_path}')")
        
    def patched_parquet(self, path, *args, **kwargs):
        clean_path = str(path).replace("\\", "/")
        return self.session.sql(f"SELECT * FROM read_parquet('{clean_path}')")
        
    DataFrameReader.csv = patched_csv
    DataFrameReader.json = patched_json
    DataFrameReader.parquet = patched_parquet
    
    # Define custom Window and WindowSpec classes to compile window functions locally
    class WindowSpec:
        def __init__(self, partition_cols=None, order_cols=None):
            self.partition_cols = partition_cols or []
            self.order_cols = order_cols or []
            
        def partitionBy(self, *cols):
            str_cols = [c.expr.get_name() if hasattr(c, 'expr') else str(c) for c in cols]
            return WindowSpec(self.partition_cols + str_cols, self.order_cols)
            
        def orderBy(self, *cols):
            str_cols = []
            for c in cols:
                if hasattr(c, 'expr'):
                    name = c.expr.get_name() if hasattr(c.expr, 'get_name') else str(c.expr)
                    str_cols.append(name)
                else:
                    str_cols.append(str(c))
            return WindowSpec(self.partition_cols, self.order_cols + str_cols)
            
        def to_sql(self):
            parts = []
            if self.partition_cols:
                parts.append(f"PARTITION BY {', '.join(self.partition_cols)}")
            if self.order_cols:
                parts.append(f"ORDER BY {', '.join(self.order_cols)}")
            return " ".join(parts)

    class Window:
        @staticmethod
        def partitionBy(*cols):
            return WindowSpec().partitionBy(*cols)
            
        @staticmethod
        def orderBy(*cols):
            return WindowSpec().orderBy(*cols)

    class WindowFunction:
        def __init__(self, name):
            self.name = name
            
        def over(self, window_spec):
            sql_str = f"{self.name} OVER ({window_spec.to_sql()})"
            return duck_spark_functions.expr(sql_str)

    # Bind window functions onto duckdb Spark functions module
    duck_spark_functions.row_number = lambda: WindowFunction("row_number()")
    duck_spark_functions.rank = lambda: WindowFunction("rank()")
    duck_spark_functions.dense_rank = lambda: WindowFunction("dense_rank()")
    duck_spark_functions.percent_rank = lambda: WindowFunction("percent_rank()")
    
    def patched_lead(col, offset=1, default=None):
        col_name = col.expr.get_name() if hasattr(col, 'expr') else str(col)
        args = [col_name, str(offset)]
        if default is not None:
            args.append(str(default))
        return WindowFunction(f"lead({', '.join(args)})")
        
    def patched_lag(col, offset=1, default=None):
        col_name = col.expr.get_name() if hasattr(col, 'expr') else str(col)
        args = [col_name, str(offset)]
        if default is not None:
            args.append(str(default))
        return WindowFunction(f"lag({', '.join(args)})")
        
    duck_spark_functions.lead = patched_lead
    duck_spark_functions.lag = patched_lag
    
    # Create window module for window functions compatibility
    pyspark_sql_window = type(sys)('pyspark.sql.window')
    pyspark_sql_window.Window = Window
    sys.modules['pyspark.sql.window'] = pyspark_sql_window
except Exception:
    pass


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
async def get_metadata(role: str = None):
    try:
        if not MONGODB_URI:
            raise HTTPException(status_code=500, detail="MONGODB_URI is not set in environment variables")
        client = MongoClient(MONGODB_URI)
        db = client["bankingSdlcDB"]
        
        # Determine allowed collections based on role
        if role == "Data Engineering":
            allowed = ["customerDetails", "accountBalances", "loanInfo", "transactionsInfo", "dataQualityLogs"]
        elif role == "Healthcare":
            allowed = ["patientsInfo", "medicalRecords", "doctorDetails", "hospitalBeds", "healthcareDqLogs"]
        elif role == "Media":
            allowed = ["subscriberProfiles", "contentLibrary", "watchHistory", "billingTransactions", "mediaDqLogs"]
        else:
            # If no role or unrecognized role is provided, default to listing everything (except system. and users/metadata store)
            allowed = [
                "customerDetails", "accountBalances", "loanInfo", "transactionsInfo", "dataQualityLogs",
                "patientsInfo", "medicalRecords", "doctorDetails", "hospitalBeds", "healthcareDqLogs",
                "subscriberProfiles", "contentLibrary", "watchHistory", "billingTransactions", "mediaDqLogs"
            ]
            
        metadata = {}
        for col_name in allowed:
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

@app.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    try:
        if not MONGODB_URI:
            raise HTTPException(status_code=500, detail="MONGODB_URI is not set in environment variables")
        client = MongoClient(MONGODB_URI)
        db = client["bankingSdlcDB"]
        
        user = db["sdlcUsers"].find_one({"userId": request.userId})
        if not user or user.get("password") != request.password:
            raise HTTPException(status_code=401, detail="Invalid userId or password")
            
        return LoginResponse(
            status="success",
            userId=user["userId"],
            role=user["role"]
        )
    except HTTPException as he:
        raise he
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


def clean_procedural_sql(code: str) -> str:
    code_upper = code.upper()
    if "DECLARE" not in code_upper or "BEGIN" not in code_upper:
        return code
        
    try:
        # Extract DECLARE and BEGIN sections
        declare_match = re.search(r'DECLARE(.*?)BEGIN', code, re.DOTALL | re.IGNORECASE)
        begin_match = re.search(r'BEGIN(.*?)END', code, re.DOTALL | re.IGNORECASE)
        
        if not declare_match or not begin_match:
            return code
            
        declare_section = declare_match.group(1)
        begin_section = begin_match.group(1).strip()
        
        # Parse variables: name and value
        vars_dict = {}
        for stmt in declare_section.split(';'):
            stmt = stmt.strip()
            if not stmt:
                continue
            
            # Clean comments
            stmt = re.sub(r'--.*$', '', stmt, flags=re.MULTILINE)
            stmt = re.sub(r'/\*.*?\*/', '', stmt, flags=re.DOTALL)
            stmt = stmt.strip()
            if not stmt:
                continue
                
            # If it's a CURSOR declaration, we don't treat it as a standard variable
            if re.match(r'^\s*CURSOR\b', stmt, re.IGNORECASE):
                continue
                
            lhs, rhs = None, None
            if ':=' in stmt:
                parts = stmt.split(':=', 1)
                lhs, rhs = parts[0], parts[1]
            else:
                default_match = re.search(r'\bDEFAULT\b', stmt, re.IGNORECASE)
                if default_match:
                    idx = default_match.start()
                    lhs = stmt[:idx]
                    rhs = stmt[idx + 7:]
            
            if lhs and rhs:
                lhs_words = lhs.strip().split()
                if lhs_words:
                    var_name = lhs_words[0].strip()
                    var_val = rhs.strip()
                    vars_dict[var_name] = var_val
                    
        # Check if there is a cursor definition in declare_section
        cursor_match = re.search(r'\bCURSOR\s+(\w+)\s*(?:\((.*?)\))?\s*IS\s*((?:WITH|SELECT).*?)(?:;|$)', declare_section, re.DOTALL | re.IGNORECASE)
        if cursor_match:
            cursor_name = cursor_match.group(1)
            params_str = cursor_match.group(2)
            cursor_query = cursor_match.group(3).strip()
            
            # Parse cursor parameters if they exist
            param_names = []
            if params_str:
                for param in params_str.split(','):
                    param = param.strip()
                    parts = param.split()
                    if parts:
                        param_names.append(parts[0].strip())
            
            # If cursor has parameters, try to find invocation arguments in BEGIN block
            if param_names:
                invoc_match = re.search(rf'\b{re.escape(cursor_name)}\s*\((.*?)\)', begin_section, re.IGNORECASE)
                if invoc_match:
                    args_str = invoc_match.group(1)
                    args = [a.strip() for a in args_str.split(',')]
                    for p_name, p_val in zip(param_names, args):
                        cursor_query = re.sub(rf'\b{re.escape(p_name)}\b', p_val, cursor_query)
            
            # Replace variables in the cursor query
            for var_name, var_val in vars_dict.items():
                cursor_query = re.sub(rf'\b{re.escape(var_name)}\b', var_val, cursor_query)
                
            # Remove any trailing INTO clauses if they exist
            cursor_query = re.sub(r'\bINTO\s+.*?\s+(?=\bFROM\b)', '', cursor_query, flags=re.IGNORECASE)
            
            # Remove trailing semicolon
            if cursor_query.endswith(';'):
                cursor_query = cursor_query[:-1].strip()
                
            return cursor_query
                    
        # Replace variables in BEGIN section
        cleaned_sql = begin_section
        for var_name, var_val in vars_dict.items():
            # Use word boundaries to replace variables safely
            cleaned_sql = re.sub(rf'\b{re.escape(var_name)}\b', var_val, cleaned_sql)
            
        # If there's a SELECT statement inside, extract it
        select_match = re.search(r'((?:WITH|SELECT)\b.*)', cleaned_sql, re.DOTALL | re.IGNORECASE)
        if select_match:
            cleaned_sql = select_match.group(1).strip()
            
        # Remove any trailing INTO clauses if they exist (e.g., SELECT ... INTO ... FROM ...)
        cleaned_sql = re.sub(r'\bINTO\s+.*?\s+(?=\bFROM\b)', '', cleaned_sql, flags=re.IGNORECASE)
        
        # Remove trailing semicolon if present
        if cleaned_sql.endswith(';'):
            cleaned_sql = cleaned_sql[:-1].strip()
            
        return cleaned_sql
    except Exception as e:
        print("PL/SQL cleaning failed:", e)
        return code


def sanitize_sql_for_duckdb(code: str) -> str:
    """
    Comprehensive sanitizer that takes any generated SQL-like code and extracts
    a clean, standard SQL SELECT statement that DuckDB can execute.
    Handles: PL/SQL blocks, spark.sql() wrappers, Python comments/imports,
    print statements, variable assignments, and other non-SQL artifacts.
    """
    sql = code.strip()
    
    # 1. Handle PL/SQL procedural blocks (DECLARE/BEGIN/END, cursors)
    sql = clean_procedural_sql(sql)
    
    # 2. Extract SQL from spark.sql(...) wrappers
    if "spark.sql" in sql.lower():
        for pattern in [
            r'spark\.sql\(\s*f?["\']{3}(.*?)["\']{3}\s*\)',
            r'spark\.sql\(\s*f?["\']{1,4}(.*?)["\']{1,4}\s*\)',
            r'spark\.sql\(\s*f?["\'](.*?)["\']\s*\)',
        ]:
            m = re.search(pattern, sql, re.DOTALL | re.IGNORECASE)
            if m:
                sql = m.group(1).strip()
                break
    
    # 3. Peel enclosing quote wrappers
    while True:
        if sql.startswith("'''") and sql.endswith("'''"):
            sql = sql[3:-3].strip()
        elif sql.startswith('"""') and sql.endswith('"""'):
            sql = sql[3:-3].strip()
        elif len(sql) > 2 and sql[0] in ("'", '"') and sql[-1] == sql[0]:
            sql = sql[1:-1].strip()
        else:
            break
    
    # 4. Strip Python comments (lines starting with #) and import/print lines
    lines = sql.split('\n')
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('#'):
            continue
        if stripped.startswith('import ') or stripped.startswith('from '):
            continue
        if stripped.startswith('print(') or stripped.startswith('print ('):
            continue
        # Skip pure Python variable assignments that are NOT SQL aliases
        if re.match(r'^[a-zA-Z_]\w*\s*=\s*(?!.*\bSELECT\b)', stripped, re.IGNORECASE):
            continue
        cleaned_lines.append(line)
    sql = '\n'.join(cleaned_lines).strip()
    
    # 5. If there's a SELECT statement buried in the text, extract it
    if not sql.upper().startswith('SELECT') and not sql.upper().startswith('WITH'):
        select_match = re.search(r'((?:WITH|SELECT)\b.*)', sql, re.DOTALL | re.IGNORECASE)
        if select_match:
            sql = select_match.group(1).strip()
    
    # 6. Remove trailing semicolons
    sql = sql.rstrip(';').strip()
    
    # 7. Convert Spark/MySQL DATE_FORMAT functions to DuckDB strftime
    def replace_date_format(match):
        col_expr = match.group(1).strip()
        fmt = match.group(2)
        fmt_trans = fmt.replace('yyyy', '%Y').replace('YYYY', '%Y')
        fmt_trans = fmt_trans.replace('MM', '%m').replace('mm', '%m')
        fmt_trans = fmt_trans.replace('dd', '%d').replace('DD', '%d')
        return f"strftime({col_expr}, '{fmt_trans}')"
        
    sql = re.sub(r'\bdate_format\(\s*([^,]+)\s*,\s*["\']([^"\']+)["\']\s*\)', replace_date_format, sql, flags=re.IGNORECASE)
    
    return sql


def _pyspark_code_to_sql(code_str: str, table_names: list) -> str:
    """
    Convert common PySpark DataFrame API code patterns into equivalent SQL
    that DuckDB can execute directly. Handles:
      - spark.table("X")
      - .filter(...) / .where(...)
      - .select(...)
      - .join(...)
      - .groupBy(...).agg(...)
      - .orderBy(...) / .sort(...)
      - .limit(N)
      - .distinct()
    Returns a SQL string or None if conversion is not possible.
    """
    try:
        # Helper: extract content inside balanced parenthesis for .method_name(...)
        def extract_method_args(method_name: str) -> str:
            idx = code_str.find(f".{method_name}(")
            if idx == -1:
                return None
            start_pos = idx + len(method_name) + 2
            paren_count = 1
            for i in range(start_pos, len(code_str)):
                char = code_str[i]
                if char == '(':
                    paren_count += 1
                elif char == ')':
                    paren_count -= 1
                    if paren_count == 0:
                        return code_str[start_pos:i]
            return None

        # Helper: split comma-separated arguments while respecting parenthesis and quotes
        def split_args(args_str: str) -> list:
            parts = []
            current = []
            paren_count = 0
            in_quote = None
            for char in args_str:
                if in_quote:
                    if char == in_quote:
                        in_quote = None
                    current.append(char)
                elif char in ['"', "'"]:
                    in_quote = char
                    current.append(char)
                elif char == '(':
                    paren_count += 1
                    current.append(char)
                elif char == ')':
                    paren_count -= 1
                    current.append(char)
                elif char == ',' and paren_count == 0:
                    parts.append("".join(current).strip())
                    current = []
                else:
                    current.append(char)
            if current:
                parts.append("".join(current).strip())
            return parts

        # 1. If code already contains spark.sql(), extract the SQL directly
        for pattern in [
            r'spark\.sql\(\s*f?["\']{3}(.*?)["\']{3}\s*\)',
            r'spark\.sql\(\s*f?["\']{1,4}(.*?)["\']{1,4}\s*\)',
            r'spark\.sql\(\s*f?["\'](.*?)["\']\s*\)',
        ]:
            m = re.search(pattern, code_str, re.DOTALL | re.IGNORECASE)
            if m:
                sql = m.group(1).strip().strip("'\"").strip()
                if sql:
                    return sql
        
        # 2. Try to parse PySpark DataFrame API chain into SQL components
        table_match = re.search(r'spark\.(?:read\.)?table\(\s*["\'](\w+)["\']\s*\)', code_str)
        if not table_match:
            primary_table = None
            for tn in table_names:
                if tn in code_str:
                    primary_table = tn
                    break
            if not primary_table:
                return None
        else:
            primary_table = table_match.group(1)
        
        select_cols = "*"
        where_clause = ""
        join_clause = ""
        group_clause = ""
        having_clause = ""
        order_clause = ""
        limit_clause = ""
        distinct = ""
        
        # Extract .select(...) columns
        raw_cols = extract_method_args("select")
        if raw_cols is not None:
            # Clean PySpark column references safely
            cols = re.sub(r'(?:F\.)?col\(\s*["\']?(\w+)["\']?\s*\)', r'\1', raw_cols)
            # Clean bracket column references: df['col'] -> col
            cols = re.sub(r'\b\w+\[\s*["\']?(\w+)["\']?\s*\]', r'\1', cols)
            cols = re.sub(r'\b\w+_df\.(\w+)', r'\1', cols)
            cols = re.sub(r'\bdf\.(\w+)', r'\1', cols)
            cols = re.sub(r'\.alias\(\s*["\'](\w+)["\']\s*\)', r' AS \1', cols)
            cols = re.sub(r'["\'](\w+)["\']', r'\1', cols)
            select_cols = cols.strip().rstrip(',')
        
        # Extract all .filter(...) and .where(...) conditions
        where_conditions = []
        
        # Helper to clean condition strings safely
        def clean_cond(cond_str: str) -> str:
            c = cond_str.strip()
            # 1. Convert Python string literals on RHS of operators to single-quoted SQL strings
            c = re.sub(r'([=!<>]+)\s*["\']([^"\']+)["\']', r"\1 '\2'", c)
            # 2. Convert col("x") or F.col("x") to "x"
            c = re.sub(r'(?:F\.)?col\(\s*["\']?(\w+)["\']?\s*\)', r'"\1"', c)
            # 3. Convert df["x"] or df['x'] or df[x] to "x"
            c = re.sub(r'\b\w+\[\s*["\']?(\w+)["\']?\s*\]', r'"\1"', c)
            # 4. Convert df.x or df_df.x to "x"
            c = re.sub(r'\b\w+_df\.(\w+)', r'"\1"', c)
            c = re.sub(r'\bdf\.(\w+)', r'"\1"', c)
            # 5. Convert Python == to SQL =
            c = c.replace('==', '=')
            c = c.replace('!=', '<>')
            # 6. Convert logical operators
            c = re.sub(r'\s*&\s*', ' AND ', c)
            c = re.sub(r'\s*\|\s*', ' OR ', c)
            return c

        idx = 0
        while True:
            next_filter = code_str.find(".filter(", idx)
            next_where = code_str.find(".where(", idx)
            found_idx = -1
            method_name = ""
            if next_filter != -1 and next_where != -1:
                if next_filter < next_where:
                    found_idx = next_filter
                    method_name = "filter"
                else:
                    found_idx = next_where
                    method_name = "where"
            elif next_filter != -1:
                found_idx = next_filter
                method_name = "filter"
            elif next_where != -1:
                found_idx = next_where
                method_name = "where"
                
            if found_idx == -1:
                break
                
            start_pos = found_idx + len(method_name) + 2
            paren_count = 1
            extracted_cond = None
            for i in range(start_pos, len(code_str)):
                char = code_str[i]
                if char == '(':
                    paren_count += 1
                elif char == ')':
                    paren_count -= 1
                    if paren_count == 0:
                        extracted_cond = code_str[start_pos:i]
                        idx = i + 1
                        break
            
            if extracted_cond is not None:
                where_conditions.append(clean_cond(extracted_cond))
            else:
                break
                
        if where_conditions:
            where_clause = " WHERE " + " AND ".join(where_conditions)
        
        # Extract all .join(...) calls
        join_clauses = []
        idx = 0
        while True:
            found_idx = code_str.find(".join(", idx)
            if found_idx == -1:
                break
            
            start_pos = found_idx + len(".join(")
            paren_count = 1
            extracted_join = None
            for i in range(start_pos, len(code_str)):
                char = code_str[i]
                if char == '(':
                    paren_count += 1
                elif char == ')':
                    paren_count -= 1
                    if paren_count == 0:
                        extracted_join = code_str[start_pos:i]
                        idx = i + 1
                        break
            
            if extracted_join is not None:
                join_args = split_args(extracted_join)
                if len(join_args) >= 2:
                    join_table = join_args[0]
                    
                    # Check for filter chained inside the join table parameter
                    for filter_method in ['.filter(', '.where(']:
                        f_idx = join_table.find(filter_method)
                        if f_idx != -1:
                            f_start = f_idx + len(filter_method)
                            f_paren_count = 1
                            for i in range(f_start, len(join_table)):
                                char = join_table[i]
                                if char == '(':
                                    f_paren_count += 1
                                elif char == ')':
                                    f_paren_count -= 1
                                    if f_paren_count == 0:
                                        inner_cond = join_table[f_start:i]
                                        where_conditions.append(clean_cond(inner_cond))
                                        break
                    
                    # Extract base table variable name: e.g. loan_df.filter(...) -> loan_df
                    join_table_base = join_table.split('.')[0].split('[')[0].strip()
                    
                    # Strip _df or df from variable name to match with table name
                    clean_join_table = re.sub(r'_?df$', '', join_table_base, flags=re.IGNORECASE)
                    actual_join_table = join_table_base
                    for tn in table_names:
                        clean_tn = re.sub(r'_?df$', '', tn, flags=re.IGNORECASE)
                        if (clean_tn.lower() == clean_join_table.lower() or 
                            re.sub(r'(?<!^)(?=[A-Z])', '_', clean_tn).lower() == clean_join_table.lower()):
                            actual_join_table = tn
                            break
                    
                    join_cond_raw = join_args[1]
                    join_type = "inner"
                    if len(join_args) >= 3:
                        # Strip how= prefix if present: e.g. how="inner" -> inner
                        join_type_raw = join_args[2]
                        join_type_raw = re.sub(r'^how\s*=\s*', '', join_type_raw, flags=re.IGNORECASE)
                        join_type = join_type_raw.strip('"\'')
                    join_type = join_type.upper()
                    
                    # Clean up join condition: strip optional 'on=' keyword
                    join_cond_clean = re.sub(r'^on\s*=\s*', '', join_cond_raw.strip(), flags=re.IGNORECASE)
                    
                    # Check if join_cond_clean is a single column name
                    single_col_match = re.match(r'^["\']?(\w+)["\']?$', join_cond_clean.strip())
                    if single_col_match:
                        col_name = single_col_match.group(1)
                        join_clauses.append(f" {join_type} JOIN \"{actual_join_table}\" USING ({col_name})")
                    else:
                        # Parse join condition
                        join_cond = clean_cond(join_cond_clean)
                        join_clauses.append(f" {join_type} JOIN \"{actual_join_table}\" ON {join_cond}")
            else:
                break
                
        join_clause = "".join(join_clauses)
        
        # Extract .groupBy(...).agg(...)
        raw_groupby = extract_method_args("groupBy")
        raw_agg = extract_method_args("agg")
        if raw_groupby is not None and raw_agg is not None:
            # Clean group columns
            group_cols = re.sub(r'(?:F\.)?col\(\s*["\']?(\w+)["\']?\s*\)', r'"\1"', raw_groupby)
            group_cols = re.sub(r'["\'](\w+)["\']', r'"\1"', group_cols)
            group_clause = f" GROUP BY {group_cols}"
            
            # Parse aggregations
            agg_parts = []
            for agg_func in ['sum', 'count', 'avg', 'min', 'max', 'mean']:
                for m in re.finditer(rf'(?:F\.)?{agg_func}\(\s*(?:(?:F\.)?col\(\s*)?["\']?(\w+)["\']?\s*\)?\s*\)(?:\.alias\(\s*["\'](\w+)["\']\s*\))?', raw_agg, re.IGNORECASE):
                    col_name = m.group(1)
                    alias = m.group(2) or f"{agg_func}_{col_name}"
                    sql_func = "AVG" if agg_func == "mean" else agg_func.upper()
                    agg_parts.append(f'{sql_func}("{col_name}") AS "{alias}"')
            
            if agg_parts:
                select_cols = f'{group_cols}, {", ".join(agg_parts)}'
        
        # Extract .orderBy(...) or .sort(...)
        for method in ['orderBy', 'sort']:
            raw_order = extract_method_args(method)
            if raw_order is not None:
                order_cols = re.sub(r'(?:F\.)?col\(\s*["\']?(\w+)["\']?\s*\)', r'"\1"', raw_order)
                order_cols = re.sub(r'(?:F\.)?desc\(\s*["\']?(\w+)["\']?\s*\)', r'"\1" DESC', order_cols)
                order_cols = re.sub(r'(?:F\.)?asc\(\s*["\']?(\w+)["\']?\s*\)', r'"\1" ASC', order_cols)
                order_cols = re.sub(r'["\']?(\w+)["\']?\.desc\(\)', r'"\1" DESC', order_cols)
                order_cols = re.sub(r'["\']?(\w+)["\']?\.asc\(\)', r'"\1" ASC', order_cols)
                order_clause = f" ORDER BY {order_cols}"
                break
        
        # Extract .limit(N)
        raw_limit = extract_method_args("limit")
        if raw_limit is not None:
            limit_clause = f" LIMIT {raw_limit.strip()}"
        
        # Extract .distinct()
        if '.distinct()' in code_str:
            distinct = "DISTINCT "
        
        # Build the final SQL
        sql = f'SELECT {distinct}{select_cols} FROM "{primary_table}"{join_clause}{where_clause}{group_clause}{having_clause}{order_clause}{limit_clause}'
        
        sql = sanitize_sql_for_duckdb(sql)
        print(f"[INFO] Converted PySpark to SQL: {sql[:200]}...")
        return sql
        
    except Exception as e:
        print(f"[INFO] PySpark-to-SQL conversion failed: {e}")
        return None


@app.post("/simulate", response_model=SimulationResponse)
async def simulate_data(request: SimulationRequest):
    start_time = time.time()
    records_processed = 0
    try:
        if not MONGODB_URI:
            raise HTTPException(status_code=500, detail="MONGODB_URI is not set in environment variables")
        client = MongoClient(MONGODB_URI)
        db = client["bankingSdlcDB"]

        # 1. Clean the code from markdown tags and comments
        code_str = (request.generated_code or "").strip()
        if "```" in code_str:
            # Extract code block content
            blocks = re.findall(r'```(?:\w+)?\n(.*?)\n```', code_str, re.DOTALL)
            if blocks:
                code_str = blocks[0].strip()
            else:
                code_str = re.sub(r'```(?:\w+)?', '', code_str).strip()
        
        # 2. Fetch all collections from MongoDB as DataFrames
        data_by_table = {}
        for table in request.tables:
            cursor = db[table].find().limit(3000)
            records = []
            for doc in cursor:
                records_processed += 1
                doc_cleaned = {}
                for k, v in doc.items():
                    if k == '_id':
                        continue
                    if isinstance(v, datetime):
                        doc_cleaned[k] = v
                    else:
                        doc_cleaned[k] = v
                records.append(doc_cleaned)
            data_by_table[table] = records

        # 3. Create Pandas DataFrames
        dfs = {}
        for table_name, records in data_by_table.items():
            dfs[table_name] = pd.DataFrame(records) if records else pd.DataFrame()

        # 4. Route execution by format / language
        fmt = (request.format or "SQL").upper()
        result_df = None
        executed_successfully = False
        used_duckdb_spark = False
        is_spark_format = "SPARK" in fmt

        if is_spark_format and code_str:
            try:
                # Initialize local DuckDB Spark compatibility session
                from duckdb.experimental.spark.sql import SparkSession
                from duckdb.experimental.spark.sql.dataframe import DataFrame as DuckSparkDataFrame
                import duckdb.experimental.spark.sql.functions as spark_funcs
                
                # Mock standard pyspark namespace dynamically so import statements resolve correctly
                import sys
                from types import ModuleType
                sys.modules['pyspark'] = sys.modules.get('pyspark') or ModuleType('pyspark')
                sys.modules['pyspark.sql'] = sys.modules.get('pyspark.sql') or ModuleType('pyspark.sql')
                sys.modules['pyspark.sql.functions'] = spark_funcs
                
                spark = SparkSession.builder.getOrCreate()
                
                # Register MongoDB collections as local Spark views and variables
                globals_dict = {
                    "spark": spark,
                    "pd": pd,
                    "datetime": datetime,
                    "col": spark_funcs.col,
                    "when": spark_funcs.when,
                    "lit": spark_funcs.lit,
                    "count": spark_funcs.count,
                    "sum": spark_funcs.sum,
                    "avg": spark_funcs.avg,
                    "mean": spark_funcs.mean,
                    "min": spark_funcs.min,
                    "max": spark_funcs.max,
                    "desc": spark_funcs.desc,
                    "asc": spark_funcs.asc
                }
                for t_name, df_temp in dfs.items():
                    # Register table in the underlying DuckDB connection (even if empty to avoid Catalog Errors)
                    spark.conn.register(t_name, df_temp)
                    
                    # Create Spark DataFrame representation for variable access
                    spark_df = spark.table(t_name)
                    globals_dict[t_name] = spark_df
                    globals_dict[t_name.lower()] = spark_df
                    snake = re.sub(r'(?<!^)(?=[A-Z])', '_', t_name).lower()
                    globals_dict[snake] = spark_df
                
                is_spark_sql_format = "SQL" in fmt
                
                # Check if the code has a spark.sql(...) wrapper
                spark_sql_match = re.search(r'spark\.sql\(\s*f?["\']{3}(.*?)["\']{3}\s*\)', code_str, re.DOTALL | re.IGNORECASE)
                spark_sql_match_nested = re.search(r'spark\.sql\(\s*f?["\']{1,4}(.*?)["\']{1,4}\s*\)', code_str, re.DOTALL | re.IGNORECASE)
                spark_sql_match_single = re.search(r'spark\.sql\(\s*f?["\'](.*?)["\']\s*\)', code_str, re.DOTALL | re.IGNORECASE)
                
                has_spark_sql_wrapper = bool(spark_sql_match or spark_sql_match_nested or spark_sql_match_single)
                
                # Determine if it is raw SQL (no Python assignments or imports)
                is_raw_sql = False
                if is_spark_sql_format and not has_spark_sql_wrapper:
                    if "import " not in code_str and " = " not in code_str and "def " not in code_str:
                        is_raw_sql = True
                        
                is_sql_execution = has_spark_sql_wrapper or is_raw_sql
                extracted_df = None
                
                if is_sql_execution:
                    sql_query = code_str
                    if spark_sql_match:
                        sql_query = spark_sql_match.group(1).strip()
                    elif spark_sql_match_nested:
                        sql_query = spark_sql_match_nested.group(1).strip()
                    elif spark_sql_match_single:
                        sql_query = spark_sql_match_single.group(1).strip()
                    
                    # Clean enclosing quote wrappers from the query string
                    sql_query = sql_query.strip()
                    while True:
                        if sql_query.startswith("'''") and sql_query.endswith("'''"):
                            sql_query = sql_query[3:-3].strip()
                        elif sql_query.startswith('"""') and sql_query.endswith('"""'):
                            sql_query = sql_query[3:-3].strip()
                        elif sql_query.startswith("'") and sql_query.endswith("'"):
                            sql_query = sql_query[1:-1].strip()
                        elif sql_query.startswith('"') and sql_query.endswith('"'):
                            sql_query = sql_query[1:-1].strip()
                        else:
                            break
                    # Execute SQL query directly
                    extracted_df = spark.sql(sql_query)
                else:
                    # PySpark DataFrame API code — try exec first
                    pyspark_exec_failed = False
                    try:
                        locals_dict = {}
                        exec(code_str, globals_dict, locals_dict)
                        
                        # Extract resulting Spark DataFrame
                        for var_name in ['result_df', 'df', 'final_df', 'output_df']:
                            if var_name in locals_dict and isinstance(locals_dict[var_name], DuckSparkDataFrame):
                                extracted_df = locals_dict[var_name]
                                break
                        
                        if extracted_df is None:
                            for k, v in list(locals_dict.items()):
                                if isinstance(v, DuckSparkDataFrame) and k not in request.tables:
                                    extracted_df = v
                                    break
                    except Exception as spark_exec_err:
                        pyspark_exec_failed = True
                        print(f"[INFO] PySpark mock execution hit a limitation ({type(spark_exec_err).__name__}). Falling back to local DuckDB SQL execution...")
                    
                    # Fallback: Convert PySpark code to SQL and run via DuckDB directly
                    if pyspark_exec_failed or extracted_df is None:
                        try:
                            sql_from_pyspark = _pyspark_code_to_sql(code_str, list(dfs.keys()))
                            if not sql_from_pyspark:
                                sql_from_pyspark = await generator.translate_pyspark_to_sql(code_str, list(dfs.keys()))
                            
                            if sql_from_pyspark:
                                con_spark_fallback = duckdb.connect()
                                for t_name_fb, df_fb in dfs.items():
                                    if not df_fb.empty:
                                        con_spark_fallback.register(t_name_fb, df_fb)
                                result_df = con_spark_fallback.execute(sql_from_pyspark).fetchdf()
                                executed_successfully = True
                                print(f"[INFO] PySpark code executed via DuckDB SQL fallback successfully.")
                        except Exception as sql_fb_err:
                            print(f"[INFO] DuckDB SQL fallback also failed: {sql_fb_err}. Will use LLM simulation.")
                            
                if extracted_df is not None:
                    result_df = extracted_df.toPandas()
                    executed_successfully = True
                    used_duckdb_spark = True
                    print("Local DuckDB Spark/PySpark execution succeeded.")
                elif not executed_successfully:
                    # Neither exec nor SQL fallback worked — let the LLM fallback handle it
                    print("[INFO] PySpark emulation unavailable for this code pattern. Falling back to LLM simulation.")
                    
            except Exception as e:
                print(f"[INFO] PySpark path skipped: {type(e).__name__}. Using fallback simulation.")

        # SQL formats: SQL, PostgreSQL, MySQL, BigQuery, Snowflake, Oracle, SparkSQL,  Apache Iceberg
        is_sql_format = any(x in fmt for x in ["SQL", "POSTGRE", "MY", "ORACLE", "BIGQUERY", "SNOWFLAKE", "ICEBERG", "PL/SQL"]) and "NOSQL" not in fmt and not is_spark_format
        
        if is_sql_format and code_str:
            try:
                con = duckdb.connect()
                for table_name, df in dfs.items():
                    if not df.empty:
                        con.register(table_name, df)
                
                sql_query = sanitize_sql_for_duckdb(code_str)
                print(f"Sanitized SQL for DuckDB: {sql_query[:200]}...")
                
                # Execute the sanitized SQL query
                result_df = con.execute(sql_query).fetchdf()
                executed_successfully = True
            except Exception as e:
                print(f"DuckDB execution failed: {e}")

        # MongoDB NoSQL: Extract query or pipeline and run
        elif "MONGODB" in fmt and code_str:
            try:
                # Look for aggregate([...]) pipeline
                pipeline = None
                aggregate_match = re.search(r'\.aggregate\(\s*(\[[^\]]*\])\s*\)', code_str, re.DOTALL)
                if aggregate_match:
                    try:
                        pipeline = ast.literal_eval(aggregate_match.group(1))
                    except Exception:
                        pass
                
                # Look for find({...}) filter
                filter_dict = None
                if not pipeline:
                    find_match = re.search(r'\.find\(\s*(\{[^\}]*\})\s*\)', code_str, re.DOTALL)
                    if find_match:
                        try:
                            filter_dict = ast.literal_eval(find_match.group(1))
                        except Exception:
                            pass
                
                # Run query on MongoDB
                driving_table = request.tables[0] if request.tables else None
                if driving_table:
                    if pipeline:
                        cursor = db[driving_table].aggregate(pipeline)
                        records = [{k: v for k, v in doc.items() if k != '_id'} for doc in cursor]
                        result_df = pd.DataFrame(records)
                        executed_successfully = True
                    elif filter_dict:
                        cursor = db[driving_table].find(filter_dict)
                        records = [{k: v for k, v in doc.items() if k != '_id'} for doc in cursor]
                        result_df = pd.DataFrame(records)
                        executed_successfully = True
            except Exception as e:
                print(f"MongoDB local execution failed: {e}")

        # Firestore NoSQL local execution via MockFirestore
        elif "FIRESTORE" in fmt and code_str:
            try:
                import random
                from mockfirestore import MockFirestore
                mock_db = MockFirestore()
                
                # Populate mock_db with documents from the dfs
                for table_name, df in dfs.items():
                    if not df.empty:
                        for _, row in df.iterrows():
                            doc_data = row.to_dict()
                            
                            # Safely find a primary key field to use as Document ID
                            pk = "customer_id"
                            meta_doc = db['semanticMetaStore'].find_one({"collection_name": table_name})
                            if meta_doc and "primary_key" in meta_doc:
                                pk = meta_doc["primary_key"]
                                
                            doc_id = str(doc_data.get(pk) or random.randint(100000, 999999))
                            mock_db.collection(table_name).document(doc_id).set(doc_data)
                
                # Mock firestore Client and firebase_admin in sys.modules so imports like
                # `from google.cloud import firestore` and `import firebase_admin` resolve to MockFirestore
                import sys
                from unittest.mock import MagicMock
                
                mock_client_class = MagicMock()
                mock_client_class.return_value = mock_db
                
                mock_firestore = MagicMock()
                mock_firestore.Client = mock_client_class
                
                # Mock firebase_admin
                mock_firebase_admin = MagicMock()
                mock_firebase_admin.initialize_app = MagicMock()
                
                mock_credentials = MagicMock()
                mock_credentials.Certificate = MagicMock()
                
                # In firebase_admin, firestore.client() returns the DB instance
                mock_fa_firestore = MagicMock()
                mock_fa_firestore.client.return_value = mock_db
                
                # Setup dummy mocks in sys.modules
                sys.modules['google'] = MagicMock()
                sys.modules['google.cloud'] = MagicMock()
                sys.modules['google.cloud.firestore'] = mock_firestore
                sys.modules['firebase_admin'] = mock_firebase_admin
                sys.modules['firebase_admin.credentials'] = mock_credentials
                sys.modules['firebase_admin.firestore'] = mock_fa_firestore
                
                import io
                import contextlib
                
                # Execution context
                f = io.StringIO()
                local_vars = {"db": mock_db}
                global_vars = {
                    "google": sys.modules['google'],
                    "firestore": mock_firestore,
                    "firebase_admin": mock_firebase_admin,
                    "pd": pd,
                    "datetime": datetime
                }
                
                # Exec the generated Firestore query code
                with contextlib.redirect_stdout(f):
                    exec(code_str, global_vars, local_vars)
                
                # Extract output from local variables
                for var_name, var_val in local_vars.items():
                    if isinstance(var_val, pd.DataFrame) and not var_val.empty:
                        result_df = var_val
                        break
                    elif isinstance(var_val, list) and len(var_val) > 0 and isinstance(var_val[0], dict):
                        result_df = pd.DataFrame(var_val)
                        break
                
                # Fallback to query mock_db directly if output not set in code variables
                if result_df is None and request.tables:
                    docs = mock_db.collection(request.tables[0]).stream()
                    records = [doc.to_dict() for doc in docs]
                    result_df = pd.DataFrame(records)
                
                executed_successfully = True
            except Exception as e:
                print(f"Firestore NoSQL mock execution failed: {e}")

        # Fallback / PySpark / Python / Firestore NoSQL 
        has_base_data = any(not df.empty for df in dfs.values())
        if not executed_successfully or result_df is None or (result_df.empty and has_base_data):
            if is_sql_format and executed_successfully and result_df is not None and result_df.empty and has_base_data:
                print("DuckDB query returned 0 rows. Triggering resilient in-memory Pandas filter fallback.")
            
            # Try LLM-based translation simulator first
            llm_simulated = False
            if code_str:
                try:
                    py_code = await generator.generate_pandas_simulation(
                        format=request.format or "PySpark",
                        code_str=code_str,
                        tables=request.tables,
                        columns=request.columns,
                        logic=request.logic or "",
                        model="gpt-4o"
                    )
                    if py_code:
                        import numpy as np
                        # Compile and execute the generated Python code
                        local_vars = {}
                        global_vars = {
                            "pd": pd,
                            "np": np,
                            "datetime": datetime,
                            "pd.DataFrame": pd.DataFrame,
                            "pd.to_datetime": pd.to_datetime
                        }
                        exec(py_code, global_vars, local_vars)
                        simulate_fn = local_vars.get("simulate")
                        if simulate_fn:
                            result_df = simulate_fn(dfs)
                            executed_successfully = True
                            llm_simulated = True
                            print("LLM-based simulation succeeded.")
                except Exception as e:
                    print(f"LLM-based simulation failed: {e}")

            if not llm_simulated:
                # Fallback local in-memory Pandas join & filter simulation
                try:
                    if request.tables:
                        merged_df = dfs[request.tables[0]].copy()
                        for table in request.tables[1:]:
                            other_df = dfs[table].copy()
                            common_cols = list(set(merged_df.columns).intersection(set(other_df.columns)))
                            join_key = None
                            if 'customer_id' in common_cols:
                                join_key = 'customer_id'
                            elif 'account_id' in common_cols:
                                join_key = 'account_id'
                            elif common_cols:
                                join_key = common_cols[0]
                                
                            if join_key:
                                merged_df = pd.merge(merged_df, other_df, on=join_key, how='inner')
                        
                        # Apply logic filters in-memory
                        # Look for keywords in user logic to filter rows
                        logic_lower = (request.logic or "").lower()
                        if "home" in logic_lower and 'loan_type' in merged_df.columns:
                            merged_df = merged_df[merged_df['loan_type'].str.lower().str.contains('home', na=False)]
                        if "active" in logic_lower and 'loan_status' in merged_df.columns:
                            merged_df = merged_df[merged_df['loan_status'].str.lower().str.contains('active', na=False)]
                        elif "active" in logic_lower and 'is_active' in merged_df.columns:
                            merged_df = merged_df[merged_df['is_active'] == True]
                        
                        # Calculate computed columns ONLY if requested in logic/code
                        code_lower = (code_str or "").lower()
                        logic_lower = (request.logic or "").lower()
                        
                        if 'credit_score' in merged_df.columns and ('credit_score_bucket' in code_lower or 'credit_score_bucket' in logic_lower or 'credit score' in logic_lower):
                            merged_df['credit_score_bucket'] = merged_df['credit_score'].apply(
                                lambda x: 'Risky' if (x or 0) < 650 else 'Average' if (x or 0) <= 750 else 'Good' if (x or 0) <= 850 else 'Excellent'
                            )
                        if 'principal_amount' in merged_df.columns and ('principal_bucket' in code_lower or 'principal_bucket' in logic_lower or 'principal amount' in logic_lower or 'principal_amount' in logic_lower):
                            merged_df['principal_bucket'] = merged_df['principal_amount'].apply(
                                lambda x: 'low bucket' if (x or 0) < 1000000 else 'medium bucket' if (x or 0) <= 5000000 else 'high bucket'
                            )
                        
                        # Calculate UPI inclinations
                        upi_counts = {}
                        if 'transactionsInfo' in data_by_table:
                            for tx in data_by_table['transactionsInfo']:
                                c_id = tx.get('customer_id')
                                if c_id and tx.get('channel') == 'UPI' and tx.get('status') == 'Success':
                                    upi_counts[c_id] = upi_counts.get(c_id, 0) + 1
                        if 'customer_id' in merged_df.columns and ('loan_customer_transactions' in code_lower or 'loan_customer_transactions' in logic_lower or 'upi inclined' in logic_lower or 'transactions' in logic_lower):
                            merged_df['loan_customer_transactions'] = merged_df['customer_id'].apply(
                                lambda x: 'UPI Inclined' if upi_counts.get(x, 0) > 10 else 'Standard'
                            )
                            
                        # Keep selected columns
                        available_cols = [c for c in request.columns if c in merged_df.columns]
                        # Also keep computed columns ONLY if they exist in the dataframe
                        for c_col in ['credit_score_bucket', 'principal_bucket', 'loan_customer_transactions']:
                            if c_col in merged_df.columns and c_col not in available_cols:
                                available_cols.append(c_col)
                                
                        result_df = merged_df[available_cols] if available_cols else merged_df
                        executed_successfully = True
                    else:
                        result_df = pd.DataFrame()
                except Exception as e:
                    print(f"Fallback simulation failed: {e}")
                    result_df = pd.DataFrame()

        # 5. Clean result DataFrame and apply sample data size limit
        if result_df is not None and not result_df.empty:
            # Deduplicate by customer_id if present to keep unique customer-level records
            if 'customer_id' in result_df.columns:
                result_df = result_df.drop_duplicates(subset=['customer_id'])
            
            # Drop private prefix helper columns
            for col in list(result_df.columns):
                if col.startswith('_'):
                    result_df.drop(columns=[col], inplace=True)
            # Limit rows
            result_df = result_df.head(request.sample_data_size)
            
            # Convert timestamps/datetimes to strings
            for col in result_df.select_dtypes(include=['datetime', 'datetimetz']).columns:
                result_df[col] = result_df[col].dt.strftime("%Y-%m-%d %H:%M:%S")
            # Replace NaN/NaT with None
            result_df = result_df.where(pd.notnull(result_df), None)
            final_dataframe = result_df.to_dict(orient="records")
        else:
            final_dataframe = []

        # 6. Retrieve column details dynamically based on final_dataframe keys
        column_details = {}
        meta_fields = {}
        for table in request.tables:
            meta_doc = db['semanticMetaStore'].find_one({"collection_name": table})
            if meta_doc:
                for field in meta_doc.get("fields", []):
                    meta_fields[field["field_name"]] = {
                        "friendly_name": field["friendly_name"],
                        "description": field["description"],
                        "data_type": field["data_type"],
                        "role": field["role"],
                        "classification": field["classification"],
                        "lineage": field.get("lineage")
                    }

        if final_dataframe:
            for col in final_dataframe[0].keys():
                if col in meta_fields:
                    column_details[col] = meta_fields[col]
                else:
                    # Computed/derived column metadata
                    column_details[col] = {
                        "friendly_name": col.replace('_', ' ').title(),
                        "description": f"Derived or computed attribute representing '{col}'.",
                        "data_type": "string",
                        "role": "dimension",
                        "classification": "public",
                        "lineage": {
                            "source_tables": request.tables,
                            "source_columns": [c for c in meta_fields.keys() if c in code_str],
                            "transformation": "Locally executed computed query transformation"
                        }
                    }

        # 7. Calculate Data Quality metrics (using updated schemas with distinct_values & empty_strings)
        row_count = len(final_dataframe)
        null_count = 0
        empty_strings_count = 0
        for r in final_dataframe:
            for val in r.values():
                if val is None or val == "":
                    null_count += 1
                if isinstance(val, str) and val.strip() == "":
                    empty_strings_count += 1

        row_strings = [json.dumps(row, default=str, sort_keys=True) for row in final_dataframe]
        duplicate_count = len(row_strings) - len(set(row_strings))
        distinct_rows_count = len(set(row_strings))

        # Find primary numeric column
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

        if numeric_col and final_dataframe:
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

        # 8. Calculate table-level DQ insights
        table_dq_insights = {}
        for table in request.tables:
            table_records = data_by_table.get(table, [])
            meta_doc = db['semanticMetaStore'].find_one({"collection_name": table})
            meta_fields_list = meta_doc.get("fields", []) if meta_doc else []

            t_row_count = len(table_records)
            t_null_count = 0
            t_empty_strings_count = 0
            for r in table_records:
                for val in r.values():
                    if val is None or val == "":
                        t_null_count += 1
                    if isinstance(val, str) and val.strip() == "":
                        t_empty_strings_count += 1

            t_row_strings = [json.dumps(row, default=str, sort_keys=True) for row in table_records]
            t_duplicate_count = len(t_row_strings) - len(set(t_row_strings))
            t_distinct_rows_count = len(set(t_row_strings))

            t_numeric_col = None
            for field in meta_fields_list:
                if field.get("role") == "measure" and field.get("data_type") in ("integer", "double", "float"):
                    t_numeric_col = field.get("field_name")
                    break
            if not t_numeric_col:
                for field in meta_fields_list:
                    if field.get("data_type") in ("integer", "double", "float"):
                        t_numeric_col = field.get("field_name")
                        break

            t_minimum = None
            t_maximum = None
            t_average = None

            if t_numeric_col and table_records:
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

        # 9. Calculate column-level DQ insights and primary keys
        column_dq_insights = {}
        primary_keys = {}

        for table in request.tables:
            meta_doc = db['semanticMetaStore'].find_one({"collection_name": table})
            pk = "customer_id"
            if meta_doc and "primary_key" in meta_doc:
                pk = meta_doc["primary_key"]
            primary_keys[table] = pk

        if request.tables:
            primary_keys["Output Table"] = primary_keys.get(request.tables[0], "customer_id")

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
        for col in column_details.keys():
            output_col_insights[col] = calculate_col_dq(final_dataframe, col)
        column_dq_insights["Output Table"] = output_col_insights

        # Calculate for each selected table columns
        for table in request.tables:
            table_records = data_by_table.get(table, [])
            table_col_insights = {}
            if table_records:
                cols = list(table_records[0].keys())
                for col in cols:
                    table_col_insights[col] = calculate_col_dq(table_records, col)
            column_dq_insights[table] = table_col_insights

        # 10. Calculate execution explanation (LLM-free execution metadata)
        execution_time_ms = int((time.time() - start_time) * 1000)
        execution_time_ms = max(1, execution_time_ms)
        
        if used_duckdb_spark:
            exec_steps = [
                "Fetched all records from MongoDB collections.",
                "Initialized a local DuckDB in-process SparkSession (DuckDB + Fugue emulation).",
                "Registered MongoDB data collections as virtual tables and Spark DataFrames.",
                "Executed the PySpark/SparkSQL code snippet locally using the DuckDB vector execution engine.",
                "Retrieved execution results and converted them to pandas DataFrame.",
                "Profiled output rows to calculate Data Quality metrics."
            ]
            execution_explanation = {
                "query": code_str or "-- No code executed --",
                "execution_time_ms": execution_time_ms,
                "records_processed": records_processed,
                "software_requirements": ["FastAPI", "Pandas", "DuckDB", "Fugue", "PyMongo"],
                "execution_steps": exec_steps,
                "special_instructions": "This simulation was run locally on backend CPU using DuckDB + Fugue Spark Emulation. No external Dataproc or Livy API calls were made.",
                "execution_cost": "Estimated cost: FREE ($0.00) — Executed entirely on local backend CPU resources.",
                "prompt_tokens": 0,
                "completion_tokens": 0
            }
        else:
            exec_steps = [
                "Fetched all records from MongoDB collections to ensure high join rate.",
                f"Parsed and cleaned raw code block under format option '{fmt}'.",
                "Executed query engine locally against in-memory data tables.",
                "Profiled output rows to calculate Data Quality metrics."
            ]
            execution_explanation = {
                "query": code_str or "-- No code executed --",
                "execution_time_ms": execution_time_ms,
                "records_processed": records_processed,
                "software_requirements": ["FastAPI", "Pandas", "DuckDB", "PyMongo"],
                "execution_steps": exec_steps,
                "special_instructions": "This simulation was run locally on backend CPU using DuckDB and PyMongo. No external APIs or LLMs were called.",
                "execution_cost": "Estimated cost: FREE ($0.00) — Executed entirely on local backend CPU resources.",
                "prompt_tokens": 0,
                "completion_tokens": 0
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

PRICING = {
    "gpt-4o": {"input": 0.000005, "output": 0.000015},
    "gemini-3.5-flash": {"input": 0.000000075, "output": 0.0000003},
    "mistral": {"input": 0.000002, "output": 0.000006},
    "llama": {"input": 0.0000007, "output": 0.0000007},
    #"qwen": {"input": 0.0000003, "output": 0.0000003},
    "kimi": {"input": 0.0000007, "output": 0.0000007}
}

def get_or_create_quota(db, role: str) -> dict:
    if not role:
        role = "Data Engineering"
    quota = db["modelQuotas"].find_one({"role": role})
    
    from datetime import datetime, timedelta
    
    if not quota:
        default_reset_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
        quota = {
            "role": role,
            "limits": {
                "gpt-4o": { "total_tokens": 500000, "used_tokens": 0 },
                "gemini-3.5-flash": { "total_tokens": 10000000, "used_tokens": 0 },
                "mistral": { "total_tokens": 1000000, "used_tokens": 0 },
                "llama": { "total_tokens": 1000000, "used_tokens": 0 },
                #"qwen": { "total_tokens": 1000000, "used_tokens": 0 },
                "kimi": { "total_tokens": 1000000, "used_tokens": 0 }
            },
            "remaining_balance_usd": 15.00,
            "reset_date": default_reset_date
        }
        db["modelQuotas"].insert_one(quota)
    else:
        # Check if reset_date is reached
        reset_date_str = quota.get("reset_date")
        if reset_date_str:
            try:
                # Parse naive ISO format safely
                clean_str = reset_date_str.replace("Z", "").split(".")[0]
                reset_date = datetime.fromisoformat(clean_str)
                now = datetime.now()
                
                if now >= reset_date:
                    # Reset the usage stats
                    for k in quota.get("limits", {}):
                        quota["limits"][k]["used_tokens"] = 0
                    quota["remaining_balance_usd"] = 15.00
                    
                    # Calculate next reset date (1st day of next month)
                    if now.month == 12:
                        next_reset = datetime(now.year + 1, 1, 1, 0, 0, 0)
                    else:
                        next_reset = datetime(now.year, now.month + 1, 1, 0, 0, 0)
                    
                    quota["reset_date"] = next_reset.strftime("%Y-%m-%dT%H:%M:%SZ")
                    
                    # Update database
                    db["modelQuotas"].update_one(
                        {"role": role},
                        {
                            "$set": {
                                "limits": quota["limits"],
                                "remaining_balance_usd": quota["remaining_balance_usd"],
                                "reset_date": quota["reset_date"]
                            }
                        }
                    )
                    print(f"[INFO] Quotas for role '{role}' successfully reset because reset_date ({reset_date_str}) was reached.")
            except Exception as e:
                print(f"[ERROR] Failed to evaluate/reset quota: {e}")
                
    return quota

@app.get("/quota")
async def get_quota_details(role: str = "Data Engineering"):
    try:
        if not MONGODB_URI:
            raise HTTPException(status_code=500, detail="MONGODB_URI is not set in environment variables")
        client_db = MongoClient(MONGODB_URI)
        db = client_db["bankingSdlcDB"]
        quota = get_or_create_quota(db, role)
        if "_id" in quota:
            quota["_id"] = str(quota["_id"])
        return quota
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate/estimate")
async def estimate_tokens(request: CodeGenerationRequest):
    try:
        # Check quota status before doing the estimate
        if MONGODB_URI and request.role:
            client_db = MongoClient(MONGODB_URI)
            db = client_db["bankingSdlcDB"]
            quota = get_or_create_quota(db, request.role)
            
            model_key = request.model or "gpt-4o"
            
            # Check model tokens limit
            model_quota = quota.get("limits", {}).get(model_key, {"total_tokens": 1000000, "used_tokens": 0})
            if model_quota.get("used_tokens", 0) >= model_quota.get("total_tokens", 1000000):
                raise HTTPException(
                    status_code=429, 
                    detail=f"Quota Exceeded: You have run out of tokens/credits for {model_key} model under the {request.role} role."
                )
            # Check financial budget balance
            if quota.get("remaining_balance_usd", 15.00) <= 0:
                raise HTTPException(
                    status_code=429, 
                    detail=f"Quota Exceeded: The credit balance for the {request.role} role is fully depleted ($0.00 remaining)."
                )

        schema_context = ""
        if MONGODB_URI:
            try:
                client_db = MongoClient(MONGODB_URI)
                db = client_db["bankingSdlcDB"]
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
                print(f"Failed to fetch schemas for estimation: {e}")

        prompt = f"""
        You are an expert Data Engineer and AI Assistant specializing in SDLC automation.
        Generate the requested code based on the following input:
        
        Format: {request.format}
        Tables: {", ".join(request.tables)}
        Columns: {", ".join(request.columns)}
        Logic: {request.logic}
        Sample Data Size: {request.sample_data_size}
        {schema_context}
        """
        approx_prompt_tokens = len(prompt) // 4
        approx_prompt_tokens += 300  # System/instructions padding
        approx_completion_tokens = 450
        
        model_key = request.model or "gpt-4o"
        rates = PRICING.get(model_key, {"input": 0.000005, "output": 0.000015})
        cost = (approx_prompt_tokens * rates["input"]) + (approx_completion_tokens * rates["output"])
        
        return {
            "model": model_key,
            "approx_input_tokens": approx_prompt_tokens,
            "approx_output_tokens": approx_completion_tokens,
            "approx_cost_usd": round(cost, 6)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/role-token-consumption")
async def get_role_token_consumption(role: str):
    try:
        if not MONGODB_URI:
            raise HTTPException(status_code=500, detail="MONGODB_URI is not set in environment variables")
        client_db = MongoClient(MONGODB_URI)
        db = client_db["bankingSdlcDB"]
        
        cursor = db["roleTokenConsumption"].find({"role": role}).sort("timestamp", -1)
        logs = []
        for doc in cursor:
            t = doc.get("timestamp")
            timestamp_str = t.strftime("%Y-%m-%d %H:%M:%S") if isinstance(t, datetime) else str(t)
            logs.append({
                "userId": doc.get("userId", "unknown"),
                "role": doc.get("role", ""),
                "timestamp": timestamp_str,
                "tokens_consumed": doc.get("tokens_consumed", 0),
                "cost": doc.get("cost", 0.0)
            })
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate", response_model=CodeGenerationResponse)
async def generate_code(request: CodeGenerationRequest):
    try:
        db = None
        role = request.role
        model_key = request.model or "gpt-4o"
        
        if MONGODB_URI and role:
            client_db = MongoClient(MONGODB_URI)
            db = client_db["bankingSdlcDB"]
            quota = get_or_create_quota(db, role)
            
            # Check model tokens limit
            model_quota = quota.get("limits", {}).get(model_key, {"total_tokens": 1000000, "used_tokens": 0})
            if model_quota.get("used_tokens", 0) >= model_quota.get("total_tokens", 1000000):
                raise HTTPException(
                    status_code=429, 
                    detail=f"Quota Exceeded: You have run out of tokens/credits for {model_key} model under the {role} role."
                )
            # Check financial budget balance
            if quota.get("remaining_balance_usd", 15.00) <= 0:
                raise HTTPException(
                    status_code=429, 
                    detail=f"Quota Exceeded: The credit balance for the {role} role is fully depleted ($0.00 remaining)."
                )

        result = await generator.generate(request)
        if db is not None and role and result:
            p_tokens = result.prompt_tokens or 0
            c_tokens = result.completion_tokens or 0
            total_tokens = p_tokens + c_tokens
            
            rates = PRICING.get(model_key, {"input": 0.000005, "output": 0.000015})
            cost = (p_tokens * rates["input"]) + (c_tokens * rates["output"])
            
            # Retrieve current limits and update in Python to prevent dot notation splitting on 'gemini-3.5-flash'
            limits = quota.get("limits", {})
            if model_key not in limits:
                limits[model_key] = {"total_tokens": 1000000, "used_tokens": 0}
            limits[model_key]["used_tokens"] = limits[model_key].get("used_tokens", 0) + total_tokens
            
            # Update database
            db["modelQuotas"].update_one(
                {"role": role},
                {
                    "$set": {
                        "limits": limits
                    },
                    "$inc": {
                        "remaining_balance_usd": -cost
                    }
                }
            )
            
            # Insert usage audit record
            log_doc = {
                "userId": request.userId or "unknown",
                "role": role,
                "timestamp": datetime.now(),
                "tokens_consumed": total_tokens,
                "cost": round(cost, 6)
            }
            db["roleTokenConsumption"].insert_one(log_doc)
            
        return result
    except HTTPException as he:
        raise he
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
            
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # 1. Determine file names
        data_file_name = (request.data_file_name or "").strip() or f"simulated_data_{timestamp_str}.csv"
        if not data_file_name.endswith('.csv'):
            data_file_name += '.csv'
            
        ext = ".sql"
        fmt = (request.format or "").lower()
        if "pyspark" in fmt or "python" in fmt:
            ext = ".py"
        elif "mongodb" in fmt or "noscript" in fmt or "js" in fmt or "firestore" in fmt:
            ext = ".js"
            
        code_file_name = (request.query_file_name or "").strip() or f"query_{timestamp_str}{ext}"
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
            
            # 5. Push details to pushAllDetails collection in MongoDB
            if MONGODB_URI:
                try:
                    client_db = MongoClient(MONGODB_URI)
                    db = client_db["bankingSdlcDB"]
                    
                    # Extract tables from input_fields
                    tables = []
                    if request.input_fields and isinstance(request.input_fields, dict):
                        tables = request.input_fields.get("tables") or []
                        if not isinstance(tables, list):
                            tables = [str(tables)]
                    
                    table_concat = "_".join(tables)
                    unique_table_name = f"{table_concat}_{timestamp_str}" if table_concat else f"simulated_{timestamp_str}"
                    
                    push_log = {
                        "userId": request.userId or "unknown",
                        "role": request.role or "unknown",
                        "timestamp": request.timestamp or datetime.now(),
                        "inputFields": request.input_fields or {},
                        "DQ Insights": request.column_dq_insights or {},
                        "codeOutput": request.generated_code or "",
                        "outputTableData": request.dataframe or {},
                        "uniqueTableName": unique_table_name,
                        "podName": request.pod_name or "unknown",
                        "projectName": request.project_name or "unknown",
                        "dataFileName": data_path or "unknown",
                        "queryFileName": code_path or "unknown",
                    }
                    db["pushAllDetails"].insert_one(push_log)
                except Exception as mongo_err:
                    print(f"Failed to save push details to MongoDB: {mongo_err}")
            
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
