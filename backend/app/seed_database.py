import os
import random
from datetime import datetime, timedelta
from pymongo import MongoClient, InsertOne
from faker import Faker
from dotenv import load_dotenv

# Load env variables from backend/.env relative to this file
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path)

# Initialize Faker and Mongo Client
fake = Faker()
# FIXME: Replace with your actual MongoDB Atlas connection string
CONNECTION_STRING = os.getenv("MONGODB_URI")

client = MongoClient(CONNECTION_STRING)
db = client["bankingSdlcDB"]

# Clear existing data to ensure clean slate and avoid duplicates
print("Clearing existing collections...")
db['customerDetails'].delete_many({})
db['accountBalances'].delete_many({})
db['loanInfo'].delete_many({})
db['transactionsInfo'].delete_many({})
db['dataQualityLogs'].delete_many({})
db['semanticMetaStore'].delete_many({})

TOTAL_RECORDS = 1500
print(f"Starting data generation pipeline for {TOTAL_RECORDS} records per table...")

# ----------------------------------------------------
# 1. GENERATE CUSTOMER DETAILS
# ----------------------------------------------------
customers_bulk = []
customer_ids = [f"CUST-{10000 + i}" for i in range(TOTAL_RECORDS)]

for i in range(TOTAL_RECORDS):
    cust_id = customer_ids[i]
    doc = {
        "customer_id": cust_id,
        "first_name": fake.first_name(),
        "last_name": fake.last_name(),
        "email": fake.ascii_free_email(),
        "phone": fake.numerify(text="##########"),
        "date_of_birth": datetime.combine(fake.date_of_birth(minimum_age=18, maximum_age=75), datetime.min.time()),
        "kyc_status": random.choice(["Verified", "Verified", "Pending", "Failed"]), # Weighted towards verified
        "credit_score": random.randint(300, 850),
        "created_at": datetime.now() - timedelta(days=random.randint(1, 1000))
    }
    customers_bulk.append(InsertOne(doc))

db['customerDetails'].bulk_write(customers_bulk)
print("[OK] Successfully injected 'customerDetails'")

# ----------------------------------------------------
# 2. GENERATE ACCOUNT BALANCES
# ----------------------------------------------------
accounts_bulk = []
account_ids = [f"ACC-{50000 + i}" for i in range(TOTAL_RECORDS)]

for i in range(TOTAL_RECORDS):
    acc_id = account_ids[i]
    c_id = random.choice(customer_ids)
    curr_bal = round(random.uniform(500.0, 250000.0), 2)
    # Introducing a potential Data Quality anomaly (negative balance on savings) as an easter egg for your app
    if i == 42: 
        curr_bal = -1500.0 
        
    doc = {
        "account_id": acc_id,
        "customer_id": c_id,
        "account_type": random.choice(["Savings", "Savings", "Current"]),
        "current_balance": curr_bal,
        "available_balance": round(curr_bal * 0.98, 2),
        "currency": "INR",
        "branch_code": f"BR-{random.randint(100, 150)}",
        "last_updated": datetime.now() - timedelta(hours=random.randint(1, 24)),
        "is_active": random.choice([True, True, True, False])
    }
    accounts_bulk.append(InsertOne(doc))

db['accountBalances'].bulk_write(accounts_bulk)
print("[OK] Successfully injected 'accountBalances'")

# ----------------------------------------------------
# 3. GENERATE LOAN INFO
# ----------------------------------------------------
loans_bulk = []
for i in range(TOTAL_RECORDS):
    principal = random.choice([100000, 500000, 1500000, 5000000])
    status = random.choice(["Active", "Active", "Closed", "Default"])
    
    doc = {
        "loan_id": f"LN-{20000 + i}",
        "customer_id": random.choice(customer_ids),
        "loan_type": random.choice(["Home", "Personal", "Auto"]),
        "principal_amount": float(principal),
        "interest_rate": round(random.uniform(7.5, 14.5), 2),
        "tenure_months": random.choice([12, 36, 60, 180, 240]),
        "start_date": datetime.now() - timedelta(days=random.randint(30, 730)),
        "loan_status": status,
        "remaining_balance": float(principal * 0.6) if status == "Active" else 0.0
    }
    loans_bulk.append(InsertOne(doc))

db['loanInfo'].bulk_write(loans_bulk)
print("[OK] Successfully injected 'loanInfo'")

