import os
import random
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient, InsertOne
from faker import Faker
from dotenv import load_dotenv

# Load env variables from backend/.env relative to this file
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path)

# Initialize Faker and Mongo Client
fake = Faker()
CONNECTION_STRING = os.getenv("MONGODB_URI")
if not CONNECTION_STRING:
    print("Error: MONGODB_URI is not set in environment variables.")
    exit(1)

client = MongoClient(CONNECTION_STRING)
db = client["bankingSdlcDB"]

# Domain to table mappings
domain_mappings = {
    # Retail Banking Domain
    "customer_master": "Retail Banking",
    "account_summary": "Retail Banking",
    "transaction_summary": "Retail Banking",
    
    # Lending Domain
    "loan_master": "Lending",
    "loan_repayment": "Lending",
    "loan_deliquency": "Lending",
    
    # Cards Domain
    "card_master": "Cards",
    "card_transactions": "Cards",
    "card_utilization": "Cards",
    
    # Digital Channels Domain
    "digital_usage": "Digital Channels",
    "feature_usage": "Digital Channels",
    "drop_off_analysis": "Digital Channels",
    
    # Collections Domain
    "collection_cases": "Collections",
    "recovery_summary": "Collections",
    "roll_rate_analysis": "Collections"
}

new_tables = list(domain_mappings.keys())

print("Clearing existing entries for new domains...")
for table in new_tables:
    db[table].delete_many({})
    print(f"Cleared collection '{table}'")

# Clear existing entries in tableStatusNew for these specific tables
db["tableStatusNew"].delete_many({"tableName": {"$in": new_tables}})
print("Cleared metadata entries in 'tableStatusNew'")

TOTAL_RECORDS = 1500
print(f"Starting generation of {TOTAL_RECORDS} records per table...")

# ----------------------------------------------------
# 1. RETAIL BANKING - CUSTOMER MASTER
# ----------------------------------------------------
customers_bulk = []
customer_ids = [f"CM-{10000 + i}" for i in range(TOTAL_RECORDS)]

for i in range(TOTAL_RECORDS):
    cust_id = customer_ids[i]
    doc = {
        "customer_id": cust_id,
        "customer_name": fake.name(),
        "age": random.randint(18, 80),
        "city": fake.city(),
        "onboarding_date": datetime.combine(fake.date_between(start_date="-365d", end_date="today"), datetime.min.time()),
        "segment": random.choice(["Mass", "Affluent", "HNI"])
    }
    customers_bulk.append(InsertOne(doc))

db["customer_master"].bulk_write(customers_bulk)
print("[OK] Successfully seeded 'customer_master'")

# ----------------------------------------------------
# 2. RETAIL BANKING - ACCOUNT SUMMARY
# ----------------------------------------------------
accounts_bulk = []
account_ids = [f"AM-{50000 + i}" for i in range(TOTAL_RECORDS)]

for i in range(TOTAL_RECORDS):
    acc_id = account_ids[i]
    doc = {
        "account_id": acc_id,
        "customer_id": random.choice(customer_ids),
        "balance": round(random.uniform(500.0, 500000.0), 2),
        "status": random.choice(["Active", "Active", "Inactive"]),
        "last_active_date": datetime.combine(fake.date_between(start_date="-30d", end_date="today"), datetime.min.time()),
        "account_type": random.choice(["Savings", "Current"])
    }
    accounts_bulk.append(InsertOne(doc))

db["account_summary"].bulk_write(accounts_bulk)
print("[OK] Successfully seeded 'account_summary'")

# ----------------------------------------------------
# 3. RETAIL BANKING - TRANSACTION SUMMARY
# ----------------------------------------------------
txns_bulk = []
for i in range(TOTAL_RECORDS):
    doc = {
        "txn_id": f"TXM-{700000 + i}",
        "account_id": random.choice(account_ids),
        "txn_date": datetime.combine(fake.date_between(start_date="-30d", end_date="today"), datetime.min.time()),
        "txn_amount": round(random.uniform(10.0, 50000.0), 2),
        "txn_type": random.choice(["Debit", "Credit"]),
        "channel": random.choice(["ATM", "UPI", "Branch"])
    }
    txns_bulk.append(InsertOne(doc))

