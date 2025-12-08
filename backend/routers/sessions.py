from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import json
import uuid
from datetime import datetime
from typing import List, Optional
from backend.core.config import config_manager

router = APIRouter()

class Session(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    created_at: str
    updated_at: str

class CreateSessionRequest(BaseModel):
    name: str
    description: Optional[str] = ""

class UpdateSessionRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

def _get_sessions_path() -> str:
    """Get the base path for user sessions."""
    base = config_manager.get_messages_path()
    sessions_path = os.path.join(os.path.dirname(base), "sessions")
    os.makedirs(sessions_path, exist_ok=True)
    return sessions_path

def _get_session_path(session_id: str) -> str:
    """Get path for a specific session."""
    return os.path.join(_get_sessions_path(), session_id)

def _get_session_meta_path(session_id: str) -> str:
    """Get path for session metadata file."""
    return os.path.join(_get_session_path(session_id), "_session.json")

def _load_session(session_id: str) -> Optional[Session]:
    """Load session metadata."""
    meta_path = _get_session_meta_path(session_id)
    if not os.path.exists(meta_path):
        return None
    try:
        with open(meta_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return Session(**data)
    except Exception:
        return None

def _save_session(session: Session):
    """Save session metadata."""
    session_path = _get_session_path(session.id)
    os.makedirs(session_path, exist_ok=True)
    
    meta_path = _get_session_meta_path(session.id)
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(session.model_dump(), f, indent=2)

def _ensure_default_session():
    """Ensure a default session exists."""
    sessions = _list_sessions()
    if not sessions:
        # Create default session
        session = Session(
            id="default",
            name="Default Session",
            description="Default working session",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
        _save_session(session)
        return session
    return None

def _list_sessions() -> List[Session]:
    """List all sessions."""
    sessions_path = _get_sessions_path()
    sessions = []
    
    if os.path.exists(sessions_path):
        for item in os.listdir(sessions_path):
            item_path = os.path.join(sessions_path, item)
            if os.path.isdir(item_path):
                session = _load_session(item)
                if session:
                    sessions.append(session)
    
    return sorted(sessions, key=lambda s: s.created_at)

@router.get("")
async def list_sessions() -> List[Session]:
    """List all user sessions."""
    _ensure_default_session()
    return _list_sessions()

@router.post("")
async def create_session(req: CreateSessionRequest) -> Session:
    """Create a new session."""
    session = Session(
        id=str(uuid.uuid4())[:8],
        name=req.name,
        description=req.description or "",
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat()
    )
    _save_session(session)
    return session

@router.get("/{session_id}")
async def get_session(session_id: str) -> Session:
    """Get a session by ID."""
    session = _load_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session

@router.put("/{session_id}")
async def update_session(session_id: str, req: UpdateSessionRequest) -> Session:
    """Update a session."""
    session = _load_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    
    if req.name is not None:
        session.name = req.name
    if req.description is not None:
        session.description = req.description
    session.updated_at = datetime.now().isoformat()
    
    _save_session(session)
    return session

@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and all its data."""
    session_path = _get_session_path(session_id)
    if not os.path.exists(session_path):
        raise HTTPException(404, "Session not found")
    
    # Don't allow deleting the last session
    sessions = _list_sessions()
    if len(sessions) <= 1:
        raise HTTPException(400, "Cannot delete the last session")
    
    import shutil
    shutil.rmtree(session_path)
    return {"status": "success"}

# Session-scoped data endpoints

@router.get("/{session_id}/scratchpad")
async def get_session_scratchpad(session_id: str):
    """Get scratchpad for a session."""
    filepath = os.path.join(_get_session_path(session_id), "scratchpad.txt")
    if not os.path.exists(filepath):
        return {"content": ""}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return {"content": f.read()}
    except Exception:
        return {"content": ""}

@router.put("/{session_id}/scratchpad")
async def save_session_scratchpad(session_id: str, req: dict):
    """Save scratchpad for a session."""
    session_path = _get_session_path(session_id)
    os.makedirs(session_path, exist_ok=True)
    
    filepath = os.path.join(session_path, "scratchpad.txt")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(req.get("content", ""))
    
    return {"status": "success"}

@router.get("/{session_id}/messages")
async def list_session_messages(session_id: str) -> List[str]:
    """List saved messages for a session."""
    messages_path = os.path.join(_get_session_path(session_id), "messages")
    if not os.path.exists(messages_path):
        return []
    
    import glob
    files = sorted(glob.glob(os.path.join(messages_path, "*.json")))
    return [os.path.basename(f) for f in files]

@router.post("/{session_id}/messages")
async def save_session_message(session_id: str, req: dict):
    """Save a message to a session."""
    messages_path = os.path.join(_get_session_path(session_id), "messages")
    os.makedirs(messages_path, exist_ok=True)
    
    filename = req.get("filename", "")
    if not filename.endswith('.json'):
        filename += '.json'
    
    filepath = os.path.join(messages_path, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(req, f, indent=2)
    
    return {"status": "success", "filename": filename}

@router.get("/{session_id}/messages/{filename}")
async def get_session_message(session_id: str, filename: str):
    """Get a message from a session."""
    filepath = os.path.join(_get_session_path(session_id), "messages", filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "Message not found")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

@router.delete("/{session_id}/messages/{filename}")
async def delete_session_message(session_id: str, filename: str):
    """Delete a message from a session."""
    filepath = os.path.join(_get_session_path(session_id), "messages", filename)
    if os.path.exists(filepath):
        os.remove(filepath)
    return {"status": "success"}

@router.delete("/{session_id}/messages")
async def clear_session_messages(session_id: str):
    """Clear all messages in a session."""
    messages_path = os.path.join(_get_session_path(session_id), "messages")
    if os.path.exists(messages_path):
        import glob
        for f in glob.glob(os.path.join(messages_path, "*.json")):
            os.remove(f)
    return {"status": "success"}
