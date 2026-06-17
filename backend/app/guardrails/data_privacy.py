import re
from ..config.settings import get_db

def mask_email(val: str) -> str:
    if not val or '@' not in val:
        return val
    parts = val.split('@', 1)
    username = parts[0]
    domain = parts[1]
    if len(username) <= 1:
        return f"*@{domain}"
    return f"{username[0]}***@{domain}"

def mask_phone(val: str) -> str:
    if not val:
        return val
    val_str = str(val)
    digits = re.sub(r'\D', '', val_str)
    if len(digits) < 4:
        return "****"
    return f"******{digits[-4:]}"

def mask_aadhaar(val: str) -> str:
    if not val:
        return val
    val_str = str(val)
    digits = re.sub(r'\D', '', val_str)
    if len(digits) == 12:
        if '-' in val_str:
            return f"XXXX-XXXX-{digits[-4:]}"
        elif ' ' in val_str:
            return f"XXXX XXXX {digits[-4:]}"
        else:
            return f"XXXXXXXX{digits[-4:]}"
    return f"XXXXXXXX{val_str[-4:]}"

def mask_credit_card(val: str) -> str:
    if not val:
        return val
    val_str = str(val)
    digits = re.sub(r'\D', '', val_str)
    if len(digits) >= 12:
        if '-' in val_str:
            return f"XXXX-XXXX-XXXX-{digits[-4:]}"
        else:
            return f"XXXXXXXXXXXX{digits[-4:]}"
    return f"XXXXXXXX{val_str[-4:]}"

def mask_name(val: str) -> str:
    if not val:
        return val
    val_str = str(val)
    parts = val_str.split()
    masked_parts = []
    for p in parts:
        if len(p) <= 1:
            masked_parts.append("*")
        else:
            masked_parts.append(f"{p[0]}***")
    return " ".join(masked_parts)

def mask_sensitive_dataframe(dataframe: list, role: str, requested_tables: list) -> list:
    if not dataframe or not role:
        return dataframe
        
    # High-privilege roles bypass masking
    if role.lower() in ("admin", "lead", "project lead", "vertical lead"):
        return dataframe
        
    db = get_db()
    
    # Fetch custom piiForGuardrails rules
    pii_rules = []
    try:
        pii_rules = list(db["piiForGuardrails"].find())
    except Exception as e:
        print(f"Failed to fetch piiForGuardrails for masking: {e}")
    
    # 1. Fetch PII classified columns from semanticMetaStore for all requested tables
    sensitive_columns = set()
    for table_name in requested_tables:
        meta_store_doc = db["semanticMetaStore"].find_one({"collection_name": table_name})
        if meta_store_doc and "fields" in meta_store_doc:
            for f in meta_store_doc["fields"]:
                field_name = f["field_name"]
                classification = f.get("classification", "").lower()
                if classification == "pii":
                    sensitive_columns.add(field_name)
                    
    # Heuristics mapping for column names to specialized mask functions
    pii_patterns = [
        ("email", mask_email),
        ("phone", mask_phone),
        ("mobile", mask_phone),
        ("aadhaar", mask_aadhaar),
        ("card_number", mask_credit_card),
        ("credit_card", mask_credit_card),
        ("first_name", mask_name),
        ("last_name", mask_name),
        ("customer_name", mask_name),
        ("name", mask_name)
    ]
    
    masked_dataframe = []
    for row in dataframe:
        new_row = {}
        for col, val in row.items():
            if val is None:
                new_row[col] = val
                continue
                
            col_lower = col.lower()
            
            # Check if this column matches any custom PII parameters
            matched_rule = None
            col_clean = col_lower.replace(" ", "").replace("_", "")
            for rule in pii_rules:
                param = rule.get("piiParameter", "").lower()
                param_clean = param.replace(" ", "").replace("_", "")
                if param_clean and (param_clean in col_clean or col_clean in param_clean):
                    matched_rule = rule
                    break
            
            if matched_rule is not None:
                pii_mask_flag = matched_rule.get("piiMask", False)
                if not pii_mask_flag:
                    # piiMask is False -> do not mask this column
                    new_row[col] = val
                else:
                    # piiMask is True -> strictly mask it
                    masked = False
                    for pattern, mask_func in pii_patterns:
                        if pattern in col_lower:
                            new_row[col] = mask_func(str(val))
                            masked = True
                            break
                    if not masked:
                        new_row[col] = "[MASKED]"
                continue
                
            # Default fallbacks if no custom parameter rule matched
            masked = False
            
            # Apply specific mask function if column name matches pattern
            for pattern, mask_func in pii_patterns:
                if pattern in col_lower:
                    new_row[col] = mask_func(str(val))
                    masked = True
                    break
                    
            if not masked and col in sensitive_columns:
                # Default fallback mask for general PII columns
                new_row[col] = "[MASKED]"
                masked = True
                
            if not masked:
                new_row[col] = val
                
        masked_dataframe.append(new_row)
        
    return masked_dataframe
