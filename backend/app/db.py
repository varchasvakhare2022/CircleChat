"""
Database connection and setup
"""
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import Depends
import os
from pathlib import Path

# Load .env file if it exists
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass  # python-dotenv not installed, use environment variables

# MongoDB connection
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "CircleChat")

client = None
db = None

async def connect_db():
    """Connect to MongoDB"""
    global client, db
    try:
        print(f"Connecting to MongoDB: {MONGODB_URI[:50]}...")  # Don't print full URI for security
        client = AsyncIOMotorClient(MONGODB_URI)
        db = client[DB_NAME]
        # Test connection
        await client.admin.command('ping')
        print(f"MongoDB connection successful to database: {DB_NAME}")
        return db
    except Exception as e:
        print(f"MongoDB connection error: {str(e)}")
        raise

async def close_db():
    """Close MongoDB connection"""
    global client
    if client:
        client.close()

async def get_db():
    """Get database instance (dependency)"""
    global db
    if db is None:
        db = await connect_db()
    return db

