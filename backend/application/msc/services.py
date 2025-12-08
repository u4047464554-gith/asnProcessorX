from typing import List, Dict, Optional, Any
from datetime import datetime
from uuid import uuid4

from backend.domain.msc.entities import (
    MscSequence, 
    MscMessage, 
    ValidationResult,
    ValidationType,
    MscSession
)
from .use_cases import MscUseCaseFactory

class SequenceDTO:
    """Data Transfer Object for sequence API communication."""
    
    def __init__(self, sequence: MscSequence):
        self.id = sequence.id
        self.name = sequence.name
        self.protocol = sequence.protocol
        self.session_id = sequence.session_id
        self.messages = [
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
        ]
        self.sub_sequences = []  # Simplified for initial implementation
        self.tracked_identifiers = {
            name: {
                'name': identifier.name,
                'values': identifier.values,
                'is_consistent': identifier.is_consistent(),
                'conflicts': identifier.conflicts
            } for name, identifier in sequence.tracked_identifiers.items()
        }
        self.validation_results = [
            {
                'type': result.type.value,
                'message': result.message,
                'field': result.field,
                'message_index': result.message_index,
                'code': result.code
            } for result in sequence.validation_results
        ]
        self.created_at = sequence.created_at.isoformat()
        self.updated_at = sequence.updated_at.isoformat()
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SequenceDTO':
        """Create DTO from API request data."""
        # This would parse the incoming data and create domain entities
        # Simplified for initial implementation
        return cls(MscSequence(
            id=data.get('id', str(uuid4())),
            name=data.get('name', 'New Sequence'),
            protocol=data.get('protocol', 'rrc_demo'),
            messages=[],
            sub_sequences=[],
            tracked_identifiers={},
            validation_results=[],
            session_id=data.get('session_id')
        ))

class MessageDTO:
    """Data Transfer Object for message API communication."""
    
    def __init__(self, message: MscMessage):
        self.id = message.id
        self.type_name = message.type_name
        self.data = message.data
        self.source_actor = message.source_actor
        self.target_actor = message.target_actor
        self.timestamp = message.timestamp
        self.validation_errors = [
            {
                'type': error.type.value,
                'message': error.message,
                'field': error.field,
                'message_index': error.message_index,
                'code': error.code
            } for error in message.validation_errors
        ]
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MessageDTO':
        """Create DTO from API request data."""
        return cls(MscMessage(
            id=data.get('id'),
            type_name=data.get('type_name'),
            data=data.get('data', {}),
            source_actor=data.get('source_actor', 'UE'),
            target_actor=data.get('target_actor', 'gNB'),
            timestamp=data.get('timestamp', datetime.now().timestamp())
        ))

