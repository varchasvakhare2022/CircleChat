"""
Configuration file for CircleChat backend
"""
import os

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./circlechat.db")

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# CORS configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

# WebSocket configuration
WS_MAX_CONNECTIONS = int(os.getenv("WS_MAX_CONNECTIONS", 100))
WS_HEARTBEAT_INTERVAL = int(os.getenv("WS_HEARTBEAT_INTERVAL", 30))