# ----------------------------------------------------
# 4. GENERATE TRANSACTIONS
# ----------------------------------------------------
tx_bulk = []
for i in range(TOTAL_RECORDS):
    doc = {
        "transaction_id": f"TXN-{700000 + i}",
        "account_id": random.choice(account_ids),
        "customer_id": random.choice(customer_ids),
        "amount": round(random.uniform(10.0, 50000.0), 2),
        "transaction_type": random.choice(["Credit", "Debit", "Debit"]),
        "channel": random.choice(["UPI", "NetBanking", "ATM", "POS"]),
        "timestamp": datetime.now() - timedelta(minutes=random.randint(1, 43200)), # Last 30 days
        "merchant_name": fake.company(),
        "status": random.choice(["Success", "Success", "Success", "Failed", "Flagged"])
    }
    tx_bulk.append(InsertOne(doc))

db['transactionsInfo'].bulk_write(tx_bulk)
print("[OK] Successfully injected 'transactionsInfo'")

# ----------------------------------------------------
# 5. GENERATE DATA QUALITY LOGS
# ----------------------------------------------------
dq_bulk = []
tables_pool = ["customerDetails", "loanInfo", "transactionsInfo", "accountBalances"]
rules_pool = ["NullCheck", "TypeMismatch", "OutlierDetection", "SchemaValidation"]

for i in range(TOTAL_RECORDS):
    scanned = random.randint(10000, 50000)
    failed = random.choice([0, 0, 0, random.randint(1, 15)]) # Most pass, some fail
    
    doc = {
        "log_id": f"DQ-{80000 + i}",
        "target_table": random.choice(tables_pool),
        "field_checked": random.choice(["email", "credit_score", "current_balance", "amount", "phone"]),
        "rule_type": random.choice(rules_pool),
        "records_scanned": scanned,
        "failed_count": failed,
        "execution_time_ms": random.randint(45, 650),
        "run_date": datetime.now() - timedelta(days=random.randint(0, 30)),
        "status": "Pass" if failed == 0 else "Fail"
    }
    dq_bulk.append(InsertOne(doc))

db['dataQualityLogs'].bulk_write(dq_bulk)
print("[OK] Successfully injected 'dataQualityLogs'")

