import os
import re
import pandas as pd
import duckdb
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("backend/.env")
MONGODB_URI = os.getenv("MONGODB_URI")
client = MongoClient(MONGODB_URI)
db = client["bankingSdlcDB"]

print("Collections in DB:", db.list_collection_names())

# Load collections
dfs = {}
for table in ["customerDetails", "loanInfo"]:
    records = list(db[table].find().limit(1000))
    for r in records:
        r.pop("_id", None)
    dfs[table] = pd.DataFrame(records)

print("customerDetails cols:", dfs["customerDetails"].columns.tolist() if "customerDetails" in dfs else "None")
print("loanInfo cols:", dfs["loanInfo"].columns.tolist() if "loanInfo" in dfs else "None")

# Try to run typical SQL query
con = duckdb.connect()
for name, df in dfs.items():
    con.register(name, df)
    con.register(name.lower(), df)
    # snake case
    snake = re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()
    con.register(snake, df)

# Check registered tables
print("DuckDB Tables:", con.execute("SHOW TABLES").fetchall())

# Let's test a sample query
query_1 = """
SELECT c.customer_id, c.first_name, c.last_name, l.loan_type, l.loan_status
FROM customerDetails c
JOIN loanInfo l ON c.customer_id = l.customer_id
WHERE l.loan_type = 'Home' AND l.loan_status = 'Active'
"""

try:
    res = con.execute(query_1).fetchdf()
    print("Query 1 result shape:", res.shape)
except Exception as e:
    print("Query 1 failed:", e)

# Test query with 'home loans'
query_2 = """
SELECT c.customer_id, c.first_name, c.last_name, l.loan_type, l.loan_status
FROM customerDetails c
JOIN loanInfo l ON c.customer_id = l.customer_id
WHERE l.loan_type = 'home loans' AND l.loan_status = 'Active'
"""
try:
    res = con.execute(query_2).fetchdf()
    print("Query 2 result shape:", res.shape)
except Exception as e:
    print("Query 2 failed:", e)
