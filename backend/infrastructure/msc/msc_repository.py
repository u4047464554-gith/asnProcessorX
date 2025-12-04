import os
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID

from backend.domain.msc.interfaces import IMscRepository
from backend.domain.msc.entities import MscSequence, MscMessage, ValidationResult, ValidationType, TrackedIdentifier, MscSession

class MscRepository(IMscRepository):
    """File-based repository for persisting MSC sequences."""
    
    def __init__(self, storage_path: str, user_id: Optional[str] = None):
        self.storage_path = storage_path
        self.user_id = user_id  # Optional user ID for user-based organization
        self._ensure_storage_directory()
    
    def _ensure_storage_directory(self) -> None:
        """Create storage directory if it doesn't exist."""
        os.makedirs(self.storage_path, exist_ok=True)
    
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
        """Find sequence file by ID, searching all protocol subdirectories."""
        # First try direct lookup in root
        direct_path = os.path.join(self.storage_path, f"{sequence_id}.json")
        if os.path.exists(direct_path):
            return direct_path
        
        # Search in protocol subdirectories
        if os.path.exists(self.storage_path):
            for item in os.listdir(self.storage_path):
                item_path = os.path.join(self.storage_path, item)
                if os.path.isdir(item_path):
                    # Check if file exists in this protocol directory
                    for filename in os.listdir(item_path):
                        if filename.endswith('.json'):
                            # Check if this file contains the sequence_id
                            file_path = os.path.join(item_path, filename)
                            try:
                                with open(file_path, 'r') as f:
                                    data = json.load(f)
                                    if data.get('id') == sequence_id:
                                        return file_path
                            except:
                                continue
                            
                            # Also check filename pattern: name_id.json
                            if sequence_id in filename or filename.startswith(sequence_id[:8]):
                                return file_path
        
        return None
    
    def _serialize_sequence(self, sequence: MscSequence) -> Dict[str, Any]:
        """Serialize MscSequence to JSON-compatible dictionary."""
        result = {
            'id': sequence.id,
            'name': sequence.name,
            'protocol': sequence.protocol,
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
        
        # Create sequence
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
            created_at=datetime.fromisoformat(data['created_at']),
            updated_at=datetime.fromisoformat(data['updated_at'])
        )
        
        return sequence
    
    def create_sequence(self, sequence: MscSequence) -> MscSequence:
        """Create and persist a new sequence."""
        sequence_file = self._sequence_file_path(sequence.id, sequence.name, sequence.protocol, sequence.session_id)
        
        # Serialize and save
        sequence_data = self._serialize_sequence(sequence)
        with open(sequence_file, 'w') as f:
            json.dump(sequence_data, f, indent=2, default=str)
        
        return sequence
    
    def get_sequence(self, sequence_id: str) -> Optional[MscSequence]:
        """Retrieve a sequence by ID."""
        sequence_file = self._find_sequence_file(sequence_id)
        if not sequence_file or not os.path.exists(sequence_file):
            return None
        
        try:
            with open(sequence_file, 'r') as f:
                data = json.load(f)
            
            return self._deserialize_sequence(data)
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"Error loading sequence {sequence_id}: {e}")
            return None
    
    def update_sequence(self, sequence: MscSequence) -> MscSequence:
        """Update an existing sequence."""
        # Check if sequence exists
        existing = self.get_sequence(sequence.id)
        if not existing:
            raise ValueError(f"Sequence {sequence.id} not found")
        
        # Find old file location
        old_file = self._find_sequence_file(sequence.id)
        sequence_file = self._sequence_file_path(sequence.id, sequence.name, sequence.protocol, sequence.session_id)
        
        # If file location changed (name or protocol changed), remove old file
        if old_file and old_file != sequence_file and os.path.exists(old_file):
            try:
                os.remove(old_file)
            except OSError:
                pass  # Ignore if can't remove
        
        # Serialize and save
        sequence_data = self._serialize_sequence(sequence)
        with open(sequence_file, 'w') as f:
            json.dump(sequence_data, f, indent=2, default=str)
        
        return sequence
    
    def delete_sequence(self, sequence_id: str) -> bool:
        """Delete a sequence by ID."""
        sequence_file = self._find_sequence_file(sequence_id)
        if not sequence_file:
            return False
        
        if os.path.exists(sequence_file):
            try:
                os.remove(sequence_file)
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
                            # Filter by session_id if specified
                            if session_id is None or data.get('session_id') == session_id:
                                sequence = self._deserialize_sequence(data)
                                sequences.append(sequence)
                    
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
                if filename.endswith('.json') and not filename.startswith('example_'):
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
                        except:
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
        session_file = self._session_file_path(session.id)
        
        session_data = {
            'id': session.id,
            'name': session.name,
            'description': session.description,
            'created_at': session.created_at.isoformat(),
            'updated_at': session.updated_at.isoformat(),
            'is_active': session.is_active
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
                                except (json.JSONDecodeError, KeyError, ValueError) as e:
                                    continue
        
        # Sort by updated_at descending
        sessions.sort(key=lambda s: s.updated_at, reverse=True)
        return sessions
    
    def update_session(self, session: MscSession) -> MscSession:
        """Update an existing session."""
        session_file = self._session_file_path(session.id)
        
        if not os.path.exists(session_file):
            raise ValueError(f"Session {session.id} not found")
        
        session_data = {
            'id': session.id,
            'name': session.name,
            'description': session.description,
            'created_at': session.created_at.isoformat(),
            'updated_at': datetime.now().isoformat(),
            'is_active': session.is_active
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

