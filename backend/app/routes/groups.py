"""
Groups routes
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
from bson import ObjectId
import secrets
import string

from ..db import get_db
from ..models import Group, GroupCreate, GroupResponse, Message, MessageCreate, MessageResponse
from ..auth import get_current_user_id, get_current_user_info

router = APIRouter(prefix="/groups", tags=["groups"])

def generate_invite_code():
    """Generate a random invite code"""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))

@router.post("", response_model=GroupResponse, status_code=201)
async def create_group(
    group_data: GroupCreate,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    """Create a new group"""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database not connected")
        
        group = Group(
            name=group_data.name,
            description=group_data.description,
            owner_id=user_id,
            member_ids=[user_id]  # Owner is automatically a member
        )
        
        group_dict = group.model_dump(by_alias=True, exclude={"id"})
        print(f"Creating group with data: {group_dict}")  # Debug log
        result = await db.groups.insert_one(group_dict)
        print(f"Insert result: {result.inserted_id}")  # Debug log
        created_group = await db.groups.find_one({"_id": result.inserted_id})
        
        if not created_group:
            raise HTTPException(status_code=500, detail="Failed to create group")
        
        return GroupResponse(
            id=str(created_group["_id"]),
            name=created_group["name"],
            description=created_group.get("description"),
            owner_id=created_group["owner_id"],
            member_count=len(created_group.get("member_ids", [])),
            created_at=created_group["created_at"],
            updated_at=created_group["updated_at"]
        )
    except Exception as e:
        print(f"Error creating group: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create group: {str(e)}")

@router.get("", response_model=List[GroupResponse])
async def get_groups(
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    """Get all groups for the current user"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    # Get groups where user is a member
    cursor = db.groups.find({"member_ids": user_id})
    groups = await cursor.to_list(length=100)
    
    result = []
    for group in groups:
        response = GroupResponse(
            id=str(group["_id"]),
            name=group["name"],
            description=group.get("description"),
            owner_id=group["owner_id"],
            member_count=len(group.get("member_ids", [])),
            created_at=group["created_at"],
            updated_at=group["updated_at"]
        )
        # Include member_ids if user is the owner
        if user_id == group.get("owner_id"):
            response.member_ids = group.get("member_ids", [])
        result.append(response)
    
    return result

@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: str,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    """Get a specific group"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")
    
    group = await db.groups.find_one({"_id": ObjectId(group_id)})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if user is a member
    if user_id not in group.get("member_ids", []):
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    response = GroupResponse(
        id=str(group["_id"]),
        name=group["name"],
        description=group.get("description"),
        owner_id=group["owner_id"],
        member_count=len(group.get("member_ids", [])),
        created_at=group["created_at"],
        updated_at=group["updated_at"]
    )
    
    # Include member_ids if user is the owner (for member management)
    if user_id == group.get("owner_id"):
        response.member_ids = group.get("member_ids", [])
    
    return response

@router.post("/{group_id}/join")
async def join_group(
    group_id: str,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    """Join a group"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")
    
    group = await db.groups.find_one({"_id": ObjectId(group_id)})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if user_id in group.get("member_ids", []):
        return {"message": "Already a member", "group_id": group_id}
    
    await db.groups.update_one(
        {"_id": ObjectId(group_id)},
        {
            "$addToSet": {"member_ids": user_id},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"message": "Joined group successfully", "group_id": group_id}

@router.delete("/{group_id}/leave")
async def leave_group(
    group_id: str,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    """Leave a group"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")
    
    group = await db.groups.find_one({"_id": ObjectId(group_id)})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if user_id == group.get("owner_id"):
        raise HTTPException(status_code=400, detail="Owner cannot leave the group. Transfer ownership or delete the group instead.")
    
    if user_id not in group.get("member_ids", []):
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    await db.groups.update_one(
        {"_id": ObjectId(group_id)},
        {
            "$pull": {"member_ids": user_id},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"message": "Left group successfully"}

@router.delete("/{group_id}/members/{member_id}")
async def remove_member(
    group_id: str,
    member_id: str,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    """Remove a member from a group (owner only)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")
    
    group = await db.groups.find_one({"_id": ObjectId(group_id)})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Only the owner can remove members
    if group.get("owner_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the group owner can remove members")
    
    # Cannot remove the owner
    if member_id == group.get("owner_id"):
        raise HTTPException(status_code=400, detail="Cannot remove the group owner")
    
    # Check if member is in the group
    if member_id not in group.get("member_ids", []):
        raise HTTPException(status_code=404, detail="User is not a member of this group")
    
    await db.groups.update_one(
        {"_id": ObjectId(group_id)},
        {
            "$pull": {"member_ids": member_id},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"message": "Member removed successfully"}

@router.get("/{group_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    group_id: str,
    limit: int = 50,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    """Get messages for a group"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")
    
    # Verify user is a member
    group = await db.groups.find_one({"_id": ObjectId(group_id)})
    if not group or user_id not in group.get("member_ids", []):
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    cursor = db.messages.find({"group_id": group_id}).sort("created_at", -1).skip(offset).limit(limit)
    messages = await cursor.to_list(length=limit)
    messages.reverse()  # Reverse to show oldest first
    
    return [
        MessageResponse(
            id=str(msg["_id"]),
            group_id=msg["group_id"],
            user_id=msg["user_id"],
            username=msg["username"],
            content=msg["content"],
            created_at=msg["created_at"]
        )
        for msg in messages
    ]

@router.post("/{group_id}/messages", response_model=MessageResponse, status_code=201)
async def send_message(
    group_id: str,
    message_data: MessageCreate,
    user_info: dict = Depends(get_current_user_info),
    db = Depends(get_db)
):
    """Send a message to a group"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")
    
    user_id = user_info.get("user_id")
    username = user_info.get("username", "User")
    
    # Verify user is a member
    group = await db.groups.find_one({"_id": ObjectId(group_id)})
    if not group or user_id not in group.get("member_ids", []):
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    message = Message(
        group_id=group_id,
        user_id=user_id,
        username=username,
        content=message_data.content
    )
    
    message_dict = message.model_dump(by_alias=True, exclude={"id"})
    result = await db.messages.insert_one(message_dict)
    created_message = await db.messages.find_one({"_id": result.inserted_id})
    
    return MessageResponse(
        id=str(created_message["_id"]),
        group_id=created_message["group_id"],
        user_id=created_message["user_id"],
        username=created_message["username"],
        content=created_message["content"],
        created_at=created_message["created_at"]
    )

