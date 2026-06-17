import io
import re
import pandas as pd
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Form, UploadFile, File, BackgroundTasks
from ..config.settings import get_db
from ..services.email import send_approval_email
from ..services.db import get_or_create_quota, clean_column_name, generate_dummy_data

router = APIRouter(tags=["Admin Operations"])

@router.get("/metadata")
async def get_metadata(role: str = None, domains: str = None):
    try:
        db = get_db()
        # Determine allowed collections dynamically based on role and domain from tableStatusNew
        query = {"approvalStatus": "approved", "tableType": "sdlc"}
        
        if domains and role != "admin":
            domain_list = [d.strip() for d in domains.split(",") if d.strip()]
            if domain_list and "admin" not in domain_list:
                query["domain"] = {"$in": domain_list}
        elif role and role != "admin":
            query["tableRole"] = role
        elif not role:
            query["tableRole"] = {"$ne": "system"}
                
        collection_name = "tableStatusNew"
        if collection_name not in db.list_collection_names() or db[collection_name].count_documents({}) == 0:
            collection_name = "tableStatus"
            query.pop("domain", None)
            query.pop("tableType", None)
            if role and role != "admin":
                query["tableRole"] = role
            elif not role:
                query["tableRole"] = {"$ne": "system"}
            
        cursor = db[collection_name].find(query)
        allowed = [doc["tableName"] for doc in cursor]
            
        metadata = {}
        for col_name in allowed:
            doc = db[col_name].find_one()
            if doc:
                fields = [key for key in doc.keys() if key != '_id']
                metadata[col_name] = fields
            else:
                metadata[col_name] = []
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/cbi/metadata")
async def get_cbi_metadata():
    try:
        db = get_db()
        cursor = db["tableStatusNew"].find({"approvalStatus": "approved"})
        
        metadata = {}
        for doc in cursor:
            table_name = doc["tableName"]
            domain = doc.get("domain") or doc.get("tableDomain", "Unknown")
            
            meta_store_doc = db["semanticMetaStore"].find_one({"collection_name": table_name})
            columns = []
            if meta_store_doc and "fields" in meta_store_doc:
                columns = [f["field_name"] for f in meta_store_doc["fields"]]
            else:
                sample_doc = db[table_name].find_one()
                if sample_doc:
                    columns = [key for key in sample_doc.keys() if key != '_id']
                    
            metadata[table_name] = {
                "domain": domain,
                "columns": columns
            }
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quota")
async def get_quota_details(role: str = "Data Engineering"):
    try:
        db = get_db()
        quota = get_or_create_quota(db, role)
        if "_id" in quota:
            quota["_id"] = str(quota["_id"])
        return quota
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/role-token-consumption")
async def get_role_token_consumption(role: str):
    try:
        db = get_db()
        cursor = db["roleTokenConsumption"].find({"role": role}).sort("timestamp", -1)
        logs = []
        for doc in cursor:
            t = doc.get("timestamp")
            timestamp_str = t.strftime("%Y-%m-%d %H:%M:%S") if isinstance(t, datetime) else str(t)
            logs.append({
                "userId": doc.get("userId", "unknown"),
                "role": doc.get("role", ""),
                "timestamp": timestamp_str,
                "tokens_consumed": doc.get("tokens_consumed", 0),
                "cost": doc.get("cost", 0.0)
            })
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-table")
async def create_table(
    background_tasks: BackgroundTasks,
    tableName: str = Form(...),
    tableSchema: str = Form(...),
    userId: str = Form(...),
    role: str = Form(...),
    tableDomain: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        db = get_db()
        cleaned_tableName = clean_column_name(tableName)
        if not cleaned_tableName:
            raise HTTPException(status_code=400, detail="Invalid table name provided.")
            
        existing_table = db["tableStatusNew"].find_one({"tableName": cleaned_tableName})
        if existing_table:
            raise HTTPException(status_code=400, detail=f"Table '{cleaned_tableName}' already exists or is pending approval.")
            
        contents = await file.read()
        try:
            df = pd.read_excel(io.BytesIO(contents), header=None)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {str(e)}")
            
        df = df.dropna(how='all')
        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded file has no data entered.")
            
        if df.shape[1] != 3:
            raise HTTPException(status_code=400, detail="Ensure the uploaded file has only 3 columns of data.")
            
        first_col_val = str(df.iloc[0, 0]).lower()
        second_col_val = str(df.iloc[0, 1]).lower()
        
        if any(kw in first_col_val for kw in ("name", "column", "field")) and any(kw in second_col_val for kw in ("type", "datatype")):
            df = df.iloc[1:]
            
        df = df.dropna(subset=[df.columns[0], df.columns[1]])
        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded file has no valid column mappings.")
            
        columns_schema = []
        for index, row in df.iterrows():
            raw_col_name = str(row.iloc[0]).strip()
            raw_data_type = str(row.iloc[1]).strip()
            raw_examples = str(row.iloc[2]).strip() if pd.notnull(row.iloc[2]) else ""
            if raw_examples.lower() in ("nan", "none", "null"):
                raw_examples = ""
            examples_list = [ex.strip() for ex in raw_examples.split(",") if ex.strip()] if raw_examples else []
            
            cleaned_col = clean_column_name(raw_col_name)
            if not cleaned_col:
                continue
            columns_schema.append((cleaned_col, raw_data_type, examples_list))
            
        if not columns_schema:
            raise HTTPException(status_code=400, detail="No valid column definitions found in the file.")
            
        records = generate_dummy_data(columns_schema, cleaned_tableName)
        
        db[cleaned_tableName].delete_many({})
        db[cleaned_tableName].insert_many(records)
        
        pk_col = columns_schema[0][0]
        db[cleaned_tableName].create_index(pk_col, unique=True)
        
        fields_metadata = []
        for index, (col_name, data_type, examples_list) in enumerate(columns_schema):
            friendly_name = col_name.replace("_", " ").title()
            desc = f"Stores the {friendly_name.lower()} details"
            
            dt_lower = data_type.lower()
            norm_type = "string"
            if "int" in dt_lower:
                norm_type = "integer"
            elif any(t in dt_lower for t in ("float", "double", "decimal", "number", "numeric", "real")):
                norm_type = "double"
            elif any(t in dt_lower for t in ("date", "time", "timestamp")):
                norm_type = "date"
            elif "bool" in dt_lower or "boolean" in dt_lower:
                norm_type = "boolean"
                
            role_field = "measure" if norm_type in ("integer", "double") else "dimension"
            if index == 0:
                role_field = "identifier"
                
            classification = "PII" if any(k in col_name.lower() for k in ["email", "phone", "name", "address", "aadhaar"]) else "public"
            
            lineage = {
                "source_tables": [cleaned_tableName],
                "source_columns": [col_name],
                "transformation": f"Direct data ingest copy from source {cleaned_tableName}.{col_name}"
            }
            
            fields_metadata.append({
                "field_name": col_name,
                "friendly_name": friendly_name,
                "description": desc,
                "data_type": norm_type,
                "role": role_field,
                "classification": classification,
                "lineage": lineage
            })
            
        semantic_doc = {
            "collection_name": cleaned_tableName,
            "friendly_name": cleaned_tableName.replace("_", " ").title(),
            "description": f"Custom user table for storing {cleaned_tableName} records.",
            "primary_key": pk_col,
            "relations": [],
            "fields": fields_metadata,
            "business_name": cleaned_tableName.replace("_", " ").title()
        }
        
        db["semanticMetaStore"].delete_many({"collection_name": cleaned_tableName})
        db["semanticMetaStore"].insert_one(semantic_doc)
        
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        created_str = datetime.now(ist_tz).strftime("%d-%m-%Y-%H-%M-%S") + " IST"
        
        status_doc = {
            "tableName": cleaned_tableName,
            "approvalStatus": "pending",
            "createdUserId": userId,
            "createdTimestamp": created_str,
            "approvalTimestamp": "",
            "tableRole": role,
            "tableSchema": tableSchema,
            "tableDomain": tableDomain,
            "domain": tableDomain,
            "tableType": "sdlc"
        }
        db["tableStatusNew"].insert_one(status_doc)
        
        background_tasks.add_task(send_approval_email, cleaned_tableName, tableSchema, userId, role, created_str)
        
        return {"status": "success", "message": "table creation accomplished and approval email sent to admin", "tableName": cleaned_tableName}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pending-approvals")
async def get_pending_approvals():
    try:
        db = get_db()
        cursor = db["tableStatusNew"].find({"approvalStatus": "pending"})
        pending = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            pending.append(doc)
        return pending
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/approve-table/{tableName}")
async def approve_table(tableName: str):
    try:
        db = get_db()
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        approval_str = datetime.now(ist_tz).strftime("%d-%m-%Y-%H-%M-%S") + " IST"
        
        res = db["tableStatusNew"].update_one(
            {"tableName": tableName, "approvalStatus": "pending"},
            {"$set": {"approvalStatus": "approved", "approvalTimestamp": approval_str}}
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Pending table request not found")
            
        return {"status": "success", "message": f"Table '{tableName}' approved successfully."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reject-table/{tableName}")
async def reject_table(tableName: str):
    try:
        db = get_db()
        res = db["tableStatusNew"].update_one(
            {"tableName": tableName, "approvalStatus": "pending"},
            {"$set": {"approvalStatus": "rejected"}}
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Pending table request not found")
            
        return {"status": "success", "message": f"Table '{tableName}' rejected successfully."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/semantic-layer/{tableName}")
async def get_semantic_layer(tableName: str):
    try:
        db = get_db()
        doc = db["semanticMetaStore"].find_one({"collection_name": tableName})
        if not doc:
            raise HTTPException(status_code=404, detail="Semantic layer metadata not found")
            
        doc["_id"] = str(doc["_id"])
        return doc
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pending-user-registrations")
async def get_pending_user_registrations():
    try:
        db = get_db()
        cursor = db["sdlcUsersTemp"].find()
        pending = []
        for doc in cursor:
            pending.append({
                "userId": doc.get("userId"),
                "role": doc.get("role")
            })
        return pending
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/approve-user/{userId}")
async def approve_user(userId: str):
    try:
        db = get_db()
        temp_user = db["sdlcUsersTemp"].find_one({"userId": userId})
        if not temp_user:
            raise HTTPException(status_code=404, detail="Pending user registration not found")
            
        temp_user.pop("_id", None)
        db["sdlcUsersNew"].insert_one(temp_user)
        db["sdlcUsersTemp"].delete_one({"userId": userId})
        
        return {"status": "success", "message": f"User '{userId}' approved and registered successfully."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reject-user/{userId}")
async def reject_user(userId: str):
    try:
        db = get_db()
        res = db["sdlcUsersTemp"].delete_one({"userId": userId})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Pending user registration not found")
            
        return {"status": "success", "message": f"User '{userId}' registration request rejected."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/pii-guardrails")
async def get_pii_guardrails():
    try:
        db = get_db()
        cursor = db["piiForGuardrails"].find()
        pii_list = []
        for doc in cursor:
            pii_list.append({
                "piiParameter": doc.get("piiParameter", ""),
                "piiReason": doc.get("piiReason", ""),
                "piiPass": doc.get("piiPass", False),
                "piiMask": doc.get("piiMask", False)
            })
        return pii_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/pii-guardrails")
async def add_pii_guardrail(payload: dict):
    try:
        db = get_db()
        pii_parameter = payload.get("piiParameter", "").strip()
        pii_reason = payload.get("piiReason", "").strip()
        pii_pass = bool(payload.get("piiPass", False))
        pii_mask = bool(payload.get("piiMask", False))
        
        if not pii_parameter:
            raise HTTPException(status_code=400, detail="PII Parameter cannot be empty.")
        if len(pii_reason) > 50:
            raise HTTPException(status_code=400, detail="PII Reason cannot exceed 50 characters.")
            
        db["piiForGuardrails"].update_one(
            {"piiParameter": pii_parameter},
            {"$set": {
                "piiParameter": pii_parameter,
                "piiReason": pii_reason,
                "piiPass": pii_pass,
                "piiMask": pii_mask
            }},
            upsert=True
        )
        return {"status": "success", "message": "PII Parameter added/updated successfully."}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/admin/pii-guardrails/{piiParameter}")
async def delete_pii_guardrail(piiParameter: str):
    try:
        db = get_db()
        res = db["piiForGuardrails"].delete_one({"piiParameter": piiParameter})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="PII Parameter not found")
        return {"status": "success", "message": f"PII Parameter '{piiParameter}' deleted successfully."}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

