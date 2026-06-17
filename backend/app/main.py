import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers.auth import router as auth_router
from .routers.admin import router as admin_router
from .routers.generate import router as generate_router
from .routers.simulate import router as simulate_router
from .routers.github import router as github_router
from .routers.testing import router as testing_router
from .routers.cache import router as cache_router

app = FastAPI(title="SDLC Assist API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(generate_router)
app.include_router(simulate_router)
app.include_router(github_router)
app.include_router(testing_router)
app.include_router(cache_router)

@app.get("/")
async def root():
    return {"message": "SDLC Assist API is running in modular structure"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