db["transaction_summary"].bulk_write(txns_bulk)
print("[OK] Successfully seeded 'transaction_summary'")

# ----------------------------------------------------
# 4. LENDING - LOAN MASTER
# ----------------------------------------------------
loans_bulk = []
loan_ids = [f"LM-{20000 + i}" for i in range(TOTAL_RECORDS)]

for i in range(TOTAL_RECORDS):
    doc = {
        "loan_id": loan_ids[i],
        "customer_id": random.choice(customer_ids),
        "disbursed_amount": float(random.choice([100000, 250000, 500000, 1000000, 3000000])),
        "interest_rate": round(random.uniform(7.0, 15.0), 2),
        "tenure_months": random.choice([12, 24, 36, 60, 120, 240]),
        "disbursed_date": datetime.combine(fake.date_between(start_date="-365d", end_date="-30d"), datetime.min.time()),
        "loan_type": random.choice(["Home", "PL", "Auto"])
    }
    loans_bulk.append(InsertOne(doc))

db["loan_master"].bulk_write(loans_bulk)
print("[OK] Successfully seeded 'loan_master'")

# ----------------------------------------------------
# 5. LENDING - LOAN REPAYMENT
# ----------------------------------------------------
repayments_bulk = []
for i in range(TOTAL_RECORDS):
    status = random.choice(["Paid", "Deplayed", "Default"])
    due = fake.date_between(start_date="-180d", end_date="+30d")
    due_dt = datetime.combine(due, datetime.min.time())
    
    if status == "Paid":
        paid_dt = datetime.combine(due + timedelta(days=random.randint(-5, 5)), datetime.min.time())
    elif status == "Deplayed":
        paid_dt = datetime.combine(due + timedelta(days=random.randint(6, 45)), datetime.min.time())
    else:
        paid_dt = None
        
    doc = {
        "repayment_id": f"RPM-{30000 + i}",
        "loan_id": random.choice(loan_ids),
        "due_date": due_dt,
        "paid_date": paid_dt,
        "emi_amount": round(random.uniform(2000.0, 40000.0), 2),
        "payment_status": status
    }
    repayments_bulk.append(InsertOne(doc))

db["loan_repayment"].bulk_write(repayments_bulk)
print("[OK] Successfully seeded 'loan_repayment'")

# ----------------------------------------------------
# 6. LENDING - LOAN DELIQUENCY
# ----------------------------------------------------
deliquencies_bulk = []
for i in range(TOTAL_RECORDS):
    dpd = random.choice([0]*60 + [random.randint(1, 30)]*20 + [random.randint(31, 60)]*10 + [random.randint(61, 90)]*7 + [random.randint(91, 150)]*3)
    if dpd <= 30:
        bucket = "0-30"
    elif dpd <= 60:
        bucket = "30-60"
    elif dpd <= 90:
        bucket = "60-90"
    else:
        bucket = "90+"
        
    doc = {
        "loan_id": random.choice(loan_ids),
        "days_past_due": dpd,
        "reporting_date": datetime.combine(fake.date_between(start_date="-30d", end_date="today"), datetime.min.time()),
        "bucket": bucket
    }
    deliquencies_bulk.append(InsertOne(doc))

db["loan_deliquency"].bulk_write(deliquencies_bulk)
print("[OK] Successfully seeded 'loan_deliquency'")

# ----------------------------------------------------
# 7. CARDS - CARD MASTER
# ----------------------------------------------------
card_ids = [f"CARDM-{40000 + i}" for i in range(TOTAL_RECORDS)]
cards_bulk = []

for i in range(TOTAL_RECORDS):
    doc = {
        "card_id": card_ids[i],
        "customer_id": random.choice(customer_ids),
        "card_type": random.choice(["Classic", "Gold", "Platinum", "Signature"]),
        "limit_amount": float(random.choice([30000, 50000, 100000, 250000, 500000])),
        "issue_date": datetime.combine(fake.date_between(start_date="-365d", end_date="today"), datetime.min.time())
    }
    cards_bulk.append(InsertOne(doc))

