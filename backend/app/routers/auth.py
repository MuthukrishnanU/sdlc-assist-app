from fastapi import APIRouter, HTTPException, BackgroundTasks
from ..schemas.auth import LoginRequest, LoginResponse, RegisterRequest, RegisterResponse
from ..config.settings import get_db
from ..services.email import send_user_registration_email

router = APIRouter(tags=["Authentication"])

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    try:
        db = get_db()
        user = db["sdlcUsersNew"].find_one({"userId": request.userId})
        if not user or user.get("password") != request.password:
            raise HTTPException(status_code=401, detail="Invalid userId or password")
            
        domains_list = user.get("domain", [])
        if isinstance(domains_list, str):
            domains_list = [domains_list]
            
        return LoginResponse(
            status="success",
            userId=user["userId"],
            role=user["role"],
            canView=user.get("canView", "both"),
            domain=domains_list
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/register", response_model=RegisterResponse)
async def register(request: RegisterRequest, background_tasks: BackgroundTasks):
    try:
        db = get_db()
        
        # Check if user already exists in active or pending collections
        existing_user = db["sdlcUsersNew"].find_one({"userId": request.userId})
        existing_temp = db["sdlcUsersTemp"].find_one({"userId": request.userId})
        if existing_user or existing_temp:
            raise HTTPException(status_code=400, detail="User ID already exists or is pending approval. Please choose a different one.")
            
        # Role mappings
        role_mapping = {
            "Business Analyst": {
                "domain": ["Retail Banking", "Healthcare", "Digital Channels"],
                "canView": "sdlc"
            },
            "Data Engineer": {
                "domain": ["Data Engineering", "Lending", "Collections"],
                "canView": "sdlc"
            },
            "Data Scientist": {
                "domain": ["Cards", "Media", "Data Engineering"],
                "canView": "both"
            },
            "Lead": {
                "domain": ["Retail Banking", "Lending", "Collections"],
                "canView": "both"
            },
            "Project Lead": {
                "domain": ["Data Engineering", "Healthcare", "Media", "Retail Banking", "Lending", "Cards", "Digital Channels", "Collections"],
                "canView": "cbi"
            },
            "Vertical Lead": {
                "domain": ["Data Engineering", "Healthcare", "Media", "Retail Banking", "Lending", "Cards", "Digital Channels", "Collections"],
                "canView": "cbi"
            }
        }
        
        role_info = role_mapping.get(request.role)
        if not role_info:
            raise HTTPException(status_code=400, detail=f"Invalid role selected: {request.role}")
            
        user_doc = {
            "userId": request.userId,
            "password": request.password,
            "domain": role_info["domain"],
            "role": request.role,
            "canView": role_info["canView"]
        }
        
        db["sdlcUsersTemp"].insert_one(user_doc)
        
        background_tasks.add_task(send_user_registration_email, request.userId, request.role, role_info["domain"])
        
        return RegisterResponse(
            status="success",
            message="Registration successful - but pending admin approval",
            userId=request.userId
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
