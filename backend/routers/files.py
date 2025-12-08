from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
from backend.core.manager import manager

router = APIRouter()

class FileContent(BaseModel):
    content: str

class CreateFileRequest(BaseModel):
    filename: str
    content: Optional[str] = None

@router.get("/protocols/{protocol}/files")
async def list_files(protocol: str):
    path = manager.get_protocol_path(protocol)
    if not path:
        raise HTTPException(404, "Protocol not found")
    
    # List .asn files
    try:
        files = [f for f in os.listdir(path) if f.endswith('.asn')]
        return files
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/protocols/{protocol}/files/{filename}")
async def read_file(protocol: str, filename: str):
    path = manager.get_protocol_path(protocol)
    if not path:
        raise HTTPException(404, "Protocol not found")
    
    # Security check
    if ".." in filename or "/" in filename or "\\" in filename:
         raise HTTPException(400, "Invalid filename")
         
    filepath = os.path.join(path, filename)
    if not os.path.exists(filepath):
         raise HTTPException(404, "File not found")
         
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return {"content": f.read()}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.put("/protocols/{protocol}/files/{filename}")
async def write_file(protocol: str, filename: str, body: FileContent):
    path = manager.get_protocol_path(protocol)
    if not path:
        raise HTTPException(404, "Protocol not found")
    
    if ".." in filename or "/" in filename or "\\" in filename:
         raise HTTPException(400, "Invalid filename")

    filepath = os.path.join(path, filename)
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(body.content)
    except Exception as e:
        raise HTTPException(500, str(e))
    
    # Trigger reload so changes take effect in the compiler
    errors = manager.reload()
    if protocol in errors:
         # We return 200 because the file WAS saved, but we warn the user
         return {
             "status": "warning",
             "message": f"File saved, but compilation failed: {errors[protocol]}",
             "error": errors[protocol]
         }

    return {"status": "success"}

@router.post("/protocols/{protocol}/files")
async def create_file(protocol: str, body: CreateFileRequest):
    path = manager.get_protocol_path(protocol)
    if not path:
        raise HTTPException(404, "Protocol not found")
    
    filename = body.filename
    if ".." in filename or "/" in filename or "\\" in filename:
         raise HTTPException(400, "Invalid filename")
    
    if not filename.endswith('.asn'):
        raise HTTPException(400, "Filename must end with .asn")

    filepath = os.path.join(path, filename)
    if os.path.exists(filepath):
        raise HTTPException(409, "File already exists")

    try:
        content = body.content if body.content is not None else "-- New ASN.1 Module\n"
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(500, str(e))
        
    errors = manager.reload()
    if protocol in errors:
         return {
             "status": "warning",
             "message": f"File created, but compilation failed: {errors[protocol]}",
             "error": errors[protocol]
         }
    return {"status": "success"}

@router.get("/protocols/{protocol}/definitions")
async def get_definitions(protocol: str):
    return manager.scan_definitions(protocol)
