"""
Main application entry point for CircleChat backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.db import connect_db, close_db, get_db
from app.routes import groups, invites, users
from app.ws_manager import manager
from app.auth import get_current_user_id, get_current_user_info
from app.models import Message, MessageResponse
from fastapi import WebSocket, WebSocketDisconnect, Query, Depends
from datetime import datetime
from bson import ObjectId

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
# Note: User routes are defined directly below to ensure they're registered

# Direct user profile routes to ensure they're registered
from app.db import get_db
from app.models import UserProfile, UserProfileUpdate, UserProfileResponse
from app.auth import get_current_user_id, get_user_info_from_clerk, extract_username_from_clerk_data
from fastapi import Depends, HTTPException
from datetime import datetime

@app.get("/users/me", response_model=UserProfileResponse, tags=["users"])
async def get_current_user_profile(
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

@app.put("/users/me", response_model=UserProfileResponse, status_code=200, tags=["users"])
async def update_current_user_profile(
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

@app.get("/")
async def root():
    return {"message": "CircleChat API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/test-users-route")
async def test_users_route():
    """Test endpoint to verify users router is loaded"""
    return {
        "message": "Users router is loaded",
        "routes": [
            "GET /users/me",
            "PUT /users/me",
            "GET /users/profile/by-id/{user_id}"
        ]
    }

@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    """Handle CORS preflight requests"""
    return {"message": "OK"}

@app.websocket("/ws/{group_id}")
async def websocket_endpoint(websocket: WebSocket, group_id: str, token: str = Query(None)):
    """WebSocket endpoint for real-time communication"""
    # Accept the WebSocket connection first
    # Allow all origins in development
    try:
        # Check origin header if present
        origin = websocket.headers.get("origin")
        if origin:
            # In development, accept all origins
            await websocket.accept()
        else:
            # No origin header, accept anyway (for development)
            await websocket.accept()
    except Exception as e:
        print(f"Error accepting WebSocket connection: {str(e)}")
        try:
            await websocket.close(code=1008, reason="Connection rejected")
        except:
            pass
        return
    
    # In a real app, you'd verify the token here
    # For now, we'll use a simple approach
    user_id = "dev_user"  # Default for development
    
    if token:
        # Try to get user_id from token
        try:
            from app.auth import decode_jwt_payload
            payload = decode_jwt_payload(token)
            if payload:
                user_id = payload.get("sub") or payload.get("user_id") or "dev_user"
        except Exception as e:
            print(f"Error decoding token: {str(e)}")
            pass
    
    # Add connection to manager
    try:
        if group_id not in manager.active_connections:
            manager.active_connections[group_id] = set()
        
        manager.active_connections[group_id].add(websocket)
        manager.connection_users[websocket] = user_id
        
        # Notify others in the group that user joined
        await manager.broadcast_to_group(
            group_id,
            {
                "type": "user_joined",
                "user_id": user_id,
                "group_id": group_id
            },
            exclude_websocket=websocket
        )
    except Exception as e:
        print(f"Error adding connection to manager: {str(e)}")
        await websocket.close()
        return
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Handle different message types
            message_type = data.get("type")
            
            if message_type == "message":
                # Save message to database first, then broadcast
                try:
                    from app.db import db as database_instance
                    if database_instance is not None and ObjectId.is_valid(group_id):
                        # Verify user is a member of the group
                        group = await database_instance.groups.find_one({"_id": ObjectId(group_id)})
                        if group and user_id in group.get("member_ids", []):
                            # Get user info for display name
                            username = "User"  # Default
                            try:
                                # Check user profile for custom display name
                                profile = await database_instance.user_profiles.find_one({"user_id": user_id})
                                if profile and profile.get("display_name"):
                                    username = profile.get("display_name")
                                else:
                                    # Try to get from Clerk
                                    from app.auth import get_user_info_from_clerk, extract_username_from_clerk_data
                                    if user_id != "dev_user":
                                        user_info = await get_user_info_from_clerk(user_id)
                                        if user_info:
                                            clerk_name = extract_username_from_clerk_data(user_info)
                                            if clerk_name:
                                                username = clerk_name
                            except Exception as e:
                                print(f"Error getting display name for WebSocket message: {str(e)}")
                                username = "User"
                            
                            # Create and save message
                            message = Message(
                                group_id=group_id,
                                user_id=user_id,
                                username=username,
                                content=data.get("content")
                            )
                            message_dict = message.model_dump(by_alias=True, exclude={"id"})
                            result = await database_instance.messages.insert_one(message_dict)
                            created_message = await database_instance.messages.find_one({"_id": result.inserted_id})
                            
                            # Broadcast message to all group members (including sender)
                            created_at = created_message.get("created_at")
                            if isinstance(created_at, datetime):
                                timestamp = created_at.isoformat()
                            else:
                                timestamp = datetime.utcnow().isoformat()
                            
                            message_response = {
                                "type": "new_message",
                                "id": str(created_message["_id"]),
                                "content": created_message["content"],
                                "user_id": created_message["user_id"],
                                "username": created_message.get("username", username),
                                "group_id": created_message["group_id"],
                                "timestamp": timestamp
                            }
                            
                            # Broadcast to all including sender
                            await manager.broadcast_to_group(
                                group_id,
                                message_response
                            )
                        else:
                            print(f"User {user_id} is not a member of group {group_id} or group not found")
                    else:
                        # Fallback: just broadcast without saving
                        await manager.broadcast_to_group(
                            group_id,
                            {
                                "type": "new_message",
                                "content": data.get("content"),
                                "user_id": user_id,
                                "group_id": group_id,
                                "timestamp": datetime.utcnow().isoformat()
                            }
                        )
                except Exception as e:
                    print(f"Error saving WebSocket message to database: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    # Still broadcast even if save fails
                    await manager.broadcast_to_group(
                        group_id,
                        {
                            "type": "new_message",
                            "content": data.get("content"),
                            "user_id": user_id,
                            "group_id": group_id,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    )
            elif message_type == "call_start":
                # Broadcast call notification to all group members except caller
                await manager.broadcast_to_group(
                    group_id,
                    {
                        "type": "incoming_call",
                        "call_type": data.get("call_type", "voice"),  # voice or video
                        "caller_id": user_id,
                        "group_id": group_id,
                        "caller_name": data.get("caller_name", "User")
                    },
                    exclude_websocket=websocket
                )
            elif message_type == "call_end":
                # Broadcast call end to all group members
                await manager.broadcast_to_group(
                    group_id,
                    {
                        "type": "call_ended",
                        "user_id": user_id,
                        "group_id": group_id
                    }
                )
            elif message_type == "call_accept":
                # Notify caller that call was accepted
                await manager.broadcast_to_group(
                    group_id,
                    {
                        "type": "call_accepted",
                        "user_id": user_id,
                        "group_id": group_id,
                        "acceptor_name": data.get("acceptor_name", "User")
                    }
                )
            elif message_type == "call_decline":
                # Notify caller that call was declined
                await manager.broadcast_to_group(
                    group_id,
                    {
                        "type": "call_declined",
                        "user_id": user_id,
                        "group_id": group_id
                    }
                )
            elif message_type == "webrtc_offer":
                # Forward WebRTC offer to target user
                target_user_id = data.get("target_user_id")
                if target_user_id:
                    await manager.send_to_user(
                        group_id,
                        target_user_id,
                        {
                            "type": "webrtc_offer",
                            "offer": data.get("offer"),
                            "caller_id": user_id,
                            "group_id": group_id
                        }
                    )
            elif message_type == "webrtc_answer":
                # Forward WebRTC answer to target user
                target_user_id = data.get("target_user_id")
                if target_user_id:
                    await manager.send_to_user(
                        group_id,
                        target_user_id,
                        {
                            "type": "webrtc_answer",
                            "answer": data.get("answer"),
                            "answerer_id": user_id,
                            "group_id": group_id
                        }
                    )
            elif message_type == "webrtc_ice_candidate":
                # Forward ICE candidate to target user
                target_user_id = data.get("target_user_id")
                if target_user_id:
                    await manager.send_to_user(
                        group_id,
                        target_user_id,
                        {
                            "type": "webrtc_ice_candidate",
                            "candidate": data.get("candidate"),
                            "sender_id": user_id,
                            "group_id": group_id
                        }
                    )
            elif message_type == "participant_mute_status":
                # Broadcast mute status to all participants in the group
                await manager.broadcast_to_group(
                    group_id,
                    {
                        "type": "participant_mute_status",
                        "user_id": user_id,
                        "is_muted": data.get("is_muted", False),
                        "group_id": group_id
                    },
                    exclude_websocket=websocket
                )
            elif message_type == "call_participant_ready":
                # User joined call and is ready, notify others and send list of existing participants
                # Get all users currently in the call (connected to WebSocket)
                participants = []
                if group_id in manager.active_connections:
                    for ws in manager.active_connections[group_id]:
                        participant_id = manager.connection_users.get(ws)
                        if participant_id and participant_id != user_id:
                            participants.append(participant_id)
                
                # Notify the new participant about existing participants
                await manager.send_to_user(
                    group_id,
                    user_id,
                    {
                        "type": "call_participants_list",
                        "participants": participants,
                        "group_id": group_id
                    }
                )
                
                # Notify existing participants about the new participant
                await manager.broadcast_to_group(
                    group_id,
                    {
                        "type": "call_participant_ready",
                        "user_id": user_id,
                        "group_id": group_id
                    },
                    exclude_websocket=websocket
                )
            elif message_type == "call_participant_ready":
                # User joined call and is ready, notify others and send list of existing participants
                # Get all users currently in the call (connected to WebSocket)
                participants = []
                if group_id in manager.active_connections:
                    for ws in manager.active_connections[group_id]:
                        participant_id = manager.connection_users.get(ws)
                        if participant_id and participant_id != user_id:
                            participants.append(participant_id)
                
                # Notify the new participant about existing participants
                await manager.send_to_user(
                    group_id,
                    user_id,
                    {
                        "type": "call_participants_list",
                        "participants": participants,
                        "group_id": group_id
                    }
                )
                
                # Notify existing participants about the new participant
                await manager.broadcast_to_group(
                    group_id,
                    {
                        "type": "call_participant_ready",
                        "user_id": user_id,
                        "group_id": group_id
                    },
                    exclude_websocket=websocket
                )
    except WebSocketDisconnect:
        manager.disconnect(websocket, group_id)
    except Exception as e:
        print(f"WebSocket error: {str(e)}")
        import traceback
        traceback.print_exc()
        try:
            manager.disconnect(websocket, group_id)
        except:
            pass

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
