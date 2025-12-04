from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import json
import glob
from typing import Any
from backend.core.config import config_manager

router = APIRouter()

class SaveMessageRequest(BaseModel):
    filename: str
    protocol: str
    type: str
    data: Any

@router.get("")
async def list_messages():
    path = config_manager.get_messages_path()
    if not os.path.exists(path):
        return []
    files = sorted(glob.glob(os.path.join(path, "*.json")))
    return [os.path.basename(f) for f in files]

@router.post("")
async def save_message(req: SaveMessageRequest):
    path = config_manager.get_messages_path()
    if not os.path.exists(path):
        os.makedirs(path)
    
    filename = req.filename
    if not filename.endswith('.json'):
        filename += '.json'
        
    filepath = os.path.join(path, filename)
    
    try:
        with open(filepath, 'w') as f:
            json.dump(req.model_dump(), f, indent=2)
    except Exception as e:
        raise HTTPException(500, f"Failed to save: {e}")
        
    return {"status": "success", "filename": filename}

@router.get("/{filename}")
async def load_message(filename: str):
    path = config_manager.get_messages_path()
    filepath = os.path.join(path, filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "Message not found")
    
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(500, f"Failed to load: {e}")

@router.delete("/{filename}")
async def delete_message(filename: str):
    path = config_manager.get_messages_path()
    filepath = os.path.join(path, filename)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception as e:
            raise HTTPException(500, f"Failed to delete: {e}")
    return {"status": "success"}

@router.delete("")
async def clear_messages():
    path = config_manager.get_messages_path()
    if os.path.exists(path):
        try:
            files = glob.glob(os.path.join(path, "*.json"))
            for f in files:
                os.remove(f)
        except Exception as e:
            raise HTTPException(500, f"Failed to clear: {e}")
    return {"status": "success"}








