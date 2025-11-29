"""
Database models
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from bson import ObjectId

class Group(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    description: Optional[str] = None
    owner_id: str  # Clerk user ID
    member_ids: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None

class MemberInfo(BaseModel):
    user_id: str
    display_name: Optional[str] = None
    email: Optional[str] = None

class GroupResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    owner_id: str
    member_count: int
    member_ids: Optional[List[str]] = None  # Include member IDs for owner management
    members: Optional[List[MemberInfo]] = None  # Include member details with display names and emails
    created_at: datetime
    updated_at: datetime

class Message(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    group_id: str
    user_id: str  # Clerk user ID
    username: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

class MessageCreate(BaseModel):
    content: str

class MessageResponse(BaseModel):
    id: str
    group_id: str
    user_id: str
    username: str
    content: str
    created_at: datetime

class Invite(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    group_id: str
    code: str
    created_by: str  # Clerk user ID
    expires_at: Optional[datetime] = None
    used: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

class UserProfile(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str  # Clerk user ID
    display_name: Optional[str] = None  # Custom display name
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

class UserProfileUpdate(BaseModel):
    display_name: str

class UserProfileResponse(BaseModel):
    user_id: str
    display_name: Optional[str] = None
