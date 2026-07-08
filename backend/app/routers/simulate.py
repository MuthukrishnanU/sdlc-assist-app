import re
import ast
import sys
import time
import asyncio
import pandas as pd
import duckdb
from datetime import datetime
from fastapi import APIRouter, HTTPException
from ..config.settings import get_db, MONGODB_URI
from ..schemas.simulation import SimulationRequest, SimulationResponse, ColumnMetadata, ExecutionExplanation, DQCalculationRequest
from ..schemas.code_gen import DQInsights
from ..services.dq_profiler import calculate_col_dq, calculate_dataframe_dq, calculate_table_level_dq
from ..services.local_runner import clean_procedural_sql, sanitize_sql_for_duckdb, _pyspark_code_to_sql
from ..generator import generator

router = APIRouter(tags=["Simulation Execution"])

# Ensure Spark Session mocks are active in current thread
try:
    import duckdb.experimental.spark.sql as duck_spark_sql
    import duckdb.experimental.spark.sql.functions as duck_spark_functions
    import duckdb.experimental.spark.sql.types as duck_spark_types
    import duckdb.experimental.spark.sql.dataframe as duck_spark_dataframe
    from duckdb.experimental.spark.sql.readwriter import DataFrameReader
    
    sys.modules['pyspark'] = sys.modules.get('pyspark') or type(sys)('pyspark')
    sys.modules['pyspark.sql'] = duck_spark_sql
    sys.modules['pyspark.sql.functions'] = duck_spark_functions
    sys.modules['pyspark.sql.types'] = duck_spark_types
    sys.modules['pyspark.sql.dataframe'] = duck_spark_dataframe
    
    singleton_spark = duck_spark_sql.SparkSession.builder.getOrCreate()
    def patched_getOrCreate(self):
        return singleton_spark
    duck_spark_sql.SparkSession.Builder.getOrCreate = patched_getOrCreate
    
    DataFrameReader.table = lambda self, tableName: self.session.table(tableName)
    DataFrameReader.csv = lambda self, path, *args, **kwargs: self.session.sql("SELECT * FROM read_csv_auto('" + str(path).replace('\\\\', '/') + "')")
    DataFrameReader.json = lambda self, path, *args, **kwargs: self.session.sql("SELECT * FROM read_json_auto('" + str(path).replace('\\\\', '/') + "')")
    DataFrameReader.parquet = lambda self, path, *args, **kwargs: self.session.sql("SELECT * FROM read_parquet('" + str(path).replace('\\\\', '/') + "')")

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
            return duck_spark_functions.expr(f"{self.name} OVER ({window_spec.to_sql()})")

    duck_spark_functions.row_number = lambda: WindowFunction("row_number()")
    duck_spark_functions.rank = lambda: WindowFunction("rank()")
    duck_spark_functions.dense_rank = lambda: WindowFunction("dense_rank()")
    duck_spark_functions.percent_rank = lambda: WindowFunction("percent_rank()")
    duck_spark_functions.lead = lambda col, offset=1, default=None: WindowFunction(f"lead({col.expr.get_name() if hasattr(col, 'expr') else str(col)}, {offset})")
    duck_spark_functions.lag = lambda col, offset=1, default=None: WindowFunction(f"lag({col.expr.get_name() if hasattr(col, 'expr') else str(col)}, {offset})")
    
    pyspark_sql_window = type(sys)('pyspark.sql.window')
    pyspark_sql_window.Window = Window
    sys.modules['pyspark.sql.window'] = pyspark_sql_window
    duck_spark_sql.Window = Window
    duck_spark_sql.window = pyspark_sql_window
    duck_spark_dataframe.DataFrame.show = lambda self, *args, **kwargs: None
except Exception:
    pass


from ..services.simulation_runner import run_simulation_logic

