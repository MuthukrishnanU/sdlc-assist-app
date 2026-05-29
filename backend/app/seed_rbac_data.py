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
CONNECTION_STRING = os.getenv("MONGODB_URI")
if not CONNECTION_STRING:
    print("Error: MONGODB_URI is not set in environment variables.")
    exit(1)

client = MongoClient(CONNECTION_STRING)
db = client["bankingSdlcDB"]

TOTAL_RECORDS = 1500

# ----------------------------------------------------
# CLEAR EXISTING RBAC TABLES (Healthcare, Media, Users)
# ----------------------------------------------------
print("Clearing existing Healthcare, Media, and Users collections...")
rbac_collections = [
    'patientsInfo', 'medicalRecords', 'doctorDetails', 'hospitalBeds', 'healthcareDqLogs',
    'subscriberProfiles', 'contentLibrary', 'watchHistory', 'billingTransactions', 'mediaDqLogs',
    'sdlcUsers'
]

for col in rbac_collections:
    db[col].delete_many({})

# ----------------------------------------------------
# 1. GENERATE HEALTHCARE DATA
# ----------------------------------------------------
print("Seeding Healthcare collections...")

# 1.1 Patients Info (1500 records)
patients_bulk = []
patient_ids = [f"PAT-{10000 + i}" for i in range(TOTAL_RECORDS)]
for i in range(TOTAL_RECORDS):
    pat_id = patient_ids[i]
    doc = {
        "patient_id": pat_id,
        "first_name": fake.first_name(),
        "last_name": fake.last_name(),
        "email": fake.ascii_free_email(),
        "phone": fake.numerify(text="##########"),
        "date_of_birth": datetime.combine(fake.date_of_birth(minimum_age=1, maximum_age=90), datetime.min.time()),
        "gender": random.choice(["Male", "Female", "Other"]),
        "blood_group": random.choice(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
        "insurance_provider": random.choice(["Blue Cross", "Aetna", "Cigna", "UnitedHealth", "Kaiser"]),
        "registered_date": datetime.now() - timedelta(days=random.randint(1, 1000))
    }
    patients_bulk.append(InsertOne(doc))
db['patientsInfo'].bulk_write(patients_bulk)
print("[OK] Successfully seeded 'patientsInfo'")

# 1.2 Doctor Details (1500 records)
doctors_bulk = []
doctor_ids = [f"DOC-{30000 + i}" for i in range(TOTAL_RECORDS)]
specializations = ["Cardiology", "Pediatrics", "Neurology", "Orthopedics", "General Medicine", "Dermatology"]
wings = ["Wing A", "Wing B", "ICU", "Emergency Wing", "Outpatient Clinic"]
availabilities = ["Morning", "Evening", "Night Shift", "Weekends Only"]
for i in range(TOTAL_RECORDS):
    doc_id = doctor_ids[i]
    doc = {
        "doctor_id": doc_id,
        "doctor_name": f"Dr. {fake.first_name()} {fake.last_name()}",
        "specialization": random.choice(specializations),
        "experience_years": random.randint(2, 40),
        "phone": fake.numerify(text="##########"),
        "email": fake.ascii_free_email(),
        "hospital_wing": random.choice(wings),
        "consultation_fee": float(random.choice([500, 800, 1200, 1500, 2000])),
        "availability": random.choice(availabilities),
        "rating": round(random.uniform(3.0, 5.0), 1)
    }
    doctors_bulk.append(InsertOne(doc))
db['doctorDetails'].bulk_write(doctors_bulk)
print("[OK] Successfully seeded 'doctorDetails'")

# 1.3 Medical Records (1500 records)
records_bulk = []
diagnoses = ["Hypertension", "Diabetes", "Asthma", "Flu", "Bronchitis", "Migraine", "Arthritis", "Covid-19"]
treatments = ["Medication", "Physical Therapy", "Surgery", "Lifestyle Change", "Diet Control"]
prescriptions = ["Lisinopril", "Metformin", "Albuterol", "Oseltamivir", "Ibuprofen", "Sumatriptan", "Glucosamine"]
statuses = ["Discharged", "Admitted", "Under Observation"]

for i in range(TOTAL_RECORDS):
    adm_date = datetime.now() - timedelta(days=random.randint(1, 365))
    dis_date = adm_date + timedelta(days=random.randint(1, 14))
    doc = {
        "record_id": f"REC-{20000 + i}",
        "patient_id": random.choice(patient_ids),
        "doctor_id": random.choice(doctor_ids),
        "diagnosis": random.choice(diagnoses),
        "treatment_plan": random.choice(treatments),
        "admission_date": adm_date,
        "discharge_date": dis_date,
        "billing_amount": round(random.uniform(1000.0, 150000.0), 2),
        "prescription": random.choice(prescriptions),
        "status": random.choice(statuses)
    }
    records_bulk.append(InsertOne(doc))
db['medicalRecords'].bulk_write(records_bulk)
print("[OK] Successfully seeded 'medicalRecords'")

# 1.4 Hospital Beds (1500 records)
beds_bulk = []
wards = ["General Ward", "ICU", "Pediatrics", "Cardiology", "Maternity"]
bed_types = ["Standard", "ICU", "Semi-Private", "Deluxe"]
for i in range(TOTAL_RECORDS):
    is_occ = random.choice([True, False])
    doc = {
        "bed_id": f"BED-{40000 + i}",
        "ward_name": random.choice(wards),
        "bed_type": random.choice(bed_types),
        "is_occupied": is_occ,
        "patient_id": random.choice(patient_ids) if is_occ else None,
        "daily_charge": float(random.choice([1000, 2500, 5000, 8000, 12000])),
        "last_cleaned": datetime.now() - timedelta(hours=random.randint(1, 48)),
        "nurse_in_charge": fake.name(),
        "maintenance_status": random.choice(["Active", "Active", "Under Repair", "Out of Service"]),
        "floor": random.randint(1, 5)
    }
    beds_bulk.append(InsertOne(doc))
db['hospitalBeds'].bulk_write(beds_bulk)
print("[OK] Successfully seeded 'hospitalBeds'")

# 1.5 Healthcare DQ Logs (1500 records)
hc_dq_bulk = []
hc_tables = ["patientsInfo", "medicalRecords", "doctorDetails", "hospitalBeds"]
dq_rules = ["NullCheck", "TypeMismatch", "OutlierDetection", "SchemaValidation"]
fields_pool = ["email", "phone", "billing_amount", "consultation_fee", "is_occupied", "date_of_birth"]
for i in range(TOTAL_RECORDS):
    scanned = random.randint(5000, 20000)
    failed = random.choice([0, 0, 0, random.randint(1, 10)])
    doc = {
        "log_id": f"DQ-HC-{80000 + i}",
        "target_table": random.choice(hc_tables),
        "field_checked": random.choice(fields_pool),
        "rule_type": random.choice(dq_rules),
        "records_scanned": scanned,
        "failed_count": failed,
        "execution_time_ms": random.randint(30, 450),
        "run_date": datetime.now() - timedelta(days=random.randint(0, 30)),
        "status": "Pass" if failed == 0 else "Fail",
        "severity": random.choice(["Low", "Medium", "High"])
    }
    hc_dq_bulk.append(InsertOne(doc))
db['healthcareDqLogs'].bulk_write(hc_dq_bulk)
print("[OK] Successfully seeded 'healthcareDqLogs'")


# ----------------------------------------------------
# 2. GENERATE MEDIA DATA
# ----------------------------------------------------
print("Seeding Media collections...")

# 2.1 Subscriber Profiles (1500 records)
subscribers_bulk = []
subscriber_ids = [f"SUB-{10000 + i}" for i in range(TOTAL_RECORDS)]
genres = ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Documentary", "Thriller"]
languages = ["English", "Hindi", "Spanish", "French", "Japanese"]
devices = ["Mobile", "SmartTV", "Tablet", "Web", "Console"]
for i in range(TOTAL_RECORDS):
    sub_id = subscriber_ids[i]
    doc = {
        "subscriber_id": sub_id,
        "username": fake.user_name(),
        "email": fake.ascii_free_email(),
        "phone": fake.numerify(text="##########"),
        "subscription_tier": random.choice(["Basic", "Standard", "Premium"]),
        "payment_status": random.choice(["Paid", "Paid", "Pending", "Overdue"]),
        "signup_date": datetime.now() - timedelta(days=random.randint(1, 1000)),
        "favorite_genre": random.choice(genres),
        "preferred_language": random.choice(languages),
        "device_type": random.choice(devices)
    }
    subscribers_bulk.append(InsertOne(doc))
db['subscriberProfiles'].bulk_write(subscribers_bulk)
print("[OK] Successfully seeded 'subscriberProfiles'")

# 2.2 Content Library (1500 records)
content_bulk = []
content_ids = [f"CNT-{20000 + i}" for i in range(TOTAL_RECORDS)]
for i in range(TOTAL_RECORDS):
    cnt_id = content_ids[i]
    doc = {
        "content_id": cnt_id,
        "title": fake.catch_phrase(),
        "genre": random.choice(genres),
        "content_type": random.choice(["Movie", "TV Show", "Documentary"]),
        "release_year": random.randint(1990, 2026),
        "duration_minutes": random.randint(20, 200),
        "rating": round(random.uniform(1.0, 10.0), 1),
        "language": random.choice(languages),
        "director": fake.name(),
        "license_cost": round(random.uniform(5000.0, 500000.0), 2)
    }
    content_bulk.append(InsertOne(doc))
db['contentLibrary'].bulk_write(content_bulk)
print("[OK] Successfully seeded 'contentLibrary'")

# 2.3 Watch History (1500 records)
watch_bulk = []
for i in range(TOTAL_RECORDS):
    doc = {
        "history_id": f"HIS-{30000 + i}",
        "subscriber_id": random.choice(subscriber_ids),
        "content_id": random.choice(content_ids),
        "watch_duration_minutes": random.randint(1, 180),
        "completion_percentage": round(random.uniform(1.0, 100.0), 2),
        "device_used": random.choice(devices),
        "timestamp": datetime.now() - timedelta(minutes=random.randint(1, 43200)),
        "rating_given": random.choice([1, 2, 3, 4, 5, None]),
        "is_downloaded": random.choice([True, False]),
        "audio_language": random.choice(languages)
    }
    watch_bulk.append(InsertOne(doc))
db['watchHistory'].bulk_write(watch_bulk)
print("[OK] Successfully seeded 'watchHistory'")

# 2.4 Billing Transactions (1500 records)
billing_bulk = []
for i in range(TOTAL_RECORDS):
    amt = float(random.choice([199, 299, 499, 699, 999]))
    tx_date = datetime.now() - timedelta(days=random.randint(1, 30))
    doc = {
        "billing_id": f"BIL-{40000 + i}",
        "subscriber_id": random.choice(subscriber_ids),
        "amount": amt,
        "payment_method": random.choice(["Credit Card", "UPI", "PayPal", "NetBanking"]),
        "transaction_date": tx_date,
        "status": random.choice(["Success", "Success", "Success", "Failed", "Pending"]),
        "invoice_number": f"INV-{random.randint(100000, 999999)}",
        "tax_amount": round(amt * 0.18, 2),
        "promo_code_used": random.choice(["FREE50", "WELCOME", None, None, None]),
        "renewal_date": tx_date + timedelta(days=30)
    }
    billing_bulk.append(InsertOne(doc))
db['billingTransactions'].bulk_write(billing_bulk)
print("[OK] Successfully seeded 'billingTransactions'")

# 2.5 Media DQ Logs (1500 records)
media_dq_bulk = []
media_tables = ["subscriberProfiles", "contentLibrary", "watchHistory", "billingTransactions"]
for i in range(TOTAL_RECORDS):
    scanned = random.randint(5000, 20000)
    failed = random.choice([0, 0, 0, random.randint(1, 10)])
    doc = {
        "log_id": f"DQ-MD-{80000 + i}",
        "target_table": random.choice(media_tables),
        "field_checked": random.choice(["email", "duration_minutes", "amount", "phone", "username"]),
        "rule_type": random.choice(dq_rules),
        "records_scanned": scanned,
        "failed_count": failed,
        "execution_time_ms": random.randint(30, 450),
        "run_date": datetime.now() - timedelta(days=random.randint(0, 30)),
        "status": "Pass" if failed == 0 else "Fail",
        "severity": random.choice(["Low", "Medium", "High"])
    }
    media_dq_bulk.append(InsertOne(doc))
db['mediaDqLogs'].bulk_write(media_dq_bulk)
print("[OK] Successfully seeded 'mediaDqLogs'")


# ----------------------------------------------------
# 3. GENERATE 100 UNIQUE USERS FOR RBAC (sdlcUsers)
# ----------------------------------------------------
print("Generating 100 unique RBAC users...")
users_bulk = []

# Generate 34 Data Engineering users
for i in range(1, 35):
    users_bulk.append(InsertOne({
        "userId": f"de_user_{i}",
        "password": f"depass{i}",
        "role": "Data Engineering"
    }))

# Generate 33 Healthcare users
for i in range(1, 34):
    users_bulk.append(InsertOne({
        "userId": f"hc_user_{i}",
        "password": f"hcpass{i}",
        "role": "Healthcare"
    }))

# Generate 33 Media users
for i in range(1, 34):
    users_bulk.append(InsertOne({
        "userId": f"media_user_{i}",
        "password": f"mediapass{i}",
        "role": "Media"
    }))

db['sdlcUsers'].bulk_write(users_bulk)
print("[OK] Successfully seeded 'sdlcUsers' with 100 unique users.")


# ----------------------------------------------------
# 4. CREATE INDEXES ON ALL COLLECTIONS
# ----------------------------------------------------
print("Configuring database indexes on all collections...")

indexes_to_create = {
    # Existing collections
    'customerDetails': 'customer_id',
    'accountBalances': 'account_id',
    'loanInfo': 'loan_id',
    'transactionsInfo': 'transaction_id',
    'dataQualityLogs': 'log_id',
    'semanticMetaStore': 'collection_name',
    # Healthcare collections
    'patientsInfo': 'patient_id',
    'medicalRecords': 'record_id',
    'doctorDetails': 'doctor_id',
    'hospitalBeds': 'bed_id',
    'healthcareDqLogs': 'log_id',
    # Media collections
    'subscriberProfiles': 'subscriber_id',
    'contentLibrary': 'content_id',
    'watchHistory': 'history_id',
    'billingTransactions': 'billing_id',
    'mediaDqLogs': 'log_id',
    # Users
    'sdlcUsers': 'userId'
}

for col_name, pk_field in indexes_to_create.items():
    db[col_name].create_index(pk_field, unique=True)
    print(f"[OK] Index created on '{col_name}' for field '{pk_field}'")


# ----------------------------------------------------
# 5. SEMANTIC META STORE POPULATION
# ----------------------------------------------------
print("Generating semantic metadata store layer for Healthcare and Media tables...")

# Delete previous semantic store layers for these collections if they exist to avoid duplication
collections_to_clean = list(indexes_to_create.keys())
collections_to_clean.remove('semanticMetaStore')
collections_to_clean.remove('sdlcUsers')
db['semanticMetaStore'].delete_many({"collection_name": {"$in": [
    'patientsInfo', 'medicalRecords', 'doctorDetails', 'hospitalBeds', 'healthcareDqLogs',
    'subscriberProfiles', 'contentLibrary', 'watchHistory', 'billingTransactions', 'mediaDqLogs'
]}})

semantic_metadata = [
    # ------------------ HEALTHCARE ------------------
    {
        "collection_name": "patientsInfo",
        "friendly_name": "Patients Demographics",
        "description": "Stores patient biological, contact, registration details, and health insurance information.",
        "primary_key": "patient_id",
        "relations": [],
        "fields": [
            {"field_name": "patient_id", "friendly_name": "Patient ID", "description": "Unique identifier assigned to each patient", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "first_name", "friendly_name": "First Name", "description": "Patient's first name", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "last_name", "friendly_name": "Last Name", "description": "Patient's last name", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "email", "friendly_name": "Email Address", "description": "Patient's email address", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "phone", "friendly_name": "Phone Number", "description": "10-digit customer mobile phone number", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "date_of_birth", "friendly_name": "Date of Birth", "description": "Patient's date of birth", "data_type": "date", "role": "dimension", "classification": "PII"},
            {"field_name": "gender", "friendly_name": "Gender", "description": "Patient's biological gender (Male, Female, Other)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "blood_group", "friendly_name": "Blood Group", "description": "Patient's blood type / blood group", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "insurance_provider", "friendly_name": "Insurance Provider", "description": "Healthcare insurance provider company", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "registered_date", "friendly_name": "Registration Date", "description": "Timestamp indicating when the patient profile was created", "data_type": "date", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "doctorDetails",
        "friendly_name": "Doctors Directory",
        "description": "Directory listing active doctors, their specialty, wings, fees, and patient ratings.",
        "primary_key": "doctor_id",
        "relations": [],
        "fields": [
            {"field_name": "doctor_id", "friendly_name": "Doctor ID", "description": "Unique identifier assigned to each doctor", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "doctor_name", "friendly_name": "Doctor Name", "description": "Doctor's full name", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "specialization", "friendly_name": "Specialization Area", "description": "Doctor's core specialized medical field (e.g. Cardiology)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "experience_years", "friendly_name": "Years of Experience", "description": "Total years of clinical experience", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "phone", "friendly_name": "Phone Number", "description": "Doctor's contact phone number", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "email", "friendly_name": "Email Address", "description": "Doctor's official email address", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "hospital_wing", "friendly_name": "Hospital Wing Location", "description": "Hospital building area or wing where doctor consults", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "consultation_fee", "friendly_name": "Consultation Fee", "description": "Cost in INR per consultation session", "data_type": "double", "role": "measure", "classification": "public"},
            {"field_name": "availability", "friendly_name": "Shift Availability", "description": "Availability times for appointments (e.g. Morning)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "rating", "friendly_name": "Doctor Rating", "description": "Average user-given rating (3.0 to 5.0)", "data_type": "double", "role": "measure", "classification": "public"}
        ]
    },
    {
        "collection_name": "medicalRecords",
        "friendly_name": "Medical History Records",
        "description": "Records patient diagnostic files, active prescriptions, billing charges, and doctor assignments.",
        "primary_key": "record_id",
        "relations": [
            {"local_field": "patient_id", "referenced_collection": "patientsInfo", "referenced_field": "patient_id"},
            {"local_field": "doctor_id", "referenced_collection": "doctorDetails", "referenced_field": "doctor_id"}
        ],
        "fields": [
            {"field_name": "record_id", "friendly_name": "Record ID", "description": "Unique identifier for the medical record file", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "patient_id", "friendly_name": "Patient ID", "description": "Foreign key linking to patient profiles", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "doctor_id", "friendly_name": "Doctor ID", "description": "Foreign key linking to prescribing doctor details", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "diagnosis", "friendly_name": "Medical Diagnosis", "description": "Determined diagnosis or medical condition", "data_type": "string", "role": "dimension", "classification": "private"},
            {"field_name": "treatment_plan", "friendly_name": "Treatment Plan", "description": "Prescribed treatment or procedure plan", "data_type": "string", "role": "dimension", "classification": "private"},
            {"field_name": "admission_date", "friendly_name": "Admission Date", "description": "Timestamp indicating hospital check-in/admission", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "discharge_date", "friendly_name": "Discharge Date", "description": "Timestamp indicating hospital check-out/discharge", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "billing_amount", "friendly_name": "Billing Charge", "description": "Total cost of stay and treatment in INR", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "prescription", "friendly_name": "Active Prescription", "description": "Prescribed medicine name", "data_type": "string", "role": "dimension", "classification": "private"},
            {"field_name": "status", "friendly_name": "Patient Status", "description": "Current status of the case (Discharged, Admitted, Under Observation)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "hospitalBeds",
        "friendly_name": "Bed Capacity Management",
        "description": "Tracks ward configuration, bed availability, daily rates, and patient occupants.",
        "primary_key": "bed_id",
        "relations": [
            {"local_field": "patient_id", "referenced_collection": "patientsInfo", "referenced_field": "patient_id"}
        ],
        "fields": [
            {"field_name": "bed_id", "friendly_name": "Bed ID", "description": "Unique identifier for hospital bed unit", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "ward_name", "friendly_name": "Ward Name", "description": "Name of the hospital department/ward", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "bed_type", "friendly_name": "Bed Category", "description": "Type of bed (Standard, ICU, Semi-Private, Deluxe)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "is_occupied", "friendly_name": "Is Occupied", "description": "Occupancy status of the bed (true/false)", "data_type": "boolean", "role": "dimension", "classification": "public"},
            {"field_name": "patient_id", "friendly_name": "Patient ID", "description": "Foreign key pointing to occupying patient, null if vacant", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "daily_charge", "friendly_name": "Daily Charge Rate", "description": "Cost in INR per day of occupancy", "data_type": "double", "role": "measure", "classification": "public"},
            {"field_name": "last_cleaned", "friendly_name": "Last Cleaned Time", "description": "Timestamp when bed sanitation last occurred", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "nurse_in_charge", "friendly_name": "Nurse In Charge", "description": "Name of nursing staff managing the bed unit", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "maintenance_status", "friendly_name": "Maintenance Status", "description": "Operational status of bed hardware (e.g. Active, Under Repair)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "floor", "friendly_name": "Floor Level", "description": "Hospital floor where ward is located", "data_type": "integer", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "healthcareDqLogs",
        "friendly_name": "Healthcare Data Quality Logs",
        "description": "Audit trails of data validation and quality constraints executed on healthcare datasets.",
        "primary_key": "log_id",
        "relations": [],
        "fields": [
            {"field_name": "log_id", "friendly_name": "Log ID", "description": "Unique identifier for each DQ run log entry", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "target_table", "friendly_name": "Target Table", "description": "The collection scanned by the DQ rule", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "field_checked", "friendly_name": "Checked Field", "description": "The specific field tested by the rule", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "rule_type", "friendly_name": "Rule Type", "description": "Type of check performed (NullCheck, TypeMismatch, OutlierDetection, SchemaValidation)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "records_scanned", "friendly_name": "Records Scanned", "description": "Total number of records scanned during the check", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "failed_count", "friendly_name": "Failed Records Count", "description": "Count of records failing the validation rule", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "execution_time_ms", "friendly_name": "Execution Time (ms)", "description": "Time taken in milliseconds to run the rule", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "run_date", "friendly_name": "Run Date", "description": "Date when the data quality check was executed", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "status", "friendly_name": "Run Status", "description": "Overall check result (Pass, Fail)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "severity", "friendly_name": "Error Severity", "description": "Validation failure impact rating (Low, Medium, High)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },

    # -------------------- MEDIA --------------------
    {
        "collection_name": "subscriberProfiles",
        "friendly_name": "Subscriber Profiles",
        "description": "Profiles of system platform subscribers, registration dates, genres, and billing tier levels.",
        "primary_key": "subscriber_id",
        "relations": [],
        "fields": [
            {"field_name": "subscriber_id", "friendly_name": "Subscriber ID", "description": "Unique identifier assigned to each subscriber profile", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "username", "friendly_name": "Username", "description": "Account login username", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "email", "friendly_name": "Email Address", "description": "Subscriber's contact email address", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "phone", "friendly_name": "Phone Number", "description": "Subscriber's phone number", "data_type": "string", "role": "dimension", "classification": "PII"},
            {"field_name": "subscription_tier", "friendly_name": "Subscription Tier", "description": "Subscribed account service plan level (Basic, Standard, Premium)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "payment_status", "friendly_name": "Payment Status", "description": "Account payment status (Paid, Pending, Overdue)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "signup_date", "friendly_name": "Registration Date", "description": "Timestamp indicating when subscription account profile was created", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "favorite_genre", "friendly_name": "Preferred Genre", "description": "Self-reported favorite genre of content", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "preferred_language", "friendly_name": "Preferred Language", "description": "Preferred language for audio or sub-titles", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "device_type", "friendly_name": "Primary Device Type", "description": "Primary device hardware used for streaming", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "contentLibrary",
        "friendly_name": "Content Library",
        "description": "Details of film and television content including genres, runtime, production, and license fees.",
        "primary_key": "content_id",
        "relations": [],
        "fields": [
            {"field_name": "content_id", "friendly_name": "Content ID", "description": "Unique identifier assigned to each movie/show entry", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "title", "friendly_name": "Content Title", "description": "Title of the content", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "genre", "friendly_name": "Genre Class", "description": "Content classification genre (e.g. Comedy)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "content_type", "friendly_name": "Content Type", "description": "Type of production (Movie, TV Show, Documentary)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "release_year", "friendly_name": "Release Year", "description": "Year when the content was first released", "data_type": "integer", "role": "dimension", "classification": "public"},
            {"field_name": "duration_minutes", "friendly_name": "Duration (Minutes)", "description": "Total length of the movie or show episode in minutes", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "rating", "friendly_name": "Viewer Rating", "description": "Average viewer rating score (1.0 to 10.0)", "data_type": "double", "role": "measure", "classification": "public"},
            {"field_name": "language", "friendly_name": "Original Language", "description": "Language of the original production", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "director", "friendly_name": "Director", "description": "Name of director of the show or movie", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "license_cost", "friendly_name": "License Cost", "description": "Cost in USD paid by the platform for streaming license", "data_type": "double", "role": "measure", "classification": "private"}
        ]
    },
    {
        "collection_name": "watchHistory",
        "friendly_name": "Streaming Log History",
        "description": "Log records tracking subscriber viewing timelines, durations, ratings, and download activities.",
        "primary_key": "history_id",
        "relations": [
            {"local_field": "subscriber_id", "referenced_collection": "subscriberProfiles", "referenced_field": "subscriber_id"},
            {"local_field": "content_id", "referenced_collection": "contentLibrary", "referenced_field": "content_id"}
        ],
        "fields": [
            {"field_name": "history_id", "friendly_name": "History ID", "description": "Unique log identifier for watch event", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "subscriber_id", "friendly_name": "Subscriber ID", "description": "Foreign key connecting to subscriber profile", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "content_id", "friendly_name": "Content ID", "description": "Foreign key connecting to streamed content details", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "watch_duration_minutes", "friendly_name": "Stream Duration (m)", "description": "Number of minutes content was played", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "completion_percentage", "friendly_name": "Completion %", "description": "Percentage of total length watched by the subscriber", "data_type": "double", "role": "measure", "classification": "public"},
            {"field_name": "device_used", "friendly_name": "Device Used", "description": "Hardware device used during watch session", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "timestamp", "friendly_name": "Viewing Timestamp", "description": "Timestamp indicating watch session initialization", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "rating_given", "friendly_name": "User Rating Given", "description": "Rating out of 5 stars submitted by the subscriber (if any)", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "is_downloaded", "friendly_name": "Is Downloaded", "description": "Whether content was downloaded for offline playing", "data_type": "boolean", "role": "dimension", "classification": "public"},
            {"field_name": "audio_language", "friendly_name": "Audio Language Streamed", "description": "Language chosen for watch session audio", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "billingTransactions",
        "friendly_name": "Subscription Billings",
        "description": "Log records tracking subscription payments, invoice details, taxes, and renewal dates.",
        "primary_key": "billing_id",
        "relations": [
            {"local_field": "subscriber_id", "referenced_collection": "subscriberProfiles", "referenced_field": "subscriber_id"}
        ],
        "fields": [
            {"field_name": "billing_id", "friendly_name": "Billing ID", "description": "Unique identifier for transaction invoice receipt", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "subscriber_id", "friendly_name": "Subscriber ID", "description": "Foreign key connecting to subscriber profiles", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "amount", "friendly_name": "Transaction Amount", "description": "Transaction value charged in INR", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "payment_method", "friendly_name": "Payment Method", "description": "Payment gateway channel (Credit Card, UPI, PayPal, NetBanking)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "transaction_date", "friendly_name": "Transaction Date", "description": "Date and time the subscription payment occurred", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "status", "friendly_name": "Transaction Status", "description": "Payment clearance status (Success, Failed, Pending)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "invoice_number", "friendly_name": "Invoice Number", "description": "Unique invoice receipt serial number", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "tax_amount", "friendly_name": "GST Tax Amount", "description": "18% GST tax charged on top of subscription amount in INR", "data_type": "double", "role": "measure", "classification": "private"},
            {"field_name": "promo_code_used", "friendly_name": "Promo Code Applied", "description": "Discount coupon applied on checkout (if any)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "renewal_date", "friendly_name": "Next Renewal Date", "description": "Date when the next billing cycle is initialized", "data_type": "date", "role": "dimension", "classification": "public"}
        ]
    },
    {
        "collection_name": "mediaDqLogs",
        "friendly_name": "Media Data Quality Logs",
        "description": "Validation trails executed to check consistency of media subscription and streaming records.",
        "primary_key": "log_id",
        "relations": [],
        "fields": [
            {"field_name": "log_id", "friendly_name": "Log ID", "description": "Unique identifier for each DQ run log entry", "data_type": "string", "role": "identifier", "classification": "public"},
            {"field_name": "target_table", "friendly_name": "Target Table", "description": "The collection scanned by the DQ rule", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "field_checked", "friendly_name": "Checked Field", "description": "The specific field tested by the rule", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "rule_type", "friendly_name": "Rule Type", "description": "Type of check performed (NullCheck, TypeMismatch, OutlierDetection, SchemaValidation)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "records_scanned", "friendly_name": "Records Scanned", "description": "Total number of database records scanned during the check", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "failed_count", "friendly_name": "Failed Records Count", "description": "Count of records failing the validation checks", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "execution_time_ms", "friendly_name": "Execution Time (ms)", "description": "Time taken in milliseconds to run the rule", "data_type": "integer", "role": "measure", "classification": "public"},
            {"field_name": "run_date", "friendly_name": "Run Date", "description": "Date when the data quality check was executed", "data_type": "date", "role": "dimension", "classification": "public"},
            {"field_name": "status", "friendly_name": "Run Status", "description": "Overall check result (Pass, Fail)", "data_type": "string", "role": "dimension", "classification": "public"},
            {"field_name": "severity", "friendly_name": "Error Severity", "description": "Validation failure impact rating (Low, Medium, High)", "data_type": "string", "role": "dimension", "classification": "public"}
        ]
    }
]

bulk_meta = [InsertOne(doc) for doc in semantic_metadata]
db['semanticMetaStore'].bulk_write(bulk_meta)
print("[OK] Successfully seeded 'semanticMetaStore' with new schemas")


# ----------------------------------------------------
# 6. LINEAGE CONFIGURATION FOR HEALTHCARE AND MEDIA
# ----------------------------------------------------
print("Adding column-level lineage metadata to new collections...")

for doc in db['semanticMetaStore'].find({"collection_name": {"$in": [
    'patientsInfo', 'medicalRecords', 'doctorDetails', 'hospitalBeds', 'healthcareDqLogs',
    'subscriberProfiles', 'contentLibrary', 'watchHistory', 'billingTransactions', 'mediaDqLogs'
]}}):
    col_name = doc["collection_name"]
    fields = doc.get("fields", [])
    
    updated_fields = []
    for field in fields:
        field_name = field["field_name"]
        
        # Define realistic lineage mapping
        source_tables = [col_name]
        source_columns = [field_name]
        
        # Healthcare Custom Lineages
        if field_name == "patient_id" and col_name in ["medicalRecords", "hospitalBeds"]:
            transformation = "Foreign Key link mapping: Reference to patientsInfo.patient_id"
        elif field_name == "doctor_id" and col_name == "medicalRecords":
            transformation = "Foreign Key link mapping: Reference to doctorDetails.doctor_id"
        elif field_name == "billing_amount" and col_name == "medicalRecords":
            transformation = "Calculated field: Derived from consultation fees, treatment plan rates, and bed occupancy days"
        
        # Media Custom Lineages
        elif field_name == "subscriber_id" and col_name in ["watchHistory", "billingTransactions"]:
            transformation = "Foreign Key link mapping: Reference to subscriberProfiles.subscriber_id"
        elif field_name == "content_id" and col_name == "watchHistory":
            transformation = "Foreign Key link mapping: Reference to contentLibrary.content_id"
        elif field_name == "tax_amount" and col_name == "billingTransactions":
            transformation = "Calculated field: Derived as 18% GST (amount * 0.18)"
        elif field_name == "renewal_date" and col_name == "billingTransactions":
            transformation = "Calculated field: Derived as payment transaction_date plus 30 days"
            
        else:
            transformation = f"Direct data ingest copy from source {col_name}.{field_name}"
            
        field["lineage"] = {
            "source_tables": source_tables,
            "source_columns": source_columns,
            "transformation": transformation
        }
        updated_fields.append(field)
        
    db['semanticMetaStore'].update_one(
        {"_id": doc["_id"]},
        {"$set": {"fields": updated_fields}}
    )
    print(f"[OK] Seeded lineage for: {col_name}")

print("\nDatabase initialization complete! Healthcare, Media, and Users seeded successfully with indexes and lineage.")