# ----------------------------------------------------
# 6. GENERATE SEMANTIC META STORE
# ----------------------------------------------------
semantic_metadata = [
    {
        "collection_name": "customerDetails",
        "friendly_name": "Customer Details",
        "description": "Stores profile details, contact information, credit scores, and KYC verification status of banking customers.",
        "primary_key": "customer_id",
        "relations": [],
        "fields": [
            {"field_name": "customer_id", "friendly_name": "Customer ID", "description": "Unique identifier assigned to each customer", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "first_name", "friendly_name": "First Name", "description": "Customer's first name", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "last_name", "friendly_name": "Last Name", "description": "Customer's last name", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "email", "friendly_name": "Email Address", "description": "Customer's email address", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "phone", "friendly_name": "Phone Number", "description": "10-digit customer mobile phone number", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "date_of_birth", "friendly_name": "Date of Birth", "description": "Customer's birthdate", "data_type": "date", "role": "dimension", "classification": "PII"},
            {"field_name": "kyc_status", "friendly_name": "KYC Status", "description": "Know Your Customer verification status (Verified, Pending, Failed)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "credit_score", "friendly_name": "Credit Score", "description": "Financial credit score representing creditworthiness (300 to 850)", "data_type": "integer", "role": "measure", "classification": "private"},
            {"field_name": "created_at", "friendly_name": "Creation Date", "description": "Timestamp indicating when the customer account profile was created", "data_type": "date", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "accountBalances",
        "friendly_name": "Account Balances",
        "description": "Maintains details of customer bank accounts, including current/available balances and active status.",
        "primary_key": "account_id",
        "relations": [
            {"local_field": "customer_id", "referenced_collection": "customerDetails", "referenced_field": "customer_id"}
        ],
        "fields": [
            {"field_name": "account_id", "friendly_name": "Account ID", "description": "Unique identifier assigned to each bank account", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "customer_id", "friendly_name": "Customer ID", "description": "Foreign key linking the account to its customer details", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "account_type", "friendly_name": "Account Type", "description": "Type of account (Savings, Current)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "current_balance", "friendly_name": "Current Balance", "description": "Total balance currently in the account", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "available_balance", "friendly_name": "Available Balance", "description": "Spendable balance in the account (adjusted for holds)", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "currency", "friendly_name": "Currency Code", "description": "Three-letter ISO currency code (e.g. INR)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "branch_code", "friendly_name": "Branch Code", "description": "Code identifying the bank branch holding this account", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "last_updated", "friendly_name": "Last Updated Time", "description": "Timestamp of the last account balance update", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "is_active", "friendly_name": "Is Account Active", "description": "Flag representing whether the account is currently active (true/false)", "data_type": "boolean", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "loanInfo",
        "friendly_name": "Loan Information",
        "description": "Records loan product subscriptions, principal amounts, interest rates, loan tenure, status, and remaining balances.",
        "primary_key": "loan_id",
        "relations": [
            {"local_field": "customer_id", "referenced_collection": "customerDetails", "referenced_field": "customer_id"}
        ],
        "fields": [
            {"field_name": "loan_id", "friendly_name": "Loan ID", "description": "Unique identifier assigned to each active or closed loan", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "customer_id", "friendly_name": "Customer ID", "description": "Foreign key linking the loan to the customer profile", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "loan_type", "friendly_name": "Loan Type", "description": "Type of loan (Home, Personal, Auto)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "principal_amount", "friendly_name": "Principal Amount", "description": "Total principal amount borrowed", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "interest_rate", "friendly_name": "Interest Rate", "description": "Annual interest rate percentage", "data_type": "double", "role": "measure", "classification": "public"},
            {"field_name": "tenure_months", "friendly_name": "Tenure (Months)", "description": "Total repayment duration in months", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "start_date", "friendly_name": "Loan Start Date", "description": "Date when the loan agreement commenced", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "loan_status", "friendly_name": "Loan Status", "description": "Current status of the loan (Active, Closed, Default)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "remaining_balance", "friendly_name": "Remaining Balance", "description": "Remaining unpaid balance on the loan", "data_type": "double", "role": "measure", "classification": "private"}
        ]
    },
    {
        "collection_name": "transactionsInfo",
        "friendly_name": "Transactions Log",
        "description": "Log of individual account transactions containing amount, type, execution channel, timestamp, and merchant name.",
        "primary_key": "transaction_id",
        "relations": [
            {"local_field": "account_id", "referenced_collection": "accountBalances", "referenced_field": "account_id"},
            {"local_field": "customer_id", "referenced_collection": "customerDetails", "referenced_field": "customer_id"}
        ],
        "fields": [
            {"field_name": "transaction_id", "friendly_name": "Transaction ID", "description": "Unique identifier assigned to each transaction", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "account_id", "friendly_name": "Account ID", "description": "ID of the account associated with the transaction", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "customer_id", "friendly_name": "Customer ID", "description": "ID of the customer who executed the transaction", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "amount", "friendly_name": "Transaction Amount", "description": "Transaction value in INR", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "transaction_type", "friendly_name": "Transaction Type", "description": "Type of transaction (Credit, Debit)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "channel", "friendly_name": "Transaction Channel", "description": "Payment channel used (UPI, NetBanking, ATM, POS)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "timestamp", "friendly_name": "Execution Timestamp", "description": "Date and time the transaction took place", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "merchant_name", "friendly_name": "Merchant Name", "description": "Name of the merchant involved in the transaction", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "status", "friendly_name": "Transaction Status", "description": "Status (Success, Failed, Flagged)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "dataQualityLogs",
        "friendly_name": "Data Quality Logs",
        "description": "Records logs of automated data quality check runs, highlighting scanned rows, fail counts, and status.",
        "primary_key": "log_id",
        "relations": [],
        "fields": [
            {"field_name": "log_id", "friendly_name": "Log ID", "description": "Unique identifier for each DQ run log entry", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "target_table", "friendly_name": "Target Table", "description": "The collection scanned by the DQ rule", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "field_checked", "friendly_name": "Checked Field", "description": "The specific field tested by the rule", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "rule_type", "friendly_name": "Rule Type", "description": "Type of check performed (NullCheck, TypeMismatch, OutlierDetection, SchemaValidation)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "records_scanned", "friendly_name": "Records Scanned", "description": "Total number of database records scanned during the check", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "failed_count", "friendly_name": "Failed Records Count", "description": "Count of scanned records failing the rule", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "execution_time_ms", "friendly_name": "Execution Time (ms)", "description": "Time taken in milliseconds to run the rule", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "run_date", "friendly_name": "Run Date", "description": "Date when the data quality check was executed", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "status", "friendly_name": "Run Status", "description": "Overall check result (Pass, Fail)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    }
]

bulk_meta = [InsertOne(doc) for doc in semantic_metadata]
db['semanticMetaStore'].bulk_write(bulk_meta)
print("[OK] Successfully injected 'semanticMetaStore'")

print("\nDatabase initialization complete! 7,505 documents successfully deployed to Atlas.")