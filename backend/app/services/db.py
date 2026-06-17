from datetime import datetime, timedelta
from ..config.settings import get_db
from ..schemas.code_gen import CodeGenerationRequest

def get_or_create_quota(db, role: str) -> dict:
    if not role:
        role = "Data Engineering"
    quota = db["modelQuotas"].find_one({"role": role})
    
    if not quota:
        default_reset_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
        quota = {
            "role": role,
            "limits": {
                "gpt-4o": { "total_tokens": 500000, "used_tokens": 0 },
                "gemini-3.5-flash": { "total_tokens": 10000000, "used_tokens": 0 },
                "mistral": { "total_tokens": 1000000, "used_tokens": 0 },
                "llama": { "total_tokens": 1000000, "used_tokens": 0 },
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

def resolve_domains_if_needed(request: CodeGenerationRequest, db_inst):
    if not request.sample_data_size or request.sample_data_size <= 0:
        request.sample_data_size = 1000
        
    if not request.tables and request.domains:
        cursor = db_inst["tableStatusNew"].find({
            "approvalStatus": "approved",
            "domain": {"$in": request.domains}
        })
        tables_in_domains = [doc["tableName"] for doc in cursor]
        
        all_cols = []
        for t_name in tables_in_domains:
            meta_doc = db_inst["semanticMetaStore"].find_one({"collection_name": t_name})
            if meta_doc and "fields" in meta_doc:
                all_cols.extend([f["field_name"] for f in meta_doc["fields"]])
            else:
                sample_doc = db_inst[t_name].find_one()
                if sample_doc:
                    all_cols.extend([k for k in sample_doc.keys() if k != "_id"])
                    
        request.tables = tables_in_domains
        request.columns = list(set(all_cols))

def clean_column_name(name: str) -> str:
    import re
    name_str = str(name).strip()
    name_with_underscores = re.sub(r'\s+', '_', name_str)
    cleaned = re.sub(r'[^a-zA-Z0-9_]', '_', name_with_underscores)
    cleaned = re.sub(r'_+', '_', cleaned)
    cleaned = cleaned.strip('_')
    return cleaned

def generate_dummy_data(columns_schema: list, tableName: str) -> list:
    import random
    from faker import Faker
    import pandas as pd
    fake = Faker()
    
    records = []
    pk_col, pk_type, pk_examples = columns_schema[0]
    
    for i in range(1500):
        record = {}
        if "int" in pk_type.lower():
            pk_val = 10000 + i
        elif any(t in pk_type.lower() for t in ("float", "double", "decimal", "number", "numeric", "real")):
            pk_val = float(10000 + i)
        else:
            prefix = "".join([c for c in tableName if c.isalnum()])[:3].upper()
            if not prefix:
                prefix = "TBL"
            pk_val = f"{prefix}-{10000 + i}"
            
        record[pk_col] = pk_val
        
        for item in columns_schema[1:]:
            col_name, data_type, examples_list = item
            col_lower = col_name.lower()
            type_lower = data_type.lower()
            
            if examples_list:
                chosen_val = random.choice(examples_list)
                try:
                    if "int" in type_lower:
                        val = int(float(chosen_val))
                    elif any(t in type_lower for t in ("float", "double", "decimal", "number", "numeric", "real")):
                        val = float(chosen_val)
                    elif any(t in type_lower for t in ("date", "time", "timestamp")):
                        try:
                            val = pd.to_datetime(chosen_val).to_pydatetime()
                        except Exception:
                            val = datetime.now() - timedelta(days=random.randint(1, 1000), seconds=random.randint(0, 86400))
                    elif "bool" in type_lower or "boolean" in type_lower:
                        val = True if str(chosen_val).lower() in ('true', '1', 'yes', 'y') else False
                    else:
                        val = chosen_val
                except Exception:
                    val = chosen_val
            else:
                # Fallback to generating data on our own
                if "int" in type_lower:
                    if "age" in col_lower:
                        val = random.randint(18, 90)
                    elif "year" in col_lower:
                        val = random.randint(1990, 2026)
                    elif "rating" in col_lower:
                        val = random.randint(1, 5)
                    else:
                        val = random.randint(1, 10000)
                elif any(t in type_lower for t in ("float", "double", "decimal", "number", "numeric", "real")):
                    if any(k in col_lower for k in ("fee", "amount", "cost", "charge", "rate")):
                        val = round(random.uniform(10.0, 5000.0), 2)
                    elif "rating" in col_lower:
                        val = round(random.uniform(1.0, 5.0), 1)
                    else:
                        val = round(random.uniform(1.0, 1000.0), 2)
                elif any(t in type_lower for t in ("date", "time", "timestamp")):
                    val = datetime.now() - timedelta(days=random.randint(1, 1000), seconds=random.randint(0, 86400))
                elif "bool" in type_lower or "boolean" in type_lower:
                    val = random.choice([True, False])
                else:
                    if "email" in col_lower:
                        val = fake.ascii_free_email()
                    elif "phone" in col_lower or "mobile" in col_lower:
                        val = fake.numerify("##########")
                    elif "name" in col_lower:
                        if "first" in col_lower:
                            val = fake.first_name()
                        elif "last" in col_lower:
                            val = fake.last_name()
                        else:
                            val = fake.name()
                    elif "gender" in col_lower:
                        val = random.choice(["Male", "Female", "Other"])
                    elif "address" in col_lower:
                        val = fake.address().replace('\n', ', ')
                    elif "city" in col_lower:
                        val = fake.city()
                    elif "country" in col_lower:
                        val = fake.country()
                    elif "company" in col_lower:
                        val = fake.company()
                    elif "status" in col_lower:
                        val = random.choice(["Active", "Inactive", "Pending", "Completed"])
                    else:
                        val = fake.word().capitalize()
                    
            record[col_name] = val
        records.append(record)
    return records

