import os
import resend
from datetime import datetime
from ..config.settings import RESEND_API_KEY, get_db

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

def send_push_approval_email(userId: str, role: str, podName: str, projectName: str, timestamp: str):
    if not RESEND_API_KEY:
        print("[WARNING] RESEND_API_KEY is not set in environment variables. Email will not be sent.")
        return
        
    admin_email = "muthuk60@gmail.com"
    try:
        db = get_db()
        admin_user = db["sdlcUsersNew"].find_one({"userId": "admin"})
        if admin_user and "email" in admin_user and admin_user["email"]:
            admin_email = admin_user["email"]
    except Exception as mongo_err:
        print(f"[WARNING] Failed to fetch admin email from MongoDB: {mongo_err}. Falling back to default email.")
        
    try:
        r = resend.Emails.send({
            "from": "onboarding@resend.dev",
            "to": admin_email,
            "subject": f"GitHub Push Request Pending Approval - {userId}",
            "html": f"""<strong>Hi Admin,</strong><br/><br/>
A new GitHub push request is pending approval.<br/><br/>
<strong>Request Details:</strong><br/>
<ul>
  <li><strong>User ID:</strong> {userId}</li>
  <li><strong>Role:</strong> {role}</li>
  <li><strong>Pod Name:</strong> {podName}</li>
  <li><strong>Project Name:</strong> {projectName}</li>
  <li><strong>Created Timestamp:</strong> {timestamp}</li>
</ul>
<br/>
Please login to the Admin panel to approve or reject this request.
"""
        })
        print(f"Resend email dispatch for GitHub push succeeded: {r}")
    except Exception as e:
        print(f"[ERROR] Failed to send GitHub push email via Resend: {e}")

def send_approval_email(tableName: str, tableSchema: str, createdUserId: str, tableRole: str, createdTimestamp: str):
    if not RESEND_API_KEY:
        print("[WARNING] RESEND_API_KEY is not set in environment variables. Email will not be sent.")
        return
        
    admin_email = "muthuk60@gmail.com"
    try:
        db = get_db()
        admin_user = db["sdlcUsers"].find_one({"userId": "admin"})
        if admin_user and "email" in admin_user and admin_user["email"]:
            admin_email = admin_user["email"]
    except Exception as mongo_err:
        print(f"[WARNING] Failed to fetch admin email from MongoDB: {mongo_err}. Falling back to default email.")
        
    try:
        r = resend.Emails.send({
            "from": "onboarding@resend.dev",
            "to": admin_email,
            "subject": f"Approval Request - {tableName}",
            "html": f"""<strong>Hi Admin,</strong><br/><br/>
A new table creation request is pending approval.<br/><br/>
<strong>Table Details:</strong><br/>
<ul>
  <li><strong>Table Name:</strong> {tableName}</li>
  <li><strong>Table Schema:</strong> {tableSchema}</li>
  <li><strong>Created By:</strong> {createdUserId}</li>
  <li><strong>User Role:</strong> {tableRole}</li>
  <li><strong>Created Timestamp:</strong> {createdTimestamp}</li>
</ul>
<br/>
Please login to the Admin panel to approve or reject this request.
"""
        })
        print(f"Resend email dispatch succeeded: {r}")
    except Exception as e:
        print(f"[ERROR] Failed to send email via Resend: {e}")

def send_user_registration_email(userId: str, role: str, domains: list):
    if not RESEND_API_KEY:
        print("[WARNING] RESEND_API_KEY is not set in environment variables. Email will not be sent.")
        return
        
    admin_email = "muthuk60@gmail.com"
    try:
        r = resend.Emails.send({
            "from": "onboarding@resend.dev",
            "to": admin_email,
            "subject": f"User Registration Pending Approval - {userId}",
            "html": f"""<strong>Hi Admin,</strong><br/><br/>
A new user registration is pending approval.<br/><br/>
<strong>User Details:</strong><br/>
<ul>
  <li><strong>User ID:</strong> {userId}</li>
  <li><strong>Role:</strong> {role}</li>
  <li><strong>Domains:</strong> {", ".join(domains)}</li>
</ul>
<br/>
Please login to the Admin panel to approve or reject this request.
"""
        })
        print(f"Resend email dispatch for user registration succeeded: {r}")
    except Exception as e:
        print(f"[ERROR] Failed to send user registration email via Resend: {e}")
