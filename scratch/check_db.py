import os
import pandas as pd
import duckdb
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("backend/.env")
client = MongoClient(os.getenv("MONGODB_URI"))
db = client["bankingSdlcDB"]

dfs = {}
for table in ["customerDetails", "loanInfo", "accountBalances", "transactionsInfo"]:
    records = list(db[table].find().limit(3000))
    for r in records:
        r.pop("_id", None)
    dfs[table] = pd.DataFrame(records)

con = duckdb.connect()
for name, df in dfs.items():
    con.register(name, df)

print("Total customerDetails count:", len(dfs["customerDetails"]))
print("Total loanInfo count:", len(dfs["loanInfo"]))
print("Total accountBalances count:", len(dfs["accountBalances"]))

# 1. Base active home loans join (like SDLC Assist)
q_sdlc = """
SELECT DISTINCT cd.customer_id
FROM customerDetails cd
JOIN loanInfo li ON cd.customer_id = li.customer_id
WHERE li.loan_type = 'Home' AND li.loan_status = 'Active'
"""
res_sdlc = con.execute(q_sdlc).fetchdf()
print("SDLC Assist join count (distinct customer_id):", len(res_sdlc))

# 2. Join including accountBalances (INNER JOIN)
q_cbi_inner = """
SELECT DISTINCT cd.customer_id
FROM customerDetails cd
JOIN loanInfo li ON cd.customer_id = li.customer_id
JOIN accountBalances ab ON cd.customer_id = ab.customer_id
WHERE li.loan_type = 'Home' AND li.loan_status = 'Active'
"""
res_cbi_inner = con.execute(q_cbi_inner).fetchdf()
print("CBI join with INNER JOIN on accountBalances count (distinct customer_id):", len(res_cbi_inner))

# 3. Join including accountBalances (LEFT JOIN)
q_cbi_left = """
SELECT DISTINCT cd.customer_id
FROM customerDetails cd
JOIN loanInfo li ON cd.customer_id = li.customer_id
LEFT JOIN accountBalances ab ON cd.customer_id = ab.customer_id
WHERE li.loan_type = 'Home' AND li.loan_status = 'Active'
"""
res_cbi_left = con.execute(q_cbi_left).fetchdf()
print("CBI join with LEFT JOIN on accountBalances count (distinct customer_id):", len(res_cbi_left))
