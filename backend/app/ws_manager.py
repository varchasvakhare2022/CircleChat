"""
WebSocket connection manager
"""
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
import json
import asyncio

class ConnectionManager:
    def __init__(self):
        # Store connections by group_id -> set of websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Store user_id for each connection
        self.connection_users: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, group_id: str, user_id: str):
        """Connect a user to a group's WebSocket room (websocket should already be accepted)"""
        if group_id not in self.active_connections:
            self.active_connections[group_id] = set()
        
        self.active_connections[group_id].add(websocket)
        self.connection_users[websocket] = user_id
        
        # Notify others in the group that user joined
        await self.broadcast_to_group(
            group_id,
            {
                "type": "user_joined",
                "user_id": user_id,
                "group_id": group_id
            },
            exclude_websocket=websocket
        )

    def disconnect(self, websocket: WebSocket, group_id: str):
        """Disconnect a user from a group's WebSocket room"""
        if group_id in self.active_connections:
            self.active_connections[group_id].discard(websocket)
            if not self.active_connections[group_id]:
                del self.active_connections[group_id]
        
        user_id = self.connection_users.pop(websocket, None)
        
        # Notify others in the group that user left
        if user_id:
            asyncio.create_task(self.broadcast_to_group(
                group_id,
                {
                    "type": "user_left",
                    "user_id": user_id,
                    "group_id": group_id
                }
            ))

    async def broadcast_to_group(self, group_id: str, message: dict, exclude_websocket: WebSocket = None):
        """Broadcast a message to all connections in a group"""
        if group_id not in self.active_connections:
            return
        
        disconnected = set()
        for connection in self.active_connections[group_id]:
            if connection == exclude_websocket:
                continue
            
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error sending message to connection: {str(e)}")
                disconnected.add(connection)
        
        # Clean up disconnected connections
        for conn in disconnected:
            self.disconnect(conn, group_id)

    async def send_personal_message(self, websocket: WebSocket, message: dict):
        """Send a message to a specific connection"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            print(f"Error sending personal message: {str(e)}")

    async def send_to_user(self, group_id: str, target_user_id: str, message: dict):
        """Send a message to a specific user in a group"""
        if group_id not in self.active_connections:
            return
        
        disconnected = set()
        for connection in self.active_connections[group_id]:
            user_id = self.connection_users.get(connection)
            if user_id == target_user_id:
                try:
                    await connection.send_json(message)
                    return  # Found and sent, exit
                except Exception as e:
                    print(f"Error sending message to user {target_user_id}: {str(e)}")
                    disconnected.add(connection)
        
        # Clean up disconnected connections
        for conn in disconnected:
            self.disconnect(conn, group_id)

    def get_group_connections(self, group_id: str) -> Set[WebSocket]:
        """Get all active connections for a group"""
        return self.active_connections.get(group_id, set())

# Global connection manager instance
manager = ConnectionManager()

