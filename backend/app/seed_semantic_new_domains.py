import os
from pymongo import MongoClient, InsertOne
from dotenv import load_dotenv

# Load env variables from backend/.env relative to this file
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path)

CONNECTION_STRING = os.getenv("MONGODB_URI")
if not CONNECTION_STRING:
    print("Error: MONGODB_URI is not set in environment variables.")
    exit(1)

client = MongoClient(CONNECTION_STRING)
db = client["bankingSdlcDB"]

collection_name = "semanticMetaStore"

semantic_metadata = [
    # ----------------------------------------------------
    # 1. RETAIL BANKING DOMAIN
    # ----------------------------------------------------
    {
        "collection_name": "customer_master",
        "friendly_name": "Customer Master",
        "description": "Master table containing profile and demographic details of retail banking customers.",
        "primary_key": "customer_id",
        "relations": [],
        "fields": [
            {"field_name": "customer_id", "friendly_name": "Customer ID", "description": "Unique identifier assigned to each customer", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "customer_name", "friendly_name": "Customer Name", "description": "Full name of the customer", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "age", "friendly_name": "Age", "description": "Age of the customer in years", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "city", "friendly_name": "City", "description": "City of residence of the customer", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "onboarding_date", "friendly_name": "Onboarding Date", "description": "Date when the customer was onboarded", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "segment", "friendly_name": "Segment", "description": "Customer segment classification (Mass, Affluent, HNI)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "account_summary",
        "friendly_name": "Account Summary",
        "description": "Contains details of customer accounts, types, active statuses, and balances.",
        "primary_key": "account_id",
        "relations": [
            {"local_field": "customer_id", "referenced_collection": "customer_master", "referenced_field": "customer_id"}
        ],
        "fields": [
            {"field_name": "account_id", "friendly_name": "Account ID", "description": "Unique identifier for the bank account", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "customer_id", "friendly_name": "Customer ID", "description": "Identifier of the customer owning this account", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "balance", "friendly_name": "Account Balance", "description": "Current ledger balance of the account", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "status", "friendly_name": "Status", "description": "Current operational status of the account (Active, Inactive)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "last_active_date", "friendly_name": "Last Active Date", "description": "Date when the account was last operated", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "account_type", "friendly_name": "Account Type", "description": "Type of the bank account (Savings, Current)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "transaction_summary",
        "friendly_name": "Transaction Summary",
        "description": "Log of retail banking transactions performed on customer accounts.",
        "primary_key": "txn_id",
        "relations": [
            {"local_field": "account_id", "referenced_collection": "account_summary", "referenced_field": "account_id"}
        ],
        "fields": [
            {"field_name": "txn_id", "friendly_name": "Transaction ID", "description": "Unique identifier for the transaction", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "account_id", "friendly_name": "Account ID", "description": "Account number from which the transaction was initiated", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "txn_date", "friendly_name": "Transaction Date", "description": "Date and time when the transaction took place", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "txn_amount", "friendly_name": "Transaction Amount", "description": "Value of the transaction", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "txn_type", "friendly_name": "Transaction Type", "description": "Type of account transaction (Debit, Credit)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "channel", "friendly_name": "Channel", "description": "Execution channel of the transaction (ATM, UPI, Branch)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },

    # ----------------------------------------------------
    # 2. LENDING DOMAIN
    # ----------------------------------------------------
    {
        "collection_name": "loan_master",
        "friendly_name": "Loan Master",
        "description": "Lending domain master records containing details of disbursed loans.",
        "primary_key": "loan_id",
        "relations": [
            {"local_field": "customer_id", "referenced_collection": "customer_master", "referenced_field": "customer_id"}
        ],
        "fields": [
            {"field_name": "loan_id", "friendly_name": "Loan ID", "description": "Unique identifier of the loan case", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "customer_id", "friendly_name": "Customer ID", "description": "Customer identifier who availed the loan", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "disbursed_amount", "friendly_name": "Disbursed Amount", "description": "Total principal amount disbursed to the customer", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "interest_rate", "friendly_name": "Interest Rate", "description": "Annual percentage rate (APR) of interest", "data_type": "double", "role": "measure", "classification": "public"},
            {"field_name": "tenure_months", "friendly_name": "Tenure (Months)", "description": "Total repayment duration of the loan in months", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "disbursed_date", "friendly_name": "Disbursed Date", "description": "Date when the loan amount was credited", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "loan_type", "friendly_name": "Loan Type", "description": "Type of loan product availed (Home, PL, Auto)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "loan_repayment",
        "friendly_name": "Loan Repayments",
        "description": "Log of EMI schedules, due dates, paid dates, and repayment statuses.",
        "primary_key": "repayment_id",
        "relations": [
            {"local_field": "loan_id", "referenced_collection": "loan_master", "referenced_field": "loan_id"}
        ],
        "fields": [
            {"field_name": "repayment_id", "friendly_name": "Repayment ID", "description": "Unique identifier for the EMI installment", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "loan_id", "friendly_name": "Loan ID", "description": "Identifier of the corresponding loan account", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "due_date", "friendly_name": "Due Date", "description": "Scheduled payment due date", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "paid_date", "friendly_name": "Paid Date", "description": "Actual payment date of the EMI (null if unpaid)", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "emi_amount", "friendly_name": "EMI Amount", "description": "Equated Monthly Installment value due", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "payment_status", "friendly_name": "Payment Status", "description": "Status of the repayment installment (Paid, Deplayed, Default)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "loan_deliquency",
        "friendly_name": "Loan Delinquency",
        "description": "Delinquency and Days Past Due (DPD) logs for active loan accounts.",
        "primary_key": "loan_id",
        "relations": [
            {"local_field": "loan_id", "referenced_collection": "loan_master", "referenced_field": "loan_id"}
        ],
        "fields": [
            {"field_name": "loan_id", "friendly_name": "Loan ID", "description": "Identifier of the delinquent loan account", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "days_past_due", "friendly_name": "Days Past Due (DPD)", "description": "Number of days the loan installment is past its due date", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "reporting_date", "friendly_name": "Reporting Date", "description": "Reporting cycle cutoff date", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "bucket", "friendly_name": "Bucket", "description": "Delinquency aging bucket (0-30, 30-60, 60-90, 90+)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },

    # ----------------------------------------------------
    # 3. CARDS DOMAIN
    # ----------------------------------------------------
    {
        "collection_name": "card_master",
        "friendly_name": "Card Master",
        "description": "Master list containing credit card information, limits, and issues.",
        "primary_key": "card_id",
        "relations": [
            {"local_field": "customer_id", "referenced_collection": "customer_master", "referenced_field": "customer_id"}
        ],
        "fields": [
            {"field_name": "card_id", "friendly_name": "Card ID", "description": "Unique identifier of the credit card", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "customer_id", "friendly_name": "Customer ID", "description": "Identifier of the customer owning this card", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "card_type", "friendly_name": "Card Type", "description": "Card product tier (Classic, Gold, Platinum, Signature)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "limit_amount", "friendly_name": "Limit Amount", "description": "Approved spend limit on the card", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "issue_date", "friendly_name": "Issue Date", "description": "Date when the card was active and issued", "data_type": "date", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "card_transactions",
        "friendly_name": "Card Transactions",
        "description": "Contains details of card swipes, transaction categories, and locations.",
        "primary_key": "txn_id",
        "relations": [
            {"local_field": "card_id", "referenced_collection": "card_master", "referenced_field": "card_id"}
        ],
        "fields": [
            {"field_name": "txn_id", "friendly_name": "Transaction ID", "description": "Unique identifier of the card swipe transaction", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "card_id", "friendly_name": "Card ID", "description": "Card number used for the transaction", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "txn_date", "friendly_name": "Transaction Date", "description": "Date when the purchase was made", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "merchant_category", "friendly_name": "Merchant Category", "description": "Merchant spend category (Travel, Dining, Retail)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "txn_amount", "friendly_name": "Transaction Amount", "description": "Spend amount in local currency", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "location", "friendly_name": "Location", "description": "Merchant city or location of the transaction", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "card_utilization",
        "friendly_name": "Card Utilization",
        "description": "Keeps track of statement balance utilization percentage of credit cards.",
        "primary_key": "card_id",
        "relations": [
            {"local_field": "card_id", "referenced_collection": "card_master", "referenced_field": "card_id"}
        ],
        "fields": [
            {"field_name": "card_id", "friendly_name": "Card ID", "description": "Identifier of the card", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "utilization_percentage", "friendly_name": "Utilization Percentage", "description": "Credit limit utilized percentage (0 to 100)", "data_type": "double", "role": "measure", "classification": "public"},
            {"field_name": "statement_date", "friendly_name": "Statement Date", "description": "Date on which the billing statement was generated", "data_type": "date", "role": "dimension", "classification": "public"}
        ]
    },

    # ----------------------------------------------------
    # 4. DIGITAL CHANNELS DOMAIN
    # ----------------------------------------------------
    {
        "collection_name": "digital_usage",
        "friendly_name": "Digital Usage Logs",
        "description": "Log files showing customer sessions on mobile and web digital channels.",
        "primary_key": "user_id",
        "relations": [
            {"local_field": "customer_id", "referenced_collection": "customer_master", "referenced_field": "customer_id"}
        ],
        "fields": [
            {"field_name": "user_id", "friendly_name": "User ID", "description": "Session user transaction identifier", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "customer_id", "friendly_name": "Customer ID", "description": "Corresponding customer identifier", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "login_date", "friendly_name": "Login Date", "description": "Date and time of login", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "session_duration", "friendly_name": "Session Duration (sec)", "description": "Duration of active session in seconds", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "channel", "friendly_name": "Channel", "description": "Digital platform used (Mobile, Web)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "feature_usage",
        "friendly_name": "Feature Usage Summary",
        "description": "Track the count of usage for distinct features on the digital channels.",
        "primary_key": "feature_id",
        "relations": [],
        "fields": [
            {"field_name": "feature_id", "friendly_name": "Feature ID", "description": "Unique identifier of the feature session log", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "feature_name", "friendly_name": "Feature Name", "description": "Name of feature accessed (Funds Transfer, Bill Payment)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "usage_count", "friendly_name": "Usage Count", "description": "Number of times the feature was used", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "date", "friendly_name": "Usage Date", "description": "Date of recording feature usage stats", "data_type": "date", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "drop_off_analysis",
        "friendly_name": "Digital Funnel Drop-offs",
        "description": "Funnel analysis stage and counts for user application drops.",
        "primary_key": "",
        "relations": [],
        "fields": [
            {"field_name": "stage", "friendly_name": "Stage", "description": "Application funnel stage details", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "drop_count", "friendly_name": "Drop Count", "description": "Count of users dropping off at this stage", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "date", "friendly_name": "Date", "description": "Analysis run date", "data_type": "date", "role": "dimension", "classification": "public"}
        ]
    },

    # ----------------------------------------------------
    # 5. COLLECTIONS DOMAIN
    # ----------------------------------------------------
    {
        "collection_name": "collection_cases",
        "friendly_name": "Collection Cases",
        "description": "Log of collection cases with assigned recovery agents and buckets.",
        "primary_key": "case_id",
        "relations": [
            {"local_field": "loan_id", "referenced_collection": "loan_master", "referenced_field": "loan_id"}
        ],
        "fields": [
            {"field_name": "case_id", "friendly_name": "Case ID", "description": "Unique identifier of the collection case", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "loan_id", "friendly_name": "Loan ID", "description": "Delinquent loan account identifier", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "assigned_agent", "friendly_name": "Assigned Agent", "description": "Collections recovery officer assigned to this case", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "bucket", "friendly_name": "Bucket", "description": "DPD aging bucket matching the case", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "case_date", "friendly_name": "Case Date", "description": "Date when collection case was registered", "data_type": "date", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "recovery_summary",
        "friendly_name": "Recovery Summary",
        "description": "Summarizes recovered cash amounts and channels used for loan recoveries.",
        "primary_key": "loan_id",
        "relations": [
            {"local_field": "loan_id", "referenced_collection": "loan_master", "referenced_field": "loan_id"}
        ],
        "fields": [
            {"field_name": "loan_id", "friendly_name": "Loan ID", "description": "Identifier of delinquent loan case", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "recovered_amount", "friendly_name": "Recovered Amount", "description": "Amount recovered by collections team", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "recovery_date", "friendly_name": "Recovery Date", "description": "Date when recovery payment was made", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "channel", "friendly_name": "Channel", "description": "Recovery mode utilized (Call, Field, Legal)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "roll_rate_analysis",
        "friendly_name": "Roll Rate Analysis",
        "description": "Aging bucket migration analytics (roll rate logic details).",
        "primary_key": "",
        "relations": [],
        "fields": [
            {"field_name": "from_bucket", "friendly_name": "From Bucket", "description": "Source delinquency aging bucket", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "to_bucket", "friendly_name": "To Bucket", "description": "Target delinquency aging bucket after cycle", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "count_loans", "friendly_name": "Count of Loans", "description": "Number of loans that transitioned between buckets", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "month", "friendly_name": "Month", "description": "Migration tracking month", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    }
]

new_tables = [item["collection_name"] for item in semantic_metadata]

print(f"Clearing existing entries for {len(new_tables)} tables in '{collection_name}'...")
db[collection_name].delete_many({"collection_name": {"$in": new_tables}})

print(f"Inserting {len(semantic_metadata)} semantic metadata records into '{collection_name}'...")
bulk_meta = [InsertOne(doc) for doc in semantic_metadata]
db[collection_name].bulk_write(bulk_meta)

print("[OK] Successfully seeded semantic metadata records for the 15 new tables!")
