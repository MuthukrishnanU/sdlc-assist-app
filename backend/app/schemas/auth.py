from pydantic import BaseModel
from typing import List

class LoginRequest(BaseModel):
    userId: str
    password: str

class LoginResponse(BaseModel):
    status: str
    userId: str
    role: str
    canView: str
    domain: List[str]

class RegisterRequest(BaseModel):
    userId: str
    password: str
    role: str

class RegisterResponse(BaseModel):
    status: str
    message: str
    userId: str
