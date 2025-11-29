"""
Groups routes
"""
from fastapi import APIRouter, HTTPException, Depends, Security
from fastapi.security import HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import secrets
import string

from ..db import get_db
from ..models import Group, GroupCreate, GroupResponse, Message, MessageCreate, MessageResponse, MemberInfo
from ..auth import get_current_user_id, get_current_user_info, security

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
    
    # Fetch member details with display names and emails for all members
    members = []
    for member_id in group.get("member_ids", []):
        member_info = {"user_id": member_id, "display_name": None, "email": None}
        
        # Get display name from user profile
        profile = await db.user_profiles.find_one({"user_id": member_id})
        if profile and profile.get("display_name"):
            member_info["display_name"] = profile.get("display_name")
        
        # Get email and name from Clerk
        try:
            from ..auth import get_user_info_from_clerk, extract_username_from_clerk_data
            if member_id != "dev_user":
                clerk_info = await get_user_info_from_clerk(member_id)
                if clerk_info:
                    # Get email
                    if "email_addresses" in clerk_info and len(clerk_info["email_addresses"]) > 0:
                        member_info["email"] = clerk_info["email_addresses"][0].get("email_address")
                    
                    # Get display name if not set from profile
                    if not member_info["display_name"]:
                        member_info["display_name"] = extract_username_from_clerk_data(clerk_info)
        except Exception as e:
            print(f"Error fetching Clerk info for {member_id}: {str(e)}")
        
        # Fallback display name
        if not member_info["display_name"]:
            member_info["display_name"] = member_id if member_id == "dev_user" else "User"
        
        members.append(member_info)
    
    # Include member details for all users (so everyone can see member names)
    response.members = [MemberInfo(**m) for m in members]
    
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
    
    # Fetch display names for all messages
    result = []
    for msg in messages:
        message_user_id = msg.get("user_id")
        display_name = "User"  # Default fallback
        
        if message_user_id and message_user_id != "dev_user":
            # First, check user profile for custom display name
            profile = await db.user_profiles.find_one({"user_id": message_user_id})
            if profile and profile.get("display_name"):
                display_name = profile.get("display_name")
            else:
                # Try to get from Clerk
                try:
                    from ..auth import get_user_info_from_clerk, extract_username_from_clerk_data
                    user_info = await get_user_info_from_clerk(message_user_id)
                    if user_info:
                        clerk_name = extract_username_from_clerk_data(user_info)
                        if clerk_name:
                            display_name = clerk_name
                except Exception as e:
                    print(f"Error fetching Clerk info for {message_user_id}: {str(e)}")
                    # If all else fails, try to use stored username if it's not "User" or "dev"
                    stored_username = msg.get("username", "")
                    if stored_username and stored_username not in ["User", "dev", "dev_user"]:
                        display_name = stored_username
        else:
            # For dev_user, use stored username or default
            stored_username = msg.get("username", "")
            if stored_username and stored_username not in ["User", "dev", "dev_user"]:
                display_name = stored_username
        
        result.append(MessageResponse(
            id=str(msg["_id"]),
            group_id=msg["group_id"],
            user_id=message_user_id,
            username=display_name,  # Use fetched display name
            content=msg["content"],
            created_at=msg.get("created_at")
        ))
    
    return result

@router.post("/{group_id}/messages", response_model=MessageResponse, status_code=201)
async def send_message(
    group_id: str,
    message_data: MessageCreate,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db = Depends(get_db)
):
    """Send a message to a group"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    if not ObjectId.is_valid(group_id):
        raise HTTPException(status_code=400, detail="Invalid group ID")
    
    # Get user info with database access for display name lookup
    user_info = await get_current_user_info(credentials, db=db)
    user_id = user_info.get("user_id")
    
    # Fetch display name from user profile or Clerk
    username = "User"  # Default
    if user_id and user_id != "dev_user":
        # Check user profile for custom display name
        profile = await db.user_profiles.find_one({"user_id": user_id})
        if profile and profile.get("display_name"):
            username = profile.get("display_name")
        else:
            # Try to get from Clerk
            try:
                from ..auth import get_user_info_from_clerk, extract_username_from_clerk_data
                clerk_info = await get_user_info_from_clerk(user_id)
                if clerk_info:
                    clerk_name = extract_username_from_clerk_data(clerk_info)
                    if clerk_name:
                        username = clerk_name
            except:
                # Fallback to username from user_info
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