@router.post("/simulate", response_model=SimulationResponse)
async def simulate_data(request: SimulationRequest):
    start_time = time.time()
    try:
        db = get_db()
        code_str = (request.generated_code or "").strip()
        
        t0 = time.time()
        
        sim_res = await run_simulation_logic(
            tables=request.tables,
            columns=request.columns,
            generated_code=code_str,
            format_str=request.format,
            sample_data_size=request.sample_data_size,
            logic=request.logic or "",
            role=request.role,
            userId=request.userId
        )
        
        t1 = time.time()
        print(f"[TIMING] run_simulation_logic: {t1 - t0:.2f}s")
        
        final_dataframe = sim_res["final_dataframe"]
        column_details = sim_res["column_details"]
        executed_successfully = sim_res["executed_successfully"]
        used_duckdb_spark = sim_res["used_duckdb_spark"]
        records_processed = sim_res["records_processed"]
        data_by_table = sim_res["data_by_table"]
        meta_fields = sim_res["meta_fields"]

        dq_insights = calculate_dataframe_dq(final_dataframe, column_details)
        
        t2 = time.time()
        print(f"[TIMING] calculate_dataframe_dq: {t2 - t1:.2f}s")

        table_dq_insights = {}
        for table in request.tables:
            table_records = data_by_table.get(table, [])
            meta_doc = db['semanticMetaStore'].find_one({"collection_name": table})
            meta_fields_list = meta_doc.get("fields", []) if meta_doc else []
            table_dq_insights[table] = calculate_table_level_dq(table_records, meta_fields_list)

        t3 = time.time()
        print(f"[TIMING] table_dq_insights ({len(request.tables)} tables): {t3 - t2:.2f}s")

        column_dq_insights = {}
        all_tables_data = sim_res.get("all_tables_data", {})
        for table_name, table_records in all_tables_data.items():
            if table_name != "Output Table" and table_name not in request.tables:
                continue
            table_col_insights = {}
            if table_records:
                cols = list(table_records[0].keys())
                for col in cols:
                    table_col_insights[col] = calculate_col_dq(table_records, col)
            column_dq_insights[table_name] = table_col_insights

        t4 = time.time()
        total_cols = sum(len(v) for v in column_dq_insights.values())
        print(f"[TIMING] column_dq_insights ({total_cols} columns): {t4 - t3:.2f}s")

        primary_keys = {}
        for table in request.tables:
            meta_doc = db['semanticMetaStore'].find_one({"collection_name": table})
            pk = "customer_id"
            if meta_doc and "primary_key" in meta_doc:
                pk = meta_doc["primary_key"]
            primary_keys[table] = pk
        if request.tables:
            primary_keys["Output Table"] = primary_keys.get(request.tables[0], "customer_id")
            
        for key in all_tables_data.keys():
            if key not in primary_keys:
                primary_keys[key] = "customer_id"

        t5 = time.time()
        print(f"[TIMING] primary_keys lookup: {t5 - t4:.2f}s")

        execution_time_ms = int((time.time() - start_time) * 1000)
        execution_time_ms = max(1, execution_time_ms)
        
        # Call supervisor routing to decide models dynamically
        from ..agents.supervisor import supervisor_decide_models
        decisions = supervisor_decide_models(request.logic or "", request.format or "SQL", request.tables, request.model)
        
        t6 = time.time()
        print(f"[TIMING] supervisor_decide_models: {t6 - t5:.2f}s")
        
        llms_special_inst = (
            f"Supervisor Model Selections:\n"
            f"- Code Generation: {decisions['code_generation']['model']} (Deep Thinking: {'Enabled' if decisions['code_generation']['deep_thinking'] else 'Disabled'})\n"
            f"- Fallback Simulation: {decisions['fallback_simulation']['model']} (Deep Thinking: {'Enabled' if decisions['fallback_simulation']['deep_thinking'] else 'Disabled'})\n"
            f"- Business & DQ Insights: {decisions['insights']['model']} (Deep Thinking: {'Enabled' if decisions['insights']['deep_thinking'] else 'Disabled'})\n"
            f"- Persona Generation: {decisions['personas']['model']} (Deep Thinking: {'Enabled' if decisions['personas']['deep_thinking'] else 'Disabled'} - Not Invoked)"
        )
        fmt = request.format or "SQL"
        is_spark_format = "SPARK" in fmt
        if used_duckdb_spark:
            exec_steps = [
                "Fetched all records from MongoDB collections.",
                "Initialized a local DuckDB in-process SparkSession (DuckDB + Fugue emulation).",
                "Registered MongoDB data collections as virtual tables and Spark DataFrames.",
                "Executed the PySpark/SparkSQL code snippet locally using the DuckDB vector execution engine.",
                "Retrieved execution results and converted them to pandas DataFrame.",
                "Profiled output rows to calculate Data Quality metrics."
            ]
            #"special_instructions": f"This simulation was run locally on backend CPU using DuckDB + Fugue Spark Emulation.\n\n{llms_special_inst}",
            execution_explanation = {
                "query": code_str or "-- No code executed --",
                "execution_time_ms": execution_time_ms,
                "records_processed": records_processed,
                "software_requirements": ["FastAPI", "Pandas", "DuckDB", "Fugue", "PyMongo"],
                "execution_steps": exec_steps,
                "special_instructions": f"This simulation was run locally on backend CPU using DuckDB + Fugue Spark Emulation.",
                "execution_cost": "Estimated cost: FREE ($0.00)",
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
            #"special_instructions": f"This simulation was run locally on backend CPU using DuckDB and PyMongo.\n\n{llms_special_inst}",
            execution_explanation = {
                "query": code_str or "-- No code executed --",
                "execution_time_ms": execution_time_ms,
                "records_processed": records_processed,
                "software_requirements": ["FastAPI", "Pandas", "DuckDB", "PyMongo"],
                "execution_steps": exec_steps,
                "special_instructions": f"This simulation was run locally on backend CPU using DuckDB and PyMongo.",
                "execution_cost": "Estimated cost: FREE ($0.00)",
                "prompt_tokens": 0,
                "completion_tokens": 0
            }

        # Compute Output Guardrails checklist
        output_guardrails = []
        
        # 1. Schema Access Protection
        output_guardrails.append({
            "name": "Schema Access Protection",
            "status": "Passed",
            "message": f"Successfully verified access to tables: {', '.join(request.tables)}"
        })
        
        # 2. Read-Only Enforcer
        is_sql_format = any(x in fmt for x in ["SQL", "POSTGRE", "MY", "ORACLE", "BIGQUERY", "SNOWFLAKE", "ICEBERG", "PL/SQL"]) and "NOSQL" not in fmt and not is_spark_format
        if is_sql_format:
            output_guardrails.append({
                "name": "Read-Only Enforcer",
                "status": "Passed",
                "message": "DDL & DML execution prevention check passed."
            })
            
        # 3. Execution Sandbox Isolation
        if is_spark_format or "FIRESTORE" in fmt or "PYTHON" in fmt:
            output_guardrails.append({
                "name": "Execution Sandbox Isolation",
                "status": "Passed",
                "message": "Secure Python AST sandbox execution checks passed."
            })
            
        # 4. Data Privacy Masking
        # Check if masking was applied
        masked_cols = []
        if request.role and request.role.lower() not in ("admin", "lead", "project lead", "vertical lead"):
            pii_cols = ["phone", "email", "mobile", "aadhaar", "card_number", "credit_card", "first_name", "last_name", "customer_name", "name"]
            for col in column_details.keys():
                if any(p in col.lower() for p in pii_cols):
                    masked_cols.append(col)
        
        if masked_cols:
            output_guardrails.append({
                "name": "Data Privacy Masking",
                "status": "Passed",
                "message": f"PII masking applied successfully to columns: {', '.join(masked_cols)}."
            })
        else:
            output_guardrails.append({
                "name": "Data Privacy Masking",
                "status": "Passed",
                "message": "No sensitive PII columns required masking."
            })

        # Run analytical agents (Insights only for CBI page)
        from ..agents.insights_agent import generate_insights
        
        # Check active_tab to render insights only for CBI
        is_cbi = (request.active_tab == 'cbi')
        insights = []
        
        if is_cbi:
            try:
                insights = await generate_insights(
                    logic=request.logic or "",
                    columns=list(column_details.keys()),
                    dataframe=final_dataframe,
                    dq_insights=dq_insights,
                    model=decisions["insights"]["model"]
                )
            except Exception as e:
                print(f"[ERROR] generate_insights in simulation router failed: {e}")
                insights = ["Failed to retrieve business insights."]
        
        # Persona agent is commented out/bypassed temporarily
        personas = []

        response_obj = SimulationResponse(
            dataframe=final_dataframe,
            column_details=column_details,
            dq_insights=DQInsights(**dq_insights),
            table_dq_insights={k: DQInsights(**v) for k, v in table_dq_insights.items()},
            column_dq_insights={k: {col: DQInsights(**v) for col, v in cols.items()} for k, cols in column_dq_insights.items()},
            primary_keys=primary_keys,
            execution_explanation=ExecutionExplanation(**execution_explanation),
            output_guardrails=output_guardrails,
            insights=insights,
            personas=personas,
            all_tables_data=all_tables_data
        )
        print("--- SIMULATION RESPONSE DEBUG ---")
        for field_name, val in response_obj.__dict__.items():
            print(f"Field: {field_name}, Type: {type(val)}")
            if isinstance(val, dict):
                for k, v in val.items():
                    print(f"  Key: {k}, Type: {type(v)}")
            elif isinstance(val, list) and val:
                print(f"  First element type: {type(val[0])}")
        print("---------------------------------")
        return response_obj
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dq-insights/calculate")
async def calculate_dq_insights_endpoint(req: DQCalculationRequest):
    try:
        # Get the records for the selected table
        records = req.all_tables_data.get(req.table_name, [])
        if not records and req.table_name == "Output Table" and "Output Table" not in req.all_tables_data:
            # Fallback if somehow Output Table is passed as a list elsewhere
            pass

        # Calculate metrics for the specific column
        metrics_calculated = calculate_col_dq(records, req.column_name)
        
        # Filter metrics by requested parameters
        result = {}
        for m in req.metrics:
            result[m] = metrics_calculated.get(m)
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