class MscApplicationService:
    """Application service that orchestrates MSC use cases."""
    
    def __init__(self, use_case_factory: MscUseCaseFactory):
        self.factory = use_case_factory
    
    def create_sequence(self, name: str, protocol: str, session_id: Optional[str] = None) -> SequenceDTO:
        """Create a new MSC sequence."""
        use_case = self.factory.create_sequence()
        sequence = use_case.execute(name, protocol, session_id)
        return SequenceDTO(sequence)
    
    def get_sequence(self, sequence_id: str) -> Optional[SequenceDTO]:
        """Retrieve an existing MSC sequence."""
        use_case = self.factory.create_sequence()  # Reuse repository
        repository = use_case.repository
        sequence = repository.get_sequence(sequence_id)
        return SequenceDTO(sequence) if sequence else None
    
    def update_sequence(self, sequence_id: str, updates: Dict[str, Any]) -> Optional[SequenceDTO]:
        """Update an existing MSC sequence."""
        use_case = self.factory.update_sequence()
        sequence = use_case.execute(sequence_id, updates)
        return SequenceDTO(sequence) if sequence else None
    
    def delete_sequence(self, sequence_id: str) -> bool:
        """Delete an MSC sequence."""
        use_case = self.factory.create_sequence()  # Reuse repository
        repository = use_case.repository
        return repository.delete_sequence(sequence_id)
    
    def add_message_to_sequence(self, sequence_id: str, message_data: Dict[str, Any]) -> SequenceDTO:
        """Add a message to an existing sequence."""
        # Get existing sequence
        get_use_case = self.factory.create_sequence()
        repository = get_use_case.repository
        sequence = repository.get_sequence(sequence_id)
        
        if not sequence:
            raise ValueError(f"Sequence {sequence_id} not found")
        
        # Create message
        message_dto = MessageDTO.from_dict(message_data)
        message = MscMessage(
            id=message_dto.id,
            type_name=message_dto.type_name,
            data=message_dto.data,
            source_actor=message_dto.source_actor,
            target_actor=message_dto.target_actor,
            timestamp=datetime.now().timestamp()
        )
        
        # Add to sequence
        sequence.add_message(message)
        
        # Update in repository
        repository.update_sequence(sequence)
        
        return SequenceDTO(sequence)
    
    def validate_sequence(self, sequence_id: str) -> List[ValidationResult]:
        """Validate an MSC sequence."""
        # Get sequence
        get_use_case = self.factory.create_sequence()
        repository = get_use_case.repository
        sequence = repository.get_sequence(sequence_id)
        
        if not sequence:
            raise ValueError(f"Sequence {sequence_id} not found")
        
        # Validate
        validate_use_case = self.factory.validate_sequence()
        results = validate_use_case.execute(sequence)
        
        # Update sequence with results
        sequence.validation_results = results
        repository.update_sequence(sequence)
        
        return results
    
    def detect_identifiers(self, protocol: str, type_name: str) -> List[str]:
        """Detect identifiers for a message type."""
        use_case = self.factory.detect_identifiers()
        return use_case.execute(protocol, type_name)
    
    def get_field_suggestions(self, sequence_id: str, message_index: int, field_name: str, protocol: str, type_name: str) -> List[Dict[str, Any]]:
        """Get configuration suggestions for a field."""
        # Get sequence
        get_use_case = self.factory.create_sequence()
        repository = get_use_case.repository
        sequence = repository.get_sequence(sequence_id)
        
        if not sequence:
            return []
        
        # Get suggestions
        suggestions_use_case = self.factory.get_configuration_suggestions()
        suggestions = suggestions_use_case.execute(sequence, message_index, field_name, protocol, type_name)
        
        return suggestions
    
    def list_sequences(self, protocol: Optional[str] = None, session_id: Optional[str] = None) -> List[SequenceDTO]:
        """List all sequences for a protocol or all protocols, optionally filtered by session."""
        get_use_case = self.factory.create_sequence()
        repository = get_use_case.repository
        domain_sequences = repository.list_sequences(protocol, session_id)
        
        return [SequenceDTO(seq) for seq in domain_sequences]
    
    # Session Management Methods
    def create_session(self, name: str, description: Optional[str] = None) -> MscSession:
        """Create a new session."""
        get_use_case = self.factory.create_sequence()
        repository = get_use_case.repository
        session = MscSession(name=name, description=description)
        return repository.create_session(session)
    
    def get_session(self, session_id: str) -> Optional[MscSession]:
        """Get a session by ID."""
        get_use_case = self.factory.create_sequence()
        repository = get_use_case.repository
        return repository.get_session(session_id)
    
    def list_sessions(self) -> List[MscSession]:
        """List all sessions."""
        get_use_case = self.factory.create_sequence()
        repository = get_use_case.repository
        return repository.list_sessions()
    
    def update_session(self, session_id: str, name: str, description: Optional[str] = None) -> MscSession:
        """Update a session."""
        get_use_case = self.factory.create_sequence()
        repository = get_use_case.repository
        session = repository.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        session.name = name
        session.description = description
        session.updated_at = datetime.now()
        return repository.update_session(session)
    
    def delete_session(self, session_id: str) -> bool:
        """Delete a session."""
        get_use_case = self.factory.create_sequence()
        repository = get_use_case.repository
        return repository.delete_session(session_id)

# API Response DTOs
class ValidationResponse:
    """DTO for validation API response."""
    
    def __init__(self, results: List[ValidationResult], has_errors: bool = False):
        self.results = [
            {
                'type': result.type.value,
                'message': result.message,
                'field': result.field,
                'message_index': result.message_index,
                'code': result.code
            } for result in results
        ]
        self.has_errors = has_errors or any(r.type == ValidationType.ERROR for r in results)
        self.error_count = sum(1 for r in results if r.type == ValidationType.ERROR)
        self.warning_count = sum(1 for r in results if r.type == ValidationType.WARNING)

class IdentifierDetectionResponse:
    """DTO for identifier detection API response."""
    
    def __init__(self, identifiers: List[str], protocol: str, type_name: str):
        self.identifiers = identifiers
        self.protocol = protocol
        self.type_name = type_name
        self.count = len(identifiers)
        self.detected_at = datetime.now().isoformat()

