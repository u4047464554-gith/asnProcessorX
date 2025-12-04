from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from .entities import MscSequence, MscMessage, ValidationResult, TrackedIdentifier, MscSession

class IIdentifierDetector(ABC):
    """Interface for detecting identifier and configuration fields from ASN.1 schemas."""
    
    @abstractmethod
    def detect_identifiers(self, protocol: str, type_name: str) -> List[str]:
        """
        Detect identifier fields for a given protocol and type.
        
        Args:
            protocol: Protocol name (e.g., 'rrc_demo')
            type_name: ASN.1 type name (e.g., 'RRCConnectionRequest')
        
        Returns:
            List of field names that should be tracked as identifiers/configurations
        """
        pass
    
    @abstractmethod
    def is_identifier_field(self, field_name: str, field_type: str) -> bool:
        """Determine if a field should be tracked as an identifier."""
        pass

class IConfigurationTracker(ABC):
    """Interface for tracking configuration values across message sequences."""
    
    @abstractmethod
    def track_value(self, identifier_name: str, message_index: int, value: Any) -> TrackedIdentifier:
        """Track a value for an identifier at a specific message index."""
        pass
    
    @abstractmethod
    def get_suggestions(self, identifier_name: str, message_index: int) -> List[dict]:
        """Get suggested values for an identifier based on previous messages."""
        pass
    
    @abstractmethod
    def detect_conflicts(self, identifier_name: str) -> List[str]:
        """Detect and return conflicts for a specific identifier."""
        pass

class ISequenceValidator(ABC):
    """Interface for validating MSC sequences."""
    
    @abstractmethod
    def validate_sequence(self, sequence: MscSequence) -> List[ValidationResult]:
        """Validate the entire sequence for consistency and state transitions."""
        pass
    
    @abstractmethod
    def validate_message(self, message: MscMessage, sequence_context: Dict[str, Any]) -> List[ValidationResult]:
        """Validate a single message in the context of the sequence."""
        pass

class IStateMachine(ABC):
    """Interface for protocol state machine validation."""
    
    @abstractmethod
    def get_current_state(self, sequence: MscSequence) -> str:
        """Determine current state based on sequence history."""
        pass
    
    @abstractmethod
    def is_valid_transition(self, current_state: str, message_type: str, message_data: Dict[str, Any]) -> bool:
        """Check if a message type is valid from the current state."""
        pass
    
    @abstractmethod
    def get_next_state(self, current_state: str, message_type: str, message_data: Dict[str, Any]) -> str:
        """Calculate next state after message processing."""
        pass

class IMscRepository(ABC):
    """Interface for MSC sequence persistence."""
    
    @abstractmethod
    def create_sequence(self, sequence: MscSequence) -> MscSequence:
        """Create and persist a new sequence."""
        pass
    
    @abstractmethod
    def get_sequence(self, sequence_id: str) -> Optional[MscSequence]:
        """Retrieve a sequence by ID."""
        pass
    
    @abstractmethod
    def update_sequence(self, sequence: MscSequence) -> MscSequence:
        """Update an existing sequence."""
        pass
    
    @abstractmethod
    def delete_sequence(self, sequence_id: str) -> bool:
        """Delete a sequence by ID."""
        pass
    
    @abstractmethod
    def list_sequences(self, protocol: Optional[str] = None, session_id: Optional[str] = None) -> List[MscSequence]:
        """List sequences, optionally filtered by protocol and session."""
        pass
    
    # Session Management Methods
    @abstractmethod
    def create_session(self, session: MscSession) -> MscSession:
        """Create and persist a new session."""
        pass
    
    @abstractmethod
    def get_session(self, session_id: str) -> Optional[MscSession]:
        """Retrieve a session by ID."""
        pass
    
    @abstractmethod
    def list_sessions(self) -> List[MscSession]:
        """List all sessions."""
        pass
    
    @abstractmethod
    def update_session(self, session: MscSession) -> MscSession:
        """Update an existing session."""
        pass
    
    @abstractmethod
    def delete_session(self, session_id: str) -> bool:
        """Delete a session and optionally its sequences."""
        pass

