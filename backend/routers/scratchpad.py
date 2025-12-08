from fastapi import APIRouter
from pydantic import BaseModel
import os
from backend.core.config import config_manager

router = APIRouter()

class ScratchpadRequest(BaseModel):
    content: str

def _get_scratchpad_path() -> str:
    """Get the path to the scratchpad file."""
    path = config_manager.get_messages_path()
    return os.path.join(path, "_scratchpad.txt")

@router.get("")
async def get_scratchpad():
    """Get scratchpad content."""
    filepath = _get_scratchpad_path()
    if not os.path.exists(filepath):
        return {"content": ""}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return {"content": f.read()}
    except Exception:
        return {"content": ""}

@router.put("")
async def save_scratchpad(req: ScratchpadRequest):
    """Save scratchpad content."""
    filepath = _get_scratchpad_path()
    # Ensure directory exists
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(req.content)
    
    return {"status": "success"}
