"""
Main application entry point for CircleChat backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.db import connect_db, close_db
from app.routes import groups, invites

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_db()
    yield
    # Shutdown
    await close_db()

app = FastAPI(
    title="CircleChat API",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS - Allow all origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(groups.router)
app.include_router(invites.router)

@app.get("/")
async def root():
    return {"message": "CircleChat API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    """Handle CORS preflight requests"""
    return {"message": "OK"}

if __name__ == "__main__":
    import uvicorn
    # Run on 0.0.0.0 to allow access from network devices
    # This makes the server accessible on both localhost and network IP
    uvicorn.run(
        app, 
        host="0.0.0.0",  # Listen on all network interfaces
        port=8000,
        reload=True  # Enable auto-reload in development
    )
