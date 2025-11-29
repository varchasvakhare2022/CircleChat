"""
Authentication middleware for Clerk
"""
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from typing import Optional, Dict
import httpx
import os
import base64
import json

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_PUBLISHABLE_KEY = os.getenv("VITE_CLERK_PUBLISHABLE_KEY", "")

security = HTTPBearer(auto_error=False)

def decode_jwt_payload(token: str) -> Optional[Dict]:
    """Decode JWT token payload without verification (for development)"""
    try:
        # JWT format: header.payload.signature
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        # Decode payload (second part)
        payload = parts[1]
        # Add padding if needed
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding
        
        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)
    except Exception as e:
        print(f"Error decoding JWT: {str(e)}")
        return None

async def get_user_info_from_clerk(user_id: str) -> Optional[Dict]:
    """Get user information from Clerk API"""
    if not CLERK_SECRET_KEY or not user_id or user_id == "dev_user":
        return None
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.clerk.com/v1/users/{user_id}",
                headers={
                    "Authorization": f"Bearer {CLERK_SECRET_KEY}",
                }
            )
            
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"Error fetching user from Clerk: {str(e)}")
    
    return None

def extract_username_from_clerk_data(user_info: Dict) -> Optional[str]:
    """Extract the best available username from Clerk user data"""
    if not user_info:
        return None
    
    # Try different fields in order of preference
    # Clerk API returns: first_name, last_name, username, email_addresses
    first_name = user_info.get("first_name")
    last_name = user_info.get("last_name")
    username = user_info.get("username")
    
    # Combine first and last name if available
    if first_name and last_name:
        return f"{first_name} {last_name}"
    elif first_name:
        return first_name
    elif username:
        return username
    elif user_info.get("email_addresses"):
        # Use email prefix as fallback
        email = user_info.get("email_addresses", [{}])[0].get("email_address", "")
        if email:
            return email.split("@")[0]
    
    return None

async def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)):
    """
    Verify Clerk JWT token (optional in development)
    """
    # In development mode, allow requests without token
    if not credentials:
        return {"user_id": "dev_user", "token": None, "username": "dev"}
    
    token = credentials.credentials
    
    # Try to decode JWT to get user info
    payload = decode_jwt_payload(token)
    user_id = None
    username = None
    
    if payload:
        user_id = payload.get("sub") or payload.get("user_id")
        # Try to get username from token claims
        username = (
            payload.get("username") or 
            payload.get("name") or
            payload.get("first_name") or
            payload.get("email") or
            None
        )
    
    if not CLERK_SECRET_KEY:
        # In development, skip verification but try to get info from token
        if user_id:
            return {"user_id": user_id, "token": token, "username": username or "User"}
        return {"user_id": "dev_user", "token": token, "username": "dev"}
    
    try:
        # Verify token with Clerk
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.clerk.com/v1/tokens/{token}/verify",
                headers={
                    "Authorization": f"Bearer {CLERK_SECRET_KEY}",
                }
            )
            
            if response.status_code != 200:
                # In development, allow even if verification fails
                if user_id:
                    return {"user_id": user_id, "token": token, "username": username or "User"}
                return {"user_id": "dev_user", "token": token, "username": "dev"}
            
            data = response.json()
            if user_id:
                data["user_id"] = user_id
            if username:
                data["username"] = username
            return data
    except Exception as e:
        # For development, allow requests without verification
        if user_id:
            return {"user_id": user_id, "token": token, "username": username or "User"}
        return {"user_id": "dev_user", "token": token, "username": "dev"}

async def get_current_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)):
    """
    Get current user ID from token (optional in development)
    """
    try:
        token_data = await verify_token(credentials)
        return token_data.get("user_id") or token_data.get("sub") or "dev_user"
    except Exception as e:
        # In development, always return a default user ID
        print(f"Auth error (allowing in dev): {str(e)}")
        return "dev_user"

async def get_current_user_info(credentials: Optional[HTTPAuthorizationCredentials] = Security(security), db = None) -> Dict:
    """
    Get current user information including username
    If db is provided, will check for custom display name in user profile
    """
    try:
        token_data = await verify_token(credentials)
        user_id = token_data.get("user_id") or token_data.get("sub") or "dev_user"
        username = token_data.get("username")
        
        # Check for custom display name in database first
        if db is not None and user_id != "dev_user":
            try:
                profile = await db.user_profiles.find_one({"user_id": user_id})
                if profile and profile.get("display_name"):
                    return {
                        "user_id": user_id,
                        "username": profile.get("display_name")
                    }
            except Exception as e:
                print(f"Error fetching user profile: {str(e)}")
        
        # If we don't have username, try to get it from Clerk API
        if not username or username == "dev" or username == "User":
            user_info = await get_user_info_from_clerk(user_id)
            if user_info:
                username = extract_username_from_clerk_data(user_info)
        
        return {
            "user_id": user_id,
            "username": username or "User"
        }
    except Exception as e:
        print(f"Error getting user info: {str(e)}")
        return {"user_id": "dev_user", "username": "dev"}