db["card_master"].bulk_write(cards_bulk)
print("[OK] Successfully seeded 'card_master'")

# ----------------------------------------------------
# 8. CARDS - CARD TRANSACTIONS
# ----------------------------------------------------
card_txns_bulk = []
for i in range(TOTAL_RECORDS):
    doc = {
        "txn_id": f"CTXNM-{800000 + i}",
        "card_id": random.choice(card_ids),
        "txn_date": datetime.combine(fake.date_between(start_date="-30d", end_date="today"), datetime.min.time()),
        "merchant_category": random.choice(["Travel", "Dining", "Groceries", "Entertainment", "Electronics", "Retail"]),
        "txn_amount": round(random.uniform(50.0, 25000.0), 2),
        "location": fake.city()
    }
    card_txns_bulk.append(InsertOne(doc))

db["card_transactions"].bulk_write(card_txns_bulk)
print("[OK] Successfully seeded 'card_transactions'")

# ----------------------------------------------------
# 9. CARDS - CARD UTILIZATION
# ----------------------------------------------------
card_utils_bulk = []
for i in range(TOTAL_RECORDS):
    doc = {
        "card_id": random.choice(card_ids),
        "utilization_percentage": round(random.uniform(0.0, 100.0), 2),
        "statement_date": datetime.combine(fake.date_between(start_date="-30d", end_date="today"), datetime.min.time())
    }
    card_utils_bulk.append(InsertOne(doc))

db["card_utilization"].bulk_write(card_utils_bulk)
print("[OK] Successfully seeded 'card_utilization'")

# ----------------------------------------------------
# 10. DIGITAL CHANNELS - DIGITAL USAGE
# ----------------------------------------------------
digital_usages_bulk = []
for i in range(TOTAL_RECORDS):
    doc = {
        "user_id": f"USRD-{60000 + i}",
        "customer_id": random.choice(customer_ids),
        "login_date": datetime.combine(fake.date_between(start_date="-30d", end_date="today"), datetime.min.time()),
        "session_duration": random.randint(15, 1800),
        "channel": random.choice(["Mobile", "Web"])
    }
    digital_usages_bulk.append(InsertOne(doc))

db["digital_usage"].bulk_write(digital_usages_bulk)
print("[OK] Successfully seeded 'digital_usage'")

# ----------------------------------------------------
# 11. DIGITAL CHANNELS - FEATURE USAGE
# ----------------------------------------------------
feature_usages_bulk = []
features_pool = [
    ("FEATM-1", "Funds Transfer"),
    ("FEATM-2", "Bill Payment"),
    ("FEATM-3", "Recharge"),
    ("FEATM-4", "KYC Update"),
    ("FEATM-5", "Statement Download"),
    ("FEATM-6", "Card Hotlisting")
]

for i in range(TOTAL_RECORDS):
    feat_id, feat_name = random.choice(features_pool)
    doc = {
        "feature_id": f"{feat_id}_{i}",
        "feature_name": feat_name,
        "usage_count": random.randint(10, 5000),
        "date": datetime.combine(fake.date_between(start_date="-30d", end_date="today"), datetime.min.time())
    }
    feature_usages_bulk.append(InsertOne(doc))

db["feature_usage"].bulk_write(feature_usages_bulk)
print("[OK] Successfully seeded 'feature_usage'")

# ----------------------------------------------------
# 12. DIGITAL CHANNELS - DROP OFF ANALYSIS
# ----------------------------------------------------
drop_offs_bulk = []
stages = ["Login", "Dashboard", "Application Initiated", "Details Submitted", "Documents Uploaded", "E-Sign Completed"]

for i in range(TOTAL_RECORDS):
    doc = {
        "stage": random.choice(stages),
        "drop_count": random.randint(5, 200),
        "date": datetime.combine(fake.date_between(start_date="-30d", end_date="today"), datetime.min.time())
    }
    drop_offs_bulk.append(InsertOne(doc))

