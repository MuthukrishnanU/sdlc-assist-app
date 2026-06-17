import os
import json
import base64
import httpx
from bson import ObjectId
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from ..schemas.simulation import GitHubPushRequest
from ..config.settings import get_db, GITHUB_TOKEN, GITHUB_REPO
from ..services.github_push import convert_to_csv
from ..services.email import send_push_approval_email

router = APIRouter(tags=["GitHub Integration"])

@router.post("/github/push")
async def push_to_github(request: GitHubPushRequest, background_tasks: BackgroundTasks):
    try:
        db = get_db()
        repo = request.repo_name or GITHUB_REPO
        if not repo:
            raise HTTPException(
                status_code=400, 
                detail="GITHUB_REPO is not configured in backend/.env file."
            )
            
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        data_file_name = (request.data_file_name or "").strip() or f"simulated_data_{timestamp_str}.csv"
        if not data_file_name.endswith('.csv'):
            data_file_name += '.csv'
            
        ext = ".sql"
        fmt = (request.format or "").lower()
        if "pyspark" in fmt or "python" in fmt:
            ext = ".py"
        elif "mongodb" in fmt or "noscript" in fmt or "js" in fmt or "firestore" in fmt:
            ext = ".js"
            
        code_file_name = (request.query_file_name or "").strip() or f"query_{timestamp_str}{ext}"
        if not code_file_name.endswith(ext):
            code_file_name += ext

        pod = request.pod_name or "data-pod-1"
        project = request.project_name or "sdlc-data-engineering"
        
        data_path = f"{pod}/{project}/data/{data_file_name}"
        code_path = f"{pod}/{project}/queries/{code_file_name}"
        
        tables = []
        if request.input_fields and isinstance(request.input_fields, dict):
            tables = request.input_fields.get("tables") or []
            if not isinstance(tables, list):
                tables = [str(tables)]
        
        table_concat = "_".join(tables)
        unique_table_name = f"{table_concat}_{timestamp_str}" if table_concat else f"simulated_{timestamp_str}"
        
        push_log = {
            "userId": request.userId or "unknown",
            "role": request.role or "unknown",
            "timestamp": request.timestamp or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "inputFields": request.input_fields or {},
            "DQ Insights": request.column_dq_insights or {},
            "codeOutput": request.generated_code or "",
            "outputTableData": request.dataframe or {},
            "uniqueTableName": unique_table_name,
            "podName": pod,
            "projectName": project,
            "dataFileName": data_path,
            "queryFileName": code_path,
            "repoName": repo,
            "format": request.format or "",
            "test_cases": request.test_cases or [],
        }
        
        db["pushAllDetailsTemp"].insert_one(push_log)
        
        background_tasks.add_task(
            send_push_approval_email,
            push_log["userId"],
            push_log["role"],
            push_log["podName"],
            push_log["projectName"],
            push_log["timestamp"]
        )
        
        return {
            "status": "pending_approval",
            "message": "GitHub push request created and sent to admin for approval."
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pending-github-pushes")
async def get_pending_github_pushes():
    try:
        db = get_db()
        cursor = db["pushAllDetailsTemp"].find()
        pending = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            pending.append(doc)
        return pending
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/approve-github-push/{pushId}")
async def approve_github_push(pushId: str):
    try:
        db = get_db()
        push_request = db["pushAllDetailsTemp"].find_one({"_id": ObjectId(pushId)})
        if not push_request:
            raise HTTPException(status_code=404, detail="Pending GitHub push request not found")
            
        token = GITHUB_TOKEN
        if not token:
            raise HTTPException(
                status_code=400, 
                detail="GITHUB_TOKEN is not configured in backend/.env file."
            )
            
        repo = push_request.get("repoName") or GITHUB_REPO
        if not repo:
            raise HTTPException(
                status_code=400, 
                detail="GitHub repository name is not found in the request."
            )
            
        data_path = push_request.get("dataFileName")
        code_path = push_request.get("queryFileName")
        
        dataframe = push_request.get("outputTableData") or []
        generated_code = push_request.get("codeOutput") or ""
        
        data_file_name = data_path.split('/')[-1] if data_path else "simulated_data.csv"
        code_file_name = code_path.split('/')[-1] if code_path else "query.sql"
        
        csv_content = convert_to_csv(dataframe)
        base64_data_content = base64.b64encode(csv_content.encode("utf-8")).decode("utf-8")
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        data_url = f"https://api.github.com/repos/{repo}/contents/{data_path}"
        
        async with httpx.AsyncClient() as client_http:
            get_resp = await client_http.get(data_url, headers=headers)
            sha = get_resp.json().get("sha") if get_resp.status_code == 200 else None
            
            body = {
                "message": f"Upload simulated database dataframe: {data_file_name}",
                "content": base64_data_content,
            }
            if sha:
                body["sha"] = sha
                
            put_resp = await client_http.put(data_url, headers=headers, json=body)
            if put_resp.status_code not in (200, 201):
                error_detail = put_resp.json().get("message", "Unknown GitHub API error")
                raise HTTPException(status_code=put_resp.status_code, detail=f"GitHub API CSV Error: {error_detail}")
                
            data_html_url = put_resp.json().get("content", {}).get("html_url", "")
            code_html_url = ""
            
            if generated_code:
                code_url = f"https://api.github.com/repos/{repo}/contents/{code_path}"
                base64_code_content = base64.b64encode(generated_code.encode("utf-8")).decode("utf-8")
                
                get_code_resp = await client_http.get(code_url, headers=headers)
                code_sha = get_code_resp.json().get("sha") if get_code_resp.status_code == 200 else None
                
                code_body = {
                    "message": f"Upload generated query code: {code_file_name}",
                    "content": base64_code_content,
                }
                if code_sha:
                    code_body["sha"] = code_sha
                    
                put_code_resp = await client_http.put(code_url, headers=headers, json=code_body)
                if put_code_resp.status_code not in (200, 201):
                    error_detail = put_code_resp.json().get("message", "Unknown GitHub API error")
                    raise HTTPException(status_code=put_code_resp.status_code, detail=f"GitHub API Code Error: {error_detail}")
                    
                code_html_url = put_code_resp.json().get("content", {}).get("html_url", "")
                
            test_cases = push_request.get("test_cases") or []
            test_html_url = ""
            test_file_path = ""
            if test_cases:
                parts = code_path.split('/')
                if len(parts) >= 3:
                    filename = parts[-1]
                    filename_no_ext = filename.rsplit('.', 1)[0]
                    test_file_path = f"{parts[0]}/{parts[1]}/tests/{filename_no_ext}_tests.json"
                else:
                    test_file_path = f"tests/{code_file_name.rsplit('.', 1)[0]}_tests.json"
                
                test_json_content = json.dumps(test_cases, indent=2)
                base64_test_content = base64.b64encode(test_json_content.encode("utf-8")).decode("utf-8")
                test_url = f"https://api.github.com/repos/{repo}/contents/{test_file_path}"
                
                get_test_resp = await client_http.get(test_url, headers=headers)
                test_sha = get_test_resp.json().get("sha") if get_test_resp.status_code == 200 else None
                
                test_body = {
                    "message": f"Upload test cases for query: {code_file_name}",
                    "content": base64_test_content,
                }
                if test_sha:
                    test_body["sha"] = test_sha
                    
                put_test_resp = await client_http.put(test_url, headers=headers, json=test_body)
                if put_test_resp.status_code in (200, 201):
                    test_html_url = put_test_resp.json().get("content", {}).get("html_url", "")
        
        push_log = {
            "userId": push_request.get("userId"),
            "role": push_request.get("role"),
            "timestamp": push_request.get("timestamp"),
            "inputFields": push_request.get("inputFields"),
            "DQ Insights": push_request.get("DQ Insights"),
            "codeOutput": generated_code,
            "outputTableData": dataframe,
            "uniqueTableName": push_request.get("uniqueTableName"),
            "podName": push_request.get("podName"),
            "projectName": push_request.get("projectName"),
            "dataFileName": data_path,
            "queryFileName": code_path,
            "test_cases": test_cases,
        }
        
        db["pushAllDetails"].insert_one(push_log)
        db["pushAllDetailsTemp"].delete_one({"_id": ObjectId(pushId)})
        
        return {
            "status": "success",
            "message": f"GitHub push approved and files successfully pushed to GitHub.",
            "data_file_path": data_path,
            "data_html_url": data_html_url,
            "code_file_path": code_path,
            "code_html_url": code_html_url,
            "test_file_path": test_file_path,
            "test_html_url": test_html_url
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reject-github-push/{pushId}")
async def reject_github_push(pushId: str):
    try:
        db = get_db()
        res = db["pushAllDetailsTemp"].delete_one({"_id": ObjectId(pushId)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Pending GitHub push request not found")
            
        return {"status": "success", "message": "GitHub push request rejected."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
