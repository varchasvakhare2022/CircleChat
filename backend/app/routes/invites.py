"""
Invites routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timedelta
from bson import ObjectId
import secrets
import string

from ..db import get_db
from ..models import Invite
from ..auth import get_current_user_id

router = APIRouter(prefix="/invites", tags=["invites"])

def generate_invite_code():
    """Generate a random invite code"""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))

class InviteCreate(BaseModel):
    group_id: str

@router.post("", status_code=201)
async def create_invite(
    invite_data: InviteCreate,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    """Create an invite for a group"""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not connected")
        
        group_id = invite_data.group_id
        
        # Verify user is a member of the group
        if not ObjectId.is_valid(group_id):
            raise HTTPException(status_code=400, detail="Invalid group ID")
        
        group = await db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Only the owner can create invites
        if group.get("owner_id") != user_id:
            raise HTTPException(status_code=403, detail="Only the group owner can create invite links")
        
        # Generate invite code (uppercase for consistency)
        code = generate_invite_code().upper()
        
        # Check if code already exists
        existing = await db.invites.find_one({"code": code})
        while existing:
            code = generate_invite_code().upper()
            existing = await db.invites.find_one({"code": code})
        
        # Create permanent invite (no expiration)
        invite = Invite(
            group_id=group_id,
            code=code,
            created_by=user_id,
            expires_at=None  # Permanent invite - no expiration
        )
        
        invite_dict = invite.model_dump(by_alias=True, exclude={"id"})
        result = await db.invites.insert_one(invite_dict)
        created_invite = await db.invites.find_one({"_id": result.inserted_id})
        
        return {
            "id": str(created_invite["_id"]),
            "code": created_invite["code"],
            "group_id": created_invite["group_id"],
            "expires_at": created_invite.get("expires_at"),
            "created_at": created_invite["created_at"]
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating invite: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create invite: {str(e)}")

@router.get("/{invite_code}")
async def get_invite(
    invite_code: str,
    db = Depends(get_db)
):
    """Get invite details"""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not connected")
        
        invite = await db.invites.find_one({"code": invite_code})
        if not invite:
            raise HTTPException(status_code=404, detail="Invite not found")
        
        # Check if expired (optional - can be removed if you want permanent invites)
        expires_at = invite.get("expires_at")
        if expires_at:
            # MongoDB returns datetime objects, but handle string case too
            if isinstance(expires_at, str):
                try:
                    expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                except:
                    expires_at = datetime.utcnow() - timedelta(days=1)  # Treat as expired if can't parse
            if expires_at < datetime.utcnow():
                raise HTTPException(status_code=410, detail="Invite has expired")
        
        # Invites are now permanent and reusable - no "used" check
        
        # Get group info
        group = await db.groups.find_one({"_id": ObjectId(invite["group_id"])})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        return {
            "code": invite["code"],
            "group_id": invite["group_id"],
            "group_name": group["name"],
            "expires_at": invite.get("expires_at")
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting invite: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get invite: {str(e)}")

@router.post("/{invite_code}/accept")
async def accept_invite(
    invite_code: str,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    """Accept an invite and join the group"""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not connected")
        
        # Clean and normalize invite code
        invite_code = invite_code.strip().upper()
        print(f"Accepting invite code: {invite_code} for user: {user_id}")
        
        invite = await db.invites.find_one({"code": invite_code})
        if not invite:
            print(f"Invite not found for code: {invite_code}")
            raise HTTPException(status_code=404, detail="Invite not found")
        
        print(f"Found invite: {invite}")
        
        # Check if expired (optional - can be removed if you want permanent invites)
        expires_at = invite.get("expires_at")
        if expires_at:
            # MongoDB returns datetime objects, but handle string case too
            if isinstance(expires_at, str):
                try:
                    expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                except:
                    expires_at = datetime.utcnow() - timedelta(days=1)  # Treat as expired if can't parse
            if expires_at < datetime.utcnow():
                raise HTTPException(status_code=410, detail="Invite has expired")
        
        # Invites are now permanent and reusable - no "used" check
        
        group_id = invite["group_id"]
        
        # Verify group exists
        if not ObjectId.is_valid(group_id):
            raise HTTPException(status_code=400, detail="Invalid group ID")
        
        group = await db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Check if user is already a member
        if user_id in group.get("member_ids", []):
            # User is already a member - invite is still valid for others
            return {"message": "Already a member", "group_id": group_id}
        
        # Add user to group
        result = await db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$addToSet": {"member_ids": user_id},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        print(f"Group update result: {result.modified_count} documents modified")
        
        # Invites are permanent and reusable - don't mark as used
        
        print(f"User {user_id} successfully joined group {group_id}")
        return {"message": "Joined group successfully", "group_id": group_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error accepting invite: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to accept invite: {str(e)}")

