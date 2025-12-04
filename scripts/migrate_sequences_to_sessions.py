"""
Migration script to organize existing MSC sequences into sessions.

This script:
1. Creates a default session if it doesn't exist
2. Moves all existing sequences (including "Untitled Sequence" files) to the default session
3. Updates sequence files to include session_id
4. Organizes files into the new session-based directory structure
"""

import os
import json
import shutil
from pathlib import Path
from datetime import datetime
from uuid import uuid4
from typing import Dict, Any, Optional

# Configuration
STORAGE_PATH = Path(__file__).parent.parent / "backend" / "msc_storage"
DEFAULT_SESSION_NAME = "Default Session"
DEFAULT_SESSION_DESCRIPTION = "Migrated sequences from previous storage"

def sanitize_filename(name: str) -> str:
    """Sanitize a name for use in filename."""
    import re
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', name)
    sanitized = sanitized[:100]
    sanitized = sanitized.strip('. ')
    return sanitized or "sequence"

def find_all_sequence_files(storage_path: Path) -> list[Path]:
    """Find all sequence JSON files in the storage directory."""
    sequence_files = []
    
    if not storage_path.exists():
        return sequence_files
    
    # Search in root and protocol subdirectories
    search_paths = [storage_path]
    
    for item in storage_path.iterdir():
        if item.is_dir() and not item.name.startswith('.') and item.name != 'sessions':
            search_paths.append(item)
    
    for search_path in search_paths:
        for file_path in search_path.rglob('*.json'):
            # Skip example files and session metadata files
            if file_path.name.startswith('example_'):
                continue
            if file_path.parent.name == 'sessions' and file_path.parent.parent.name == 'sessions':
                # This is a session metadata file, skip it
                continue
            sequence_files.append(file_path)
    
    return sequence_files

def create_default_session(storage_path: Path) -> str:
    """Create a default session and return its ID."""
    sessions_dir = storage_path / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    
    # Check if default session already exists
    for session_file in sessions_dir.glob("*.json"):
        try:
            with open(session_file, 'r') as f:
                session_data = json.load(f)
                if session_data.get('name') == DEFAULT_SESSION_NAME:
                    print(f"Default session already exists: {session_data.get('id')}")
                    return session_data.get('id')
        except:
            continue
    
    # Create new default session
    session_id = str(uuid4())
    session_data = {
        'id': session_id,
        'name': DEFAULT_SESSION_NAME,
        'description': DEFAULT_SESSION_DESCRIPTION,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
        'is_active': True
    }
    
    session_file = sessions_dir / f"{session_id}.json"
    with open(session_file, 'w') as f:
        json.dump(session_data, f, indent=2)
    
    print(f"Created default session: {session_id}")
    return session_id

def migrate_sequence_file(file_path: Path, session_id: str, storage_path: Path) -> bool:
    """Migrate a single sequence file to the session-based structure."""
    try:
        # Read sequence data
        with open(file_path, 'r', encoding='utf-8') as f:
            sequence_data = json.load(f)
        
        sequence_id = sequence_data.get('id')
        if not sequence_id:
            print(f"Skipping {file_path.name}: No ID found")
            return False
        
        # Check if already migrated (has session_id)
        if sequence_data.get('session_id'):
            print(f"Skipping {file_path.name}: Already has session_id")
            return False
        
        # Add session_id to sequence data
        sequence_data['session_id'] = session_id
        
        # Determine new file location
        protocol = sequence_data.get('protocol', 'unknown')
        sequence_name = sequence_data.get('name', 'Untitled Sequence')
        
        # Create session directory structure
        session_dir = storage_path / "sessions" / session_id / protocol
        session_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate new filename
        safe_name = sanitize_filename(sequence_name)
        short_id = sequence_id.split('-')[0] if '-' in sequence_id else sequence_id[:8]
        new_filename = f"{safe_name}_{short_id}.json"
        new_file_path = session_dir / new_filename
        
        # Write updated sequence data to new location
        with open(new_file_path, 'w', encoding='utf-8') as f:
            json.dump(sequence_data, f, indent=2, default=str)
        
        # Remove old file
        if file_path != new_file_path:
            file_path.unlink()
            print(f"Migrated: {file_path.name} -> sessions/{session_id}/{protocol}/{new_filename}")
        else:
            # File is already in the right place, just update content
            print(f"Updated: {file_path.name} (added session_id)")
        
        return True
        
    except Exception as e:
        print(f"Error migrating {file_path.name}: {e}")
        return False

def main():
    """Main migration function."""
    print("=" * 60)
    print("MSC Sequence Migration to Sessions")
    print("=" * 60)
    print()
    
    if not STORAGE_PATH.exists():
        print(f"Storage path does not exist: {STORAGE_PATH}")
        return
    
    # Step 1: Create default session
    print("Step 1: Creating default session...")
    session_id = create_default_session(STORAGE_PATH)
    print()
    
    # Step 2: Find all sequence files
    print("Step 2: Finding sequence files...")
    sequence_files = find_all_sequence_files(STORAGE_PATH)
    print(f"Found {len(sequence_files)} sequence files")
    print()
    
    # Step 3: Migrate each file
    print("Step 3: Migrating sequences...")
    migrated = 0
    skipped = 0
    errors = 0
    
    for file_path in sequence_files:
        if migrate_sequence_file(file_path, session_id, STORAGE_PATH):
            migrated += 1
        else:
            skipped += 1
    
    print()
    print("=" * 60)
    print("Migration Summary")
    print("=" * 60)
    print(f"Total files found: {len(sequence_files)}")
    print(f"Successfully migrated: {migrated}")
    print(f"Skipped: {skipped}")
    print(f"Errors: {errors}")
    print()
    print(f"Default session ID: {session_id}")
    print(f"Session directory: {STORAGE_PATH / 'sessions' / session_id}")
    print()
    print("Migration complete!")

if __name__ == "__main__":
    main()

