import json
from .llm import call_llm, parse_llm_json
from .utils import get_schema_context

async def generate_pandas_simulation(format: str, code_str: str, tables: list, columns: list, logic: str, model: str = "gpt-4o") -> str:
    schema_context = get_schema_context(tables)
    
    prompt = f"""
    You are an expert Data Engineer specializing in Python and Pandas.
    Your task is to write a Python script containing a function `simulate(dfs: dict) -> tuple` that takes a dictionary `dfs` where the keys are the table names (as strings) and values are pandas DataFrames containing the table data.
    This function MUST return a tuple `(result_df, intermediate_dfs)` representing the exact outcome and intermediate steps of the generated query/code below.
    `result_df` is the final outcome pandas DataFrame.
    `intermediate_dfs` is a dictionary where the keys are the variable names of any intermediate DataFrames created (like "customer_loans_df", "upi_transactions_df", "upi_inclined_df") and values are the corresponding DataFrames.

    Target Format of Generated Code: {format}
    Generated Code:
    {code_str}

    User Logic / Request: {logic}
    Tables: {", ".join(tables)}
    Columns Selected: {", ".join(columns)}
    {schema_context}

    Instructions for the Python code:
    1. Define a function `simulate(dfs: dict) -> tuple:`.
    2. Access each DataFrame from the `dfs` dictionary by its exact table name, e.g., `df_txn = dfs.get('transactionsInfo')`. Always check if a DataFrame exists and is not empty. If it is empty, handle it gracefully (e.g., return an empty DataFrame).
    3. Implement the exact logic specified in the generated code and user request (joins between tables, where/having filters, group by clauses, aggregates like sum/count/avg, window functions, and order by sorting).
    4. If the generated code performs aggregation (like grouping by month and channel, and calculating sum and count), your Python code MUST perform the exact same grouping and calculation, returning a DataFrame with those grouped and aggregated columns (e.g. `month`, `channel`, `total_amount`, `transaction_count`).
    5. If the generated code does not aggregate, but instead generates row-level computed columns (like `credit_score_bucket` or custom categories), calculate them and return the DataFrame containing these computed columns along with the requested columns.
    6. Handle date/timestamp parsing safely. For example, if a column is a timestamp, parse it with `pd.to_datetime` before extracting parts like month. E.g. `pd.to_datetime(df_txn['timestamp']).dt.strftime('%B')`.
    7. Ensure the returned DataFrame contains the computed/derived/aggregated columns with clear, descriptive header names that match the generated query's select list.
    8. Return the tuple `(result_df, intermediate_dfs)` at the end. Make sure to capture any major intermediate DataFrames defined (e.g., return result_df, {{"customer_loans_df": customer_loans_df, "upi_transactions_df": upi_transactions_df}}).
    9. Return the response as a JSON object with exactly one key "python_code" containing the python script as a string. Do not include markdown blocks (```python) or any other explanation inside the python_code string or JSON.
    """
    
    try:
        content, _, _ = await call_llm(prompt, model, response_format_json=True)
        data = parse_llm_json(content)
        return data.get("python_code", "")
    except Exception as e:
        print(f"Error in simulation agent: {e}")
        return ""
