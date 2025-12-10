import os
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from backend.domain.msc.interfaces import IMscRepository
from backend.domain.msc.entities import MscSequence, MscMessage, ValidationResult, ValidationType, TrackedIdentifier, MscSession

class MscRepository(IMscRepository):
    """File-based repository for persisting MSC sequences."""
    
    def __init__(self, storage_path: str, user_id: Optional[str] = None):
        self.storage_path = storage_path
        self.user_id = user_id  # Optional user ID for user-based organization
        self._index: Dict[str, str] = {}  # sequence_id -> file_path
        self._ensure_storage_directory()
        self._load_index()
    
    def _ensure_storage_directory(self) -> None:
        """Create storage directory if it doesn't exist."""
        os.makedirs(self.storage_path, exist_ok=True)
    
    def _index_file_path(self) -> str:
        """Get path to the index file."""
        return os.path.join(self.storage_path, '_sequence_index.json')
    
    def _load_index(self) -> None:
        """Load index from file, or rebuild if missing."""
        index_path = self._index_file_path()
        if os.path.exists(index_path):
            try:
                with open(index_path, 'r') as f:
                    self._index = json.load(f)
                # Validate that indexed files still exist
                valid_index = {}
                for seq_id, path in self._index.items():
                    if os.path.exists(path):
                        valid_index[seq_id] = path
                self._index = valid_index
                return
            except Exception:
                pass
        # Rebuild index by scanning
        self._rebuild_index()
    
    def _save_index(self) -> None:
        """Save index to file."""
        index_path = self._index_file_path()
        try:
            with open(index_path, 'w') as f:
                json.dump(self._index, f, indent=2)
        except Exception:
            pass  # Non-critical
    
    def _rebuild_index(self) -> None:
        """Rebuild index by scanning all directories."""
        self._index = {}
        self._scan_directory_for_index(self.storage_path)
        self._save_index()
    
    def _scan_directory_for_index(self, dir_path: str) -> None:
        """Recursively scan directory to build index."""
        if not os.path.exists(dir_path):
            return
        for item in os.listdir(dir_path):
            item_path = os.path.join(dir_path, item)
            if os.path.isfile(item_path) and item.endswith('.json') and not item.startswith('_') and not item.startswith('example_'):
                try:
                    with open(item_path, 'r') as f:
                        data = json.load(f)
                    if 'id' in data and 'protocol' in data:  # It's a sequence file
                        self._index[data['id']] = item_path
                except Exception:
                    continue
            elif os.path.isdir(item_path) and not item.startswith('.'):
                self._scan_directory_for_index(item_path)
    
    def _update_index(self, sequence_id: str, file_path: str) -> None:
        """Update index with a sequence path."""
        self._index[sequence_id] = file_path
        self._save_index()
    
    def _remove_from_index(self, sequence_id: str) -> None:
        """Remove a sequence from the index."""
        if sequence_id in self._index:
            del self._index[sequence_id]
            self._save_index()
    
    def _sanitize_filename(self, name: str) -> str:
        """Sanitize a name for use in filename."""
        import re
        # Remove or replace invalid filename characters
        sanitized = re.sub(r'[<>:"/\\|?*]', '_', name)
        # Limit length
        sanitized = sanitized[:100]
        # Remove leading/trailing spaces and dots
        sanitized = sanitized.strip('. ')
        return sanitized or "sequence"
    
    def _sequence_file_path(self, sequence_id: str, sequence_name: str = None, protocol: str = None, session_id: str = None) -> str:
        """Get file path for a specific sequence with readable naming, organized by user/session."""
        # Create user/session subdirectory structure: users/{user_id}/sessions/{session_id}/{protocol}/
        if self.user_id:
            # User-based organization
            if session_id:
                session_dir = os.path.join(self.storage_path, 'users', self.user_id, 'sessions', session_id)
                if protocol:
                    protocol_dir = os.path.join(session_dir, protocol)
                    os.makedirs(protocol_dir, exist_ok=True)
                    base_path = protocol_dir
                else:
                    os.makedirs(session_dir, exist_ok=True)
                    base_path = session_dir
            else:
                # No session, but user-based: users/{user_id}/{protocol}/
                if protocol:
                    protocol_dir = os.path.join(self.storage_path, 'users', self.user_id, protocol)
                    os.makedirs(protocol_dir, exist_ok=True)
                    base_path = protocol_dir
                else:
                    user_dir = os.path.join(self.storage_path, 'users', self.user_id)
                    os.makedirs(user_dir, exist_ok=True)
                    base_path = user_dir
        elif session_id:
            # Session-based organization (no user)
            session_dir = os.path.join(self.storage_path, 'sessions', session_id)
            if protocol:
                protocol_dir = os.path.join(session_dir, protocol)
                os.makedirs(protocol_dir, exist_ok=True)
                base_path = protocol_dir
            else:
                os.makedirs(session_dir, exist_ok=True)
                base_path = session_dir
        else:
            # Legacy: protocol subdirectory for backward compatibility
            if protocol:
                protocol_dir = os.path.join(self.storage_path, protocol)
                os.makedirs(protocol_dir, exist_ok=True)
                base_path = protocol_dir
            else:
                base_path = self.storage_path
        
        # Use readable filename: name_id.json
        if sequence_name:
            safe_name = self._sanitize_filename(sequence_name)
            filename = f"{safe_name}_{sequence_id[:8]}.json"
        else:
            filename = f"{sequence_id}.json"
        
        return os.path.join(base_path, filename)
    
    def _find_sequence_file(self, sequence_id: str) -> Optional[str]:
        """Find sequence file by ID using the index."""
        # Use index for O(1) lookup
        if sequence_id in self._index:
            path = self._index[sequence_id]
            if os.path.exists(path):
                return path
            # Path in index but file doesn't exist - remove from index
            self._remove_from_index(sequence_id)
        
        # Fallback: try direct lookup in root (for legacy files)
        direct_path = os.path.join(self.storage_path, f"{sequence_id}.json")
        if os.path.exists(direct_path):
            self._update_index(sequence_id, direct_path)
            return direct_path
        
        return None
    
    def _serialize_sequence(self, sequence: MscSequence) -> Dict[str, Any]:
        """Serialize MscSequence to JSON-compatible dictionary."""
        from backend.version import __version__
        
        result = {
            'id': sequence.id,
            'name': sequence.name,
            'protocol': sequence.protocol,
            'app_version': __version__,  # Track which version created/modified this file
            'messages': [
                {
                    'id': msg.id,
                    'type_name': msg.type_name,
                    'data': msg.data,
                    'source_actor': msg.source_actor,
                    'target_actor': msg.target_actor,
                    'timestamp': msg.timestamp,
                    'validation_errors': [
                        {
                            'type': error.type.value,
                            'message': error.message,
                            'field': error.field,
                            'message_index': error.message_index,
                            'code': error.code
                        } for error in msg.validation_errors
                    ]
                } for msg in sequence.messages
            ],
            'sub_sequences': [],  # Simplified for initial implementation
            'tracked_identifiers': {
                name: {
                    'name': identifier.name,
                    'values': identifier.values,
                    'conflicts': identifier.conflicts
                } for name, identifier in sequence.tracked_identifiers.items()
            },
            'validation_results': [
                {
                    'type': result.type.value,
                    'message': result.message,
                    'field': result.field,
                    'message_index': result.message_index,
                    'code': result.code
                } for result in sequence.validation_results
            ],
            'created_at': sequence.created_at.isoformat(),
            'updated_at': sequence.updated_at.isoformat()
        }
        if sequence.session_id:
            result['session_id'] = sequence.session_id
        return result
    
    def _deserialize_sequence(self, data: Dict[str, Any]) -> MscSequence:
        """Deserialize JSON data to MscSequence."""
        from backend.version import __version__
        
        # Track file version for compatibility/migration purposes
        file_version = data.get('app_version')
        if file_version:
            if file_version != __version__:
                print(f"Loading sequence created with version {file_version} (current: {__version__})", flush=True)
        
        # Create messages from data
        messages = []
        for msg_data in data.get('messages', []):
            message = MscMessage(
                id=msg_data.get('id'),
                type_name=msg_data['type_name'],
                data=msg_data['data'],
                source_actor=msg_data['source_actor'],
                target_actor=msg_data['target_actor'],
                timestamp=msg_data['timestamp'],
                validation_errors=[
                    ValidationResult(
                        type=ValidationType(error_data['type']),
                        message=error_data['message'],
                        field=error_data.get('field'),
                        message_index=error_data.get('message_index'),
                        code=error_data.get('code')
                    ) for error_data in msg_data.get('validation_errors', [])
                ]
            )
            messages.append(message)
        
        # Create tracked identifiers
        tracked_identifiers = {}
        for name, identifier_data in data.get('tracked_identifiers', {}).items():
            tracked_identifiers[name] = TrackedIdentifier(
                name=identifier_data['name'],
                values=identifier_data['values']
            )
        
        # Create sequence with backward compatibility for missing timestamps
        # Use current time as default if timestamps are missing
        created_at = data.get('created_at')
        updated_at = data.get('updated_at')
        
        sequence = MscSequence(
            id=data['id'],
            name=data['name'],
            protocol=data['protocol'],
            session_id=data.get('session_id'),  # Optional for backward compatibility
            messages=messages,
            sub_sequences=[],  # Simplified
            tracked_identifiers=tracked_identifiers,
            validation_results=[
                ValidationResult(
                    type=ValidationType(result_data['type']),
                    message=result_data['message'],
                    field=result_data.get('field'),
                    message_index=result_data.get('message_index'),
                    code=result_data.get('code')
                ) for result_data in data.get('validation_results', [])
            ],
            created_at=datetime.fromisoformat(created_at) if created_at else datetime.now(),
            updated_at=datetime.fromisoformat(updated_at) if updated_at else datetime.now()
        )
        
        return sequence
    
    def create_sequence(self, sequence: MscSequence) -> MscSequence:
        """Create and persist a new sequence."""
        from backend.version import __version__
        
        # Use versioned filename from creation
        sequence_file = self._get_versioned_file_path(
            sequence.id, 
            sequence.name, 
            sequence.protocol, 
            sequence.session_id,
            __version__
        )
        
        # Serialize and save
        sequence_data = self._serialize_sequence(sequence)
        with open(sequence_file, 'w') as f:
            json.dump(sequence_data, f, indent=2, default=str)
        
        # Update index
        self._update_index(sequence.id, sequence_file)
        
        return sequence
    
    def get_sequence(self, sequence_id: str) -> Optional[MscSequence]:
        """Retrieve a sequence by ID."""
        from backend.version import __version__
        
        sequence_file = self._find_sequence_file(sequence_id)
        if not sequence_file or not os.path.exists(sequence_file):
            return None
        
        try:
            with open(sequence_file, 'r') as f:
                data = json.load(f)
            
            sequence = self._deserialize_sequence(data)
            
            # Check if file needs migration to current version
            file_version = data.get('app_version')
            needs_migration = file_version != __version__
            
            if needs_migration:
                print(f"🔄 Migrating sequence {sequence.name} from version {file_version or 'unversioned'} to {__version__}", flush=True)
                
                # Create new versioned filename
                versioned_file = self._get_versioned_file_path(
                    sequence.id, 
                    sequence.name, 
                    sequence.protocol, 
                    sequence.session_id,
                    __version__
                )
                
                # Save migrated version with new filename
                sequence_data = self._serialize_sequence(sequence)
                with open(versioned_file, 'w') as f:
                    json.dump(sequence_data, f, indent=2, default=str)
                
                # Update index to point to new file
                self._update_index(sequence.id, versioned_file)
                
                print(f"✅ Migrated to: {os.path.basename(versioned_file)}", flush=True)
                print(f"📦 Original preserved: {os.path.basename(sequence_file)}", flush=True)
            
            return sequence
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"Error loading sequence {sequence_id}: {e}")
            return None
    
    def _get_versioned_file_path(self, sequence_id: str, sequence_name: str, protocol: str, session_id: Optional[str], version: str) -> str:
        """Get file path with version tag in filename."""
        # Get base directory using existing logic
        if self.user_id:
            if session_id:
                session_dir = os.path.join(self.storage_path, 'users', self.user_id, 'sessions', session_id)
                if protocol:
                    protocol_dir = os.path.join(session_dir, protocol)
                    os.makedirs(protocol_dir, exist_ok=True)
                    base_path = protocol_dir
                else:
                    os.makedirs(session_dir, exist_ok=True)
                    base_path = session_dir
            else:
                if protocol:
                    protocol_dir = os.path.join(self.storage_path, 'users', self.user_id, protocol)
                    os.makedirs(protocol_dir, exist_ok=True)
                    base_path = protocol_dir
                else:
                    user_dir = os.path.join(self.storage_path, 'users', self.user_id)
                    os.makedirs(user_dir, exist_ok=True)
                    base_path = user_dir
        elif session_id:
            session_dir = os.path.join(self.storage_path, 'sessions', session_id)
            if protocol:
                protocol_dir = os.path.join(session_dir, protocol)
                os.makedirs(protocol_dir, exist_ok=True)
                base_path = protocol_dir
            else:
                os.makedirs(session_dir, exist_ok=True)
                base_path = session_dir
        else:
            if protocol:
                protocol_dir = os.path.join(self.storage_path, protocol)
                os.makedirs(protocol_dir, exist_ok=True)
                base_path = protocol_dir
            else:
                base_path = self.storage_path
        
        # Create filename with version tag: name_id_v0.3.0.json
        safe_name = self._sanitize_filename(sequence_name) if sequence_name else "sequence"
        # Remove dots from version for filename safety
        safe_version = version.replace('.', '_')
        filename = f"{safe_name}_{sequence_id[:8]}_v{safe_version}.json"
        
        return os.path.join(base_path, filename)
    
    def update_sequence(self, sequence: MscSequence) -> MscSequence:
        """Update an existing sequence."""
        from backend.version import __version__
        
        # Check if sequence exists
        existing = self.get_sequence(sequence.id)
        if not existing:
            raise ValueError(f"Sequence {sequence.id} not found")
        
        # Find old file location
        self._find_sequence_file(sequence.id)
        
        # Use versioned filename
        sequence_file = self._get_versioned_file_path(
            sequence.id, 
            sequence.name, 
            sequence.protocol, 
            sequence.session_id,
            __version__
        )
        
        # If file location changed (name or protocol changed), keep old file as backup
        # Don't remove it - we preserve version history
        
        # Serialize and save to (potentially new) location
        sequence_data = self._serialize_sequence(sequence)
        with open(sequence_file, 'w') as f:
            json.dump(sequence_data, f, indent=2, default=str)
        
        # Update index with new path
        self._update_index(sequence.id, sequence_file)
        
        return sequence
    
    def delete_sequence(self, sequence_id: str) -> bool:
        """Delete a sequence by ID."""
        sequence_file = self._find_sequence_file(sequence_id)
        if not sequence_file:
            return False
        
        if os.path.exists(sequence_file):
            try:
                os.remove(sequence_file)
                # Remove from index
                self._remove_from_index(sequence_id)
                return True
            except OSError as e:
                print(f"Error deleting sequence {sequence_id}: {e}")
                return False
        
        return False
    
    def list_sequences(self, protocol: Optional[str] = None, session_id: Optional[str] = None) -> List[MscSequence]:
        """List sequences, optionally filtered by protocol and session."""
        sequences = []
        
        if not os.path.exists(self.storage_path):
            return sequences
        
        # Determine search paths based on session_id
        search_paths = []
        
        if session_id:
            # Search in session directory
            session_dir = os.path.join(self.storage_path, 'sessions', session_id)
            if protocol:
                protocol_path = os.path.join(session_dir, protocol)
                if os.path.exists(protocol_path):
                    search_paths = [protocol_path]
            else:
                if os.path.exists(session_dir):
                    # Search all protocol subdirectories in session
                    for item in os.listdir(session_dir):
                        item_path = os.path.join(session_dir, item)
                        if os.path.isdir(item_path):
                            search_paths.append(item_path)
        else:
            # Legacy: search in root and protocol subdirectories (for backward compatibility)
            search_paths = [self.storage_path]
            
            if protocol:
                protocol_path = os.path.join(self.storage_path, protocol)
                if os.path.exists(protocol_path):
                    search_paths = [protocol_path]
            else:
                # Add all protocol subdirectories
                for item in os.listdir(self.storage_path):
                    item_path = os.path.join(self.storage_path, item)
                    if os.path.isdir(item_path) and not item.startswith('.') and item != 'sessions':
                        search_paths.append(item_path)
            
            # Also search in sessions directory (all sessions)
            sessions_dir = os.path.join(self.storage_path, 'sessions')
            if os.path.exists(sessions_dir):
                for session_item in os.listdir(sessions_dir):
                    session_path = os.path.join(sessions_dir, session_item)
                    if os.path.isdir(session_path):
                        if protocol:
                            protocol_path = os.path.join(session_path, protocol)
                            if os.path.exists(protocol_path):
                                search_paths.append(protocol_path)
                        else:
                            for proto_item in os.listdir(session_path):
                                proto_path = os.path.join(session_path, proto_item)
                                if os.path.isdir(proto_path):
                                    search_paths.append(proto_path)
        
        # Get all JSON files in search paths
        for search_path in search_paths:
            if not os.path.exists(search_path):
                continue
                
            for filename in os.listdir(search_path):
                if filename.endswith('.json') and not filename.startswith('example_'):
                    sequence_file = os.path.join(search_path, filename)
                    
                    try:
                        with open(sequence_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        # Filter by protocol if specified
                        if protocol is None or data.get('protocol') == protocol:
                            # Infer session_id from path if missing in data
                            inferred_session_id = None
                            try:
                                rel_path = os.path.relpath(sequence_file, self.storage_path)
                                path_parts = rel_path.split(os.sep)
                                if len(path_parts) > 2 and path_parts[0] == 'sessions':
                                    inferred_session_id = path_parts[1]
                            except ValueError:
                                pass

                            # Determine session ID from data or path
                            seq_session_id = data.get('session_id') or data.get('sessionId') or inferred_session_id
                            
                            if session_id is None or seq_session_id == session_id:
                                # Update session_id in data if it was missing to ensure correct deserialization
                                if seq_session_id and not data.get('session_id'):
                                    data['session_id'] = seq_session_id
                                    
                                sequence = self._deserialize_sequence(data)
                                sequences.append(sequence)
                                print(f"DEBUG: Found valid sequence {filename} for session {session_id}", flush=True)
                            else:
                                print(f"DEBUG: Skipping {filename}: session {seq_session_id} != {session_id}", flush=True)
                    
                    except (json.JSONDecodeError, KeyError, ValueError) as e:
                        print(f"Error loading sequence file {filename}: {e}", flush=True)
                        continue
        
        # Sort by updated_at descending
        sequences.sort(key=lambda s: s.updated_at, reverse=True)
        return sequences
    
    def get_sequence_statistics(self) -> Dict[str, Any]:
        """Get statistics about stored sequences."""
        stats = {
            'total_sequences': 0,
            'total_messages': 0,
            'protocols': {},
            'recent_sequences': []
        }
        
        sequences = self.list_sequences()
        stats['total_sequences'] = len(sequences)
        
        for sequence in sequences:
            # Count messages
            stats['total_messages'] += len(sequence.messages)
            
            # Protocol stats
            protocol = sequence.protocol
            if protocol not in stats['protocols']:
                stats['protocols'][protocol] = {'count': 0, 'messages': 0}
            stats['protocols'][protocol]['count'] += 1
            stats['protocols'][protocol]['messages'] += len(sequence.messages)
            
            # Recent sequences (last 5)
            if len(stats['recent_sequences']) < 5:
                stats['recent_sequences'].append({
                    'id': sequence.id,
                    'name': sequence.name,
                    'protocol': protocol,
                    'message_count': len(sequence.messages),
                    'updated_at': sequence.updated_at.isoformat()
                })
        
        return stats
    
    def cleanup_old_sequences(self, max_age_days: int = 30) -> int:
        """Clean up sequences older than max_age_days."""
        deleted_count = 0
        cutoff_time = datetime.now() - timedelta(days=max_age_days)
        
        # Search in root and all protocol subdirectories
        search_paths = [self.storage_path]
        for item in os.listdir(self.storage_path):
            item_path = os.path.join(self.storage_path, item)
            if os.path.isdir(item_path) and not item.startswith('.'):
                search_paths.append(item_path)
        
        for search_path in search_paths:
            if not os.path.exists(search_path):
                continue
                
            for filename in os.listdir(search_path):
                if filename.endswith('.json') and not filename.startswith('example_') and not filename.startswith('_'):
                    sequence_file = os.path.join(search_path, filename)
                    
                    try:
                        with open(sequence_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        updated_at = datetime.fromisoformat(data['updated_at'])
                        if updated_at < cutoff_time:
                            os.remove(sequence_file)
                            deleted_count += 1
                            
                    except (json.JSONDecodeError, OSError, ValueError):
                        # Skip files that can't be read
                        continue
        
        return deleted_count
    
    def reorganize_storage(self) -> Dict[str, Any]:
        """Reorganize storage: move files to protocol subdirectories with readable names."""
        reorganized = 0
        errors = []
        
        if not os.path.exists(self.storage_path):
            return {"reorganized": 0, "errors": []}
        
        # Process files in root directory
        for filename in os.listdir(self.storage_path):
            if not filename.endswith('.json') or filename.startswith('example_'):
                continue
            
            file_path = os.path.join(self.storage_path, filename)
            if os.path.isdir(file_path):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                sequence_id = data.get('id')
                sequence_name = data.get('name', 'Untitled Sequence')
                protocol = data.get('protocol', 'unknown')
                
                if not sequence_id:
                    continue
                
                # Determine new file path
                new_path = self._sequence_file_path(sequence_id, sequence_name, protocol)
                
                # Only move if different
                if new_path != file_path:
                    # Ensure directory exists
                    os.makedirs(os.path.dirname(new_path), exist_ok=True)
                    
                    # Move file
                    if os.path.exists(new_path):
                        # If target exists, keep the newer one
                        try:
                            with open(new_path, 'r') as f2:
                                existing_data = json.load(f2)
                            existing_updated = datetime.fromisoformat(existing_data.get('updated_at', '2000-01-01'))
                            current_updated = datetime.fromisoformat(data.get('updated_at', '2000-01-01'))
                            
                            if current_updated > existing_updated:
                                os.remove(new_path)
                                os.rename(file_path, new_path)
                                reorganized += 1
                            else:
                                os.remove(file_path)  # Keep existing, remove old
                                reorganized += 1
                        except Exception:
                            os.rename(file_path, new_path)
                            reorganized += 1
                    else:
                        os.rename(file_path, new_path)
                        reorganized += 1
                        
            except Exception as e:
                errors.append(f"Error processing {filename}: {str(e)}")
                continue
        
        return {"reorganized": reorganized, "errors": errors}
    
    # Session Management Methods
    
    def _session_file_path(self, session_id: str) -> str:
        """Get file path for a session metadata file."""
        if self.user_id:
            # User-based: users/{user_id}/sessions/{session_id}.json
            sessions_dir = os.path.join(self.storage_path, 'users', self.user_id, 'sessions')
            os.makedirs(sessions_dir, exist_ok=True)
            return os.path.join(sessions_dir, f"{session_id}.json")
        else:
            # Global sessions: sessions/{session_id}.json
            sessions_dir = os.path.join(self.storage_path, 'sessions')
            os.makedirs(sessions_dir, exist_ok=True)
            return os.path.join(sessions_dir, f"{session_id}.json")
    
    def create_session(self, session: MscSession) -> MscSession:
        """Create and persist a new session."""
        from backend.version import __version__
        
        session_file = self._session_file_path(session.id)
        
        session_data = {
            'id': session.id,
            'name': session.name,
            'description': session.description,
            'created_at': session.created_at.isoformat(),
            'updated_at': session.updated_at.isoformat(),
            'is_active': session.is_active,
            'app_version': __version__
        }
        
        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2, default=str)
        
        return session
    
    def get_session(self, session_id: str) -> Optional[MscSession]:
        """Retrieve a session by ID."""
        session_file = self._session_file_path(session_id)
        if not os.path.exists(session_file):
            return None
        
        try:
            with open(session_file, 'r') as f:
                data = json.load(f)
            
            return MscSession(
                id=data['id'],
                name=data['name'],
                description=data.get('description'),
                created_at=datetime.fromisoformat(data['created_at']),
                updated_at=datetime.fromisoformat(data['updated_at']),
                is_active=data.get('is_active', True)
            )
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"Error loading session {session_id}: {e}")
            return None
    
    def list_sessions(self) -> List[MscSession]:
        """List all sessions for the current user (or all sessions if no user)."""
        sessions = []
        
        if self.user_id:
            # List sessions for specific user
            user_sessions_dir = os.path.join(self.storage_path, 'users', self.user_id, 'sessions')
            if os.path.exists(user_sessions_dir):
                for filename in os.listdir(user_sessions_dir):
                    if filename.endswith('.json') and not filename.startswith('example_'):
                        session_file = os.path.join(user_sessions_dir, filename)
                        try:
                            with open(session_file, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                            
                            if 'name' in data and 'is_active' in data:
                                session = MscSession(
                                    id=data['id'],
                                    name=data['name'],
                                    description=data.get('description'),
                                    created_at=datetime.fromisoformat(data['created_at']),
                                    updated_at=datetime.fromisoformat(data['updated_at']),
                                    is_active=data.get('is_active', True)
                                )
                                sessions.append(session)
                        except (json.JSONDecodeError, KeyError, ValueError) as e:
                            print(f"Error loading session file {filename}: {e}", flush=True)
                            continue
        else:
            # List all global sessions
            sessions_dir = os.path.join(self.storage_path, 'sessions')
            if os.path.exists(sessions_dir):
                for filename in os.listdir(sessions_dir):
                    if filename.endswith('.json') and not filename.startswith('example_'):
                        session_file = os.path.join(sessions_dir, filename)
                        try:
                            with open(session_file, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                            
                            if 'name' in data and 'is_active' in data:
                                session = MscSession(
                                    id=data['id'],
                                    name=data['name'],
                                    description=data.get('description'),
                                    created_at=datetime.fromisoformat(data['created_at']),
                                    updated_at=datetime.fromisoformat(data['updated_at']),
                                    is_active=data.get('is_active', True)
                                )
                                sessions.append(session)
                        except (json.JSONDecodeError, KeyError, ValueError) as e:
                            print(f"Error loading session file {filename}: {e}", flush=True)
                            continue
            
            # Also list sessions from all users (if no user_id specified)
            users_dir = os.path.join(self.storage_path, 'users')
            if os.path.exists(users_dir):
                for user_item in os.listdir(users_dir):
                    user_sessions_dir = os.path.join(users_dir, user_item, 'sessions')
                    if os.path.exists(user_sessions_dir):
                        for filename in os.listdir(user_sessions_dir):
                            if filename.endswith('.json') and not filename.startswith('example_'):
                                session_file = os.path.join(user_sessions_dir, filename)
                                try:
                                    with open(session_file, 'r', encoding='utf-8') as f:
                                        data = json.load(f)
                                    
                                    if 'name' in data and 'is_active' in data:
                                        session = MscSession(
                                            id=data['id'],
                                            name=data['name'],
                                            description=data.get('description'),
                                            created_at=datetime.fromisoformat(data['created_at']),
                                            updated_at=datetime.fromisoformat(data['updated_at']),
                                            is_active=data.get('is_active', True)
                                        )
                                        sessions.append(session)
                                except (json.JSONDecodeError, KeyError, ValueError):
                                    continue
        
        # Sort by updated_at descending
        sessions.sort(key=lambda s: s.updated_at, reverse=True)
        return sessions
    
    def update_session(self, session: MscSession) -> MscSession:
        """Update an existing session."""
        from backend.version import __version__
        
        session_file = self._session_file_path(session.id)
        
        if not os.path.exists(session_file):
            raise ValueError(f"Session {session.id} not found")
        
        session_data = {
            'id': session.id,
            'name': session.name,
            'description': session.description,
            'created_at': session.created_at.isoformat(),
            'updated_at': datetime.now().isoformat(),
            'is_active': session.is_active,
            'app_version': __version__
        }
        
        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2, default=str)
        
        return session
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session and optionally its sequences."""
        session_file = self._session_file_path(session_id)
        
        if os.path.exists(session_file):
            try:
                os.remove(session_file)
                # Optionally delete session directory with sequences
                session_dir = os.path.join(self.storage_path, 'sessions', session_id)
                if os.path.exists(session_dir):
                    import shutil
                    shutil.rmtree(session_dir)
                return True
            except OSError as e:
                print(f"Error deleting session {session_id}: {e}")
                return False
        
        return False

