import os
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("backend/.env")
MONGODB_URI = os.getenv("MONGODB_URI")
client = MongoClient(MONGODB_URI)
db = client["bankingSdlcDB"]

# Fetch customerDetails and loanInfo
customers = pd.DataFrame(list(db["customerDetails"].find().limit(3000)))
loans = pd.DataFrame(list(db["loanInfo"].find().limit(3000)))
txns = pd.DataFrame(list(db["transactionsInfo"].find().limit(3000)))

# Filter loans
active_home_loans = loans[(loans["loan_type"] == "Home") & (loans["loan_status"] == "Active")]
print("Total Active Home Loans:", len(active_home_loans))
print("Unique customers in Active Home Loans:", active_home_loans["customer_id"].nunique())

# Join customers and loans
merged = pd.merge(active_home_loans, customers, on="customer_id", how="inner")
print("Merged unique customers:", merged["customer_id"].nunique())

# Join with transactions
merged_txns_inner = pd.merge(merged, txns, on="customer_id", how="inner")
print("Merged with transactions (Inner Join) unique customers:", merged_txns_inner["customer_id"].nunique())
print("Merged with transactions (Inner Join) total rows:", len(merged_txns_inner))

merged_txns_left = pd.merge(merged, txns, on="customer_id", how="left")
print("Merged with transactions (Left Join) unique customers:", merged_txns_left["customer_id"].nunique())
print("Merged with transactions (Left Join) total rows:", len(merged_txns_left))
