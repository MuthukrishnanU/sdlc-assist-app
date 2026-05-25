from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import CodeGenerationRequest, CodeGenerationResponse, SimulationRequest, SimulationResponse, GitHubPushRequest
from .generator import generator
import uvicorn
from datetime import datetime
import csv
import io
import base64
import httpx
import json
import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Reload environment variables on file change
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

app = FastAPI(title="SDLC Assist API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "SDLC Assist API is running"}

@app.get("/metadata")
async def get_metadata():
    try:
        if not MONGODB_URI:
            raise HTTPException(status_code=500, detail="MONGODB_URI is not set in environment variables")
        client = MongoClient(MONGODB_URI)
        db = client["bankingSdlcDB"]
        collections = db.list_collection_names()
        
        metadata = {}
        for col_name in collections:
            if col_name.startswith("system."):
                continue
            doc = db[col_name].find_one()
            if doc:
                # Extract fields and ignore MongoDB internal '_id' field
                fields = [key for key in doc.keys() if key != '_id']
                metadata[col_name] = fields
            else:
                metadata[col_name] = []
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/simulate", response_model=SimulationResponse)
async def simulate_data(request: SimulationRequest):
    try:
        if not MONGODB_URI:
            raise HTTPException(status_code=500, detail="MONGODB_URI is not set in environment variables")
        client = MongoClient(MONGODB_URI)
        db = client["bankingSdlcDB"]

        # Fetch and clean data from selected collections
        data_by_table = {}
        for table in request.tables:
            cursor = db[table].find().limit(request.sample_data_size)
            records = []
            for doc in cursor:
                doc_cleaned = {}
                for k, v in doc.items():
                    if k == '_id':
                        continue
                    if isinstance(v, datetime):
                        doc_cleaned[k] = v.strftime("%Y-%m-%d %H:%M:%S")
                    else:
                        doc_cleaned[k] = v
                records.append(doc_cleaned)
            data_by_table[table] = records

        if not request.tables:
            return SimulationResponse(dataframe=[], column_details={})

        # Start with primary table
        primary_table = request.tables[0]
        joined_records = data_by_table.get(primary_table, [])

        # Dynamic join logic
        for table in request.tables[1:]:
            other_records = data_by_table.get(table, [])
            if not joined_records or not other_records:
                continue
            
            # Find common keys
            common_keys = set(joined_records[0].keys()).intersection(other_records[0].keys())
            join_key = None
            if 'customer_id' in common_keys:
                join_key = 'customer_id'
            elif 'account_id' in common_keys:
                join_key = 'account_id'
            elif common_keys:
                join_key = list(common_keys)[0]

            if join_key:
                lookup = {}
                for r in other_records:
                    k_val = r.get(join_key)
                    if k_val:
                        if k_val not in lookup:
                            lookup[k_val] = r
                
                merged_records = []
                for r in joined_records:
                    k_val = r.get(join_key)
                    matching = lookup.get(k_val, {})
                    merged_records.append({**r, **matching})
                joined_records = merged_records

        # Select only the requested columns
        final_dataframe = []
        for r in joined_records:
            filtered_row = {col: r[col] for col in request.columns if col in r}
            # Fill missing requested columns with None
            for col in request.columns:
                if col not in filtered_row:
                    filtered_row[col] = None
            final_dataframe.append(filtered_row)

        # Retrieve column details from semanticMetaStore
        column_details = {}
        for table in request.tables:
            meta_doc = db['semanticMetaStore'].find_one({"collection_name": table})
            if meta_doc:
                for field in meta_doc.get("fields", []):
                    f_name = field["field_name"]
                    if f_name in request.columns:
                        column_details[f_name] = {
                            "friendly_name": field["friendly_name"],
                            "description": field["description"],
                            "data_type": field["data_type"],
                            "role": field["role"],
                            "classification": field["classification"]
                        }

        # Handle columns not explicitly detailed in meta store (fallback)
        for col in request.columns:
            if col not in column_details:
                column_details[col] = {
                    "friendly_name": col.replace('_', ' ').title(),
                    "description": f"Attribute representing '{col}'.",
                    "data_type": "string",
                    "role": "dimension",
                    "classification": "public"
                }

        # Calculate real Data Quality insights from the queried dataset
        row_count = len(final_dataframe)
        null_count = 0
        for r in final_dataframe:
            for val in r.values():
                if val is None or val == "":
                    null_count += 1

        row_strings = [json.dumps(row, sort_keys=True) for row in final_dataframe]
        duplicate_count = len(row_strings) - len(set(row_strings))

        # Find primary numeric column (prefer measures)
        numeric_col = None
        for col, details in column_details.items():
            if details["role"] == "measure" and details["data_type"] in ("integer", "double", "float"):
                numeric_col = col
                break
        if not numeric_col:
            for col, details in column_details.items():
                if details["data_type"] in ("integer", "double", "float"):
                    numeric_col = col
                    break

        minimum = None
        maximum = None
        average = None

        if numeric_col:
            numeric_values = []
            for r in final_dataframe:
                val = r.get(numeric_col)
                if val is not None:
                    try:
                        numeric_values.append(float(val))
                    except (ValueError, TypeError):
                        pass
            if numeric_values:
                minimum = min(numeric_values)
                maximum = max(numeric_values)
                average = round(sum(numeric_values) / len(numeric_values), 2)

        dq_insights = {
            "row_count": row_count,
            "null_values": null_count,
            "duplicate_rows": duplicate_count,
            "minimum": minimum,
            "maximum": maximum,
            "average": average
        }

        # Calculate DQ insights for each individual selected table
        table_dq_insights = {}
        for table in request.tables:
            table_records = data_by_table.get(table, [])
            
            # Retrieve fields from semanticMetaStore to find the numeric columns
            meta_doc = db['semanticMetaStore'].find_one({"collection_name": table})
            meta_fields = meta_doc.get("fields", []) if meta_doc else []
            
            # Calculate row count
            t_row_count = len(table_records)
            
            # Calculate null count
            t_null_count = 0
            for r in table_records:
                for val in r.values():
                    if val is None or val == "":
                        t_null_count += 1
                        
            # Calculate duplicates
            t_row_strings = [json.dumps(row, sort_keys=True) for row in table_records]
            t_duplicate_count = len(t_row_strings) - len(set(t_row_strings))
            
            # Find primary numeric column for this table
            t_numeric_col = None
            for field in meta_fields:
                if field.get("role") == "measure" and field.get("data_type") in ("integer", "double", "float"):
                    t_numeric_col = field.get("field_name")
                    break
            if not t_numeric_col:
                for field in meta_fields:
                    if field.get("data_type") in ("integer", "double", "float"):
                        t_numeric_col = field.get("field_name")
                        break
                        
            t_minimum = None
            t_maximum = None
            t_average = None
            
            if t_numeric_col:
                t_numeric_values = []
                for r in table_records:
                    val = r.get(t_numeric_col)
                    if val is not None:
                        try:
                            t_numeric_values.append(float(val))
                        except (ValueError, TypeError):
                            pass
                if t_numeric_values:
                    t_minimum = min(t_numeric_values)
                    t_maximum = max(t_numeric_values)
                    t_average = round(sum(t_numeric_values) / len(t_numeric_values), 2)
                    
            table_dq_insights[table] = {
                "row_count": t_row_count,
                "null_values": t_null_count,
                "duplicate_rows": t_duplicate_count,
                "minimum": t_minimum,
                "maximum": t_maximum,
                "average": t_average
            }

        return SimulationResponse(
            dataframe=final_dataframe,
            column_details=column_details,
            dq_insights=dq_insights,
            table_dq_insights=table_dq_insights
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate", response_model=CodeGenerationResponse)
async def generate_code(request: CodeGenerationRequest):
    try:
        result = await generator.generate(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
def convert_to_csv(data):
    if not data:
        return ""
    output = io.StringIO()
    headers = data[0].keys()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    for row in data:
        writer.writerow(row)
    return output.getvalue()

@app.post("/github/push")
async def push_to_github(request: GitHubPushRequest):
    try:
        github_token = os.getenv("GITHUB_TOKEN")
        if not github_token:
            raise HTTPException(
                status_code=400, 
                detail="GITHUB_TOKEN is not configured in backend/.env file."
            )
            
        repo = request.repo_name or os.getenv("GITHUB_REPO")
        if not repo:
            raise HTTPException(
                status_code=400, 
                detail="GITHUB_REPO is not configured in backend/.env file."
            )
            
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        data_file_name = request.file_name or f"simulated_data_{timestamp}.csv"
        
        # 1. Convert and push dataframe CSV
        csv_content = convert_to_csv(request.dataframe)
        base64_data_content = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")
        
        headers = {
            "Authorization": f"Bearer {github_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        data_path = f"data/{data_file_name}"
        data_url = f"https://api.github.com/repos/{repo}/contents/{data_path}"
        
        async with httpx.AsyncClient() as client:
            # Check if CSV file already exists
            get_resp = await client.get(data_url, headers=headers)
            sha = get_resp.json().get("sha") if get_resp.status_code == 200 else None
            
            body = {
                "message": f"Upload simulated database dataframe: {data_file_name}",
                "content": base64_data_content,
            }
            if sha:
                body["sha"] = sha
                
            put_resp = await client.put(data_url, headers=headers, json=body)
            if put_resp.status_code not in (200, 201):
                error_detail = put_resp.json().get("message", "Unknown GitHub API error")
                raise HTTPException(status_code=put_resp.status_code, detail=f"GitHub API CSV Error: {error_detail}")
                
            data_html_url = put_resp.json().get("content", {}).get("html_url", "")
            
            code_html_url = ""
            code_path = ""
            
            # 2. Push generated code query if present
            if request.generated_code:
                ext = ".sql"
                fmt = (request.format or "").lower()
                if "pyspark" in fmt or "python" in fmt:
                    ext = ".py"
                elif "mongodb" in fmt or "noscript" in fmt or "js" in fmt or "firestore" in fmt:
                    ext = ".js"
                
                code_file_name = f"query_{timestamp}{ext}"
                code_path = f"queries/{code_file_name}"
                code_url = f"https://api.github.com/repos/{repo}/contents/{code_path}"
                
                base64_code_content = base64.b64encode(request.generated_code.encode("utf-8")).decode("utf-8")
                
                get_code_resp = await client.get(code_url, headers=headers)
                code_sha = get_code_resp.json().get("sha") if get_code_resp.status_code == 200 else None
                
                code_body = {
                    "message": f"Upload generated query code: {code_file_name}",
                    "content": base64_code_content,
                }
                if code_sha:
                    code_body["sha"] = code_sha
                    
                put_code_resp = await client.put(code_url, headers=headers, json=code_body)
                if put_code_resp.status_code not in (200, 201):
                    error_detail = put_code_resp.json().get("message", "Unknown GitHub API error")
                    raise HTTPException(status_code=put_code_resp.status_code, detail=f"GitHub API Code Error: {error_detail}")
                    
                code_html_url = put_code_resp.json().get("content", {}).get("html_url", "")
                
            return {
                "status": "success",
                "data_file_path": data_path,
                "data_html_url": data_html_url,
                "code_file_path": code_path,
                "code_html_url": code_html_url
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
