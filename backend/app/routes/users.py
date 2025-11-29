"""
User profile routes
"""
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime

from ..db import get_db
from ..models import UserProfile, UserProfileUpdate, UserProfileResponse
from ..auth import get_current_user_id, get_user_info_from_clerk, extract_username_from_clerk_data

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserProfileResponse)
async def get_profile(
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    """Get current user's profile"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    try:
        profile = await db.user_profiles.find_one({"user_id": user_id})
        
        if profile:
            return {
                "user_id": profile["user_id"],
                "display_name": profile.get("display_name")
            }
        
        # If no profile exists, try to get name from Clerk
        display_name = None
        if user_id != "dev_user":
            user_info = await get_user_info_from_clerk(user_id)
            if user_info:
                display_name = extract_username_from_clerk_data(user_info)
        
        return {
            "user_id": user_id,
            "display_name": display_name
        }
    except Exception as e:
        print(f"Error getting profile: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get profile: {str(e)}")

@router.put("/me", response_model=UserProfileResponse, status_code=200)
async def update_profile(
    profile_data: UserProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    """Update current user's display name"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    if not profile_data.display_name or not profile_data.display_name.strip():
        raise HTTPException(status_code=400, detail="Display name cannot be empty")
    
    display_name = profile_data.display_name.strip()
    
    if len(display_name) > 50:
        raise HTTPException(status_code=400, detail="Display name must be 50 characters or less")
    
    try:
        # Check if profile exists
        existing = await db.user_profiles.find_one({"user_id": user_id})
        
        if existing:
            # Update existing profile
            await db.user_profiles.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "display_name": display_name,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        else:
            # Create new profile
            profile = UserProfile(
                user_id=user_id,
                display_name=display_name
            )
            profile_dict = profile.model_dump(by_alias=True, exclude={"id"})
            await db.user_profiles.insert_one(profile_dict)
        
        return {
            "user_id": user_id,
            "display_name": display_name
        }
    except Exception as e:
        print(f"Error updating profile: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")

@router.get("/profile/by-id/{user_id}")
async def get_user_profile(
    user_id: str,
    db = Depends(get_db)
):
    """Get a user's display name by user_id"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    try:
        profile = await db.user_profiles.find_one({"user_id": user_id})
        
        if profile and profile.get("display_name"):
            return {"display_name": profile.get("display_name")}
        
        # If no custom display name, try to get from Clerk
        if user_id != "dev_user":
            user_info = await get_user_info_from_clerk(user_id)
            if user_info:
                display_name = extract_username_from_clerk_data(user_info)
                if display_name:
                    return {"display_name": display_name}
        
        return {"display_name": None}
    except Exception as e:
        print(f"Error getting user profile: {str(e)}")
        return {"display_name": None}

