from fastapi import HTTPException
from ..config.settings import get_db

def validate_schema_access(userId: str, requested_tables: list, requested_columns: list):
    if not userId:
        # If no user ID is provided, we can bypass or default restrict. 
        # For security, let's allow if no userId (e.g. system tasks/calls) but check if we have database context.
        return
        
    db = get_db()
    
    # 1. Fetch user to check allowed domains
    user = db["sdlcUsersNew"].find_one({"userId": userId})
    if not user:
        user = db["sdlcUsersTemp"].find_one({"userId": userId})
        
    if not user:
        raise HTTPException(
            status_code=403,
            detail=f"Access Denied: User '{userId}' not found in the system."
        )
        
    role = user.get("role", "")
    if role.lower() == "admin":
        return  # Admin bypasses schema restrictions
        
    user_domains = user.get("domain", [])
    if isinstance(user_domains, str):
        user_domains = [user_domains]
        
    all_valid_columns = set()
    
    for table_name in requested_tables:
        # Check approval status and table domain
        table_status = db["tableStatusNew"].find_one({"tableName": table_name})
        if not table_status:
            table_status = db["tableStatus"].find_one({"tableName": table_name})
            
        if not table_status:
            raise HTTPException(
                status_code=403,
                detail=f"Access Denied: Table '{table_name}' does not exist or is unregistered."
            )
            
        if table_status.get("approvalStatus", "").lower() != "approved":
            raise HTTPException(
                status_code=403,
                detail=f"Access Denied: Table '{table_name}' is pending approval or has been rejected."
            )
            
        table_domain = table_status.get("domain") or table_status.get("tableDomain")
        if table_domain and table_domain not in user_domains:
            raise HTTPException(
                status_code=403,
                detail=f"Access Denied: Table '{table_name}' belongs to domain '{table_domain}' which you are not authorized to access."
            )
            
        # Collect allowed columns for this table
        meta_store_doc = db["semanticMetaStore"].find_one({"collection_name": table_name})
        if meta_store_doc and "fields" in meta_store_doc:
            for f in meta_store_doc["fields"]:
                all_valid_columns.add(f["field_name"])
        else:
            sample = db[table_name].find_one()
            if sample:
                all_valid_columns.update(k for k in sample.keys() if k != "_id")
                
    # Validate columns
    for col in requested_columns:
        if col == "*" or not col:
            continue
        # Verify requested columns exist in the allowed table set
        if col not in all_valid_columns:
            raise HTTPException(
                status_code=403,
                detail=f"Access Denied: Column '{col}' is not present in approved schemas for the selected tables."
            )