db["drop_off_analysis"].bulk_write(drop_offs_bulk)
print("[OK] Successfully seeded 'drop_off_analysis'")

# ----------------------------------------------------
# 13. COLLECTIONS - COLLECTION CASES
# ----------------------------------------------------
collection_cases_bulk = []
for i in range(TOTAL_RECORDS):
    doc = {
        "case_id": f"CASE-{10000 + i}",
        "loan_id": random.choice(loan_ids),
        "assigned_agent": fake.name(),
        "bucket": random.choice(["0-30", "30-60", "60-90", "90+"]),
        "case_date": datetime.combine(fake.date_between(start_date="-30d", end_date="today"), datetime.min.time())
    }
    collection_cases_bulk.append(InsertOne(doc))

db["collection_cases"].bulk_write(collection_cases_bulk)
print("[OK] Successfully seeded 'collection_cases'")

# ----------------------------------------------------
# 14. COLLECTIONS - RECOVERY SUMMARY
# ----------------------------------------------------
recovery_summaries_bulk = []
for i in range(TOTAL_RECORDS):
    doc = {
        "loan_id": random.choice(loan_ids),
        "recovered_amount": round(random.uniform(500.0, 100000.0), 2),
        "recovery_date": datetime.combine(fake.date_between(start_date="-30d", end_date="today"), datetime.min.time()),
        "channel": random.choice(["Call", "Field", "Legal"])
    }
    recovery_summaries_bulk.append(InsertOne(doc))

db["recovery_summary"].bulk_write(recovery_summaries_bulk)
print("[OK] Successfully seeded 'recovery_summary'")

# ----------------------------------------------------
# 15. COLLECTIONS - ROLL RATE ANALYSIS
# ----------------------------------------------------
roll_rates_bulk = []
for i in range(TOTAL_RECORDS):
    doc = {
        "from_bucket": random.choice(["Current", "0-30", "30-60", "60-90"]),
        "to_bucket": random.choice(["0-30", "30-60", "60-90", "90+", "Paid"]),
        "count_loans": random.randint(1, 200),
        "month": random.choice(["January 2026", "February 2026", "March 2026", "April 2026", "May 2026"])
    }
    roll_rates_bulk.append(InsertOne(doc))

db["roll_rate_analysis"].bulk_write(roll_rates_bulk)
print("[OK] Successfully seeded 'roll_rate_analysis'")

# ----------------------------------------------------
# SEED TABLE STATUS NEW
# ----------------------------------------------------
print("Generating 'tableStatusNew' records...")
status_bulk = []
ist_tz = timezone(timedelta(hours=5, minutes=30))

for table_name in new_tables:
    domain = domain_mappings[table_name]
    
    # Generate random createdTimestamp in the last 30 days
    now_ist = datetime.now(ist_tz)
    random_days = random.randint(0, 29)
    random_seconds = random.randint(0, 86400)
    created_dt = now_ist - timedelta(days=random_days, seconds=random_seconds)
    
    # Calculate approvalTimestamp (exactly 1 hour after createdTimestamp)
    approval_dt = created_dt + timedelta(hours=1)
    
    # Format timestamps as DD-MM-YYYY-hh-mm-ss IST (using %H for 24-hour compatibility)
    created_str = created_dt.strftime("%d-%m-%Y-%H-%M-%S") + " IST"
    approval_str = approval_dt.strftime("%d-%m-%Y-%H-%M-%S") + " IST"
    
    doc = {
        "tableName": table_name,
        "approvalStatus": "approved",
        "createdUserId": "system",
        "createdTimestamp": created_str,
        "approvalTimestamp": approval_str,
        "tableRole": "",
        "tableSchema": "",
        "tableDomain": domain,
        "domain": domain, # compatibility
        "tableType": "sdlc"
    }
    status_bulk.append(InsertOne(doc))

db["tableStatusNew"].bulk_write(status_bulk)
print("[OK] Successfully seeded 'tableStatusNew'")

print("\nAll 15 collections seeded and registered in 'tableStatusNew' successfully!")
