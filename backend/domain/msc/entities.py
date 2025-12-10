from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum
from uuid import uuid4

class ValidationType(Enum):
    ERROR = "error"
    WARNING = "warning"

@dataclass(frozen=True)
class ValidationResult:
    type: ValidationType
    message: str
    field: Optional[str] = None
    message_index: Optional[int] = None
    code: Optional[str] = None

    def is_error(self) -> bool:
        return self.type == ValidationType.ERROR

@dataclass(frozen=True)
class TrackedIdentifier:
    name: str
    values: Dict[int, Any]  # message_index -> value
    conflicts: List[str] = None
    
    def __post_init__(self):
        if self.conflicts is None:
            object.__setattr__(self, 'conflicts', [])
    
    def is_consistent(self) -> bool:
        """Business rule: Check if all values for this identifier are the same."""
        if not self.values:
            return True
        first_value = next(iter(self.values.values()))
        return all(value == first_value for value in self.values.values())
    
    def add_value(self, message_index: int, value: Any) -> 'TrackedIdentifier':
        """Immutable update: create new instance with added value."""
        new_values = self.values.copy()
        new_values[message_index] = value
        
        # Detect conflicts before creating new instance
        new_conflicts = (self.conflicts.copy() if self.conflicts else [])
        if len(new_values) > 1:
            # Check if values are consistent
            first_value = next(iter(new_values.values()))
            is_consistent = all(v == first_value for v in new_values.values())
            
            if not is_consistent:
                conflicting_values = set(new_values.values())
                if len(conflicting_values) > 1:
                    conflict_msg = f"Multiple values for {self.name}: {conflicting_values}"
                    if conflict_msg not in new_conflicts:
                        new_conflicts.append(conflict_msg)
        
        return TrackedIdentifier(
            name=self.name,
            values=new_values,
            conflicts=new_conflicts
        )

@dataclass(frozen=True)
class MscMessage:
    id: Optional[str] = None
    type_name: str = ""
    data: Dict[str, Any] = None
    source_actor: str = "UE"
    target_actor: str = "gNB"
    timestamp: float = 0.0
    validation_errors: List[ValidationResult] = None
    
    def __post_init__(self):
        if self.id is None:
            object.__setattr__(self, 'id', str(uuid4()))
        if self.data is None:
            object.__setattr__(self, 'data', {})
        if self.validation_errors is None:
            object.__setattr__(self, 'validation_errors', [])
    
    def is_valid(self) -> bool:
        """Business rule: Message is valid if it has no error-level validation results."""
        return not any(error.is_error() for error in self.validation_errors)
    
    def update_data(self, new_data: Dict[str, Any]) -> 'MscMessage':
        """Immutable update: create new message with updated data."""
        return MscMessage(
            id=self.id,
            type_name=self.type_name,
            data=new_data,
            source_actor=self.source_actor,
            target_actor=self.target_actor,
            timestamp=self.timestamp,
            validation_errors=self.validation_errors
        )

@dataclass
class MscSession:
    """Session entity to organize sequences."""
    id: Optional[str] = None
    name: str = "Default Session"
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True
    
    def __post_init__(self):
        if self.id is None:
            self.id = str(uuid4())
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.updated_at is None:
            self.updated_at = datetime.now()

@dataclass
class MscSequence:
    """Mutable aggregate root for MSC sequence with business rules."""
    id: Optional[str] = None
    name: Optional[str] = None
    protocol: str = ""
    session_id: Optional[str] = None  # Link to session
    messages: Optional[List[MscMessage]] = None
    sub_sequences: Optional[List['MscSequence']] = None
    tracked_identifiers: Optional[Dict[str, TrackedIdentifier]] = None
    validation_results: Optional[List[ValidationResult]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.id is None:
            self.id = str(uuid4())
        if self.name is None:
            self.name = f"Sequence {self.id[:8]}"
        if self.messages is None:
            self.messages = []
        if self.sub_sequences is None:
            self.sub_sequences = []
        if self.tracked_identifiers is None:
            self.tracked_identifiers = {}
        if self.validation_results is None:
            self.validation_results = []
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.updated_at is None:
            self.updated_at = datetime.now()
    
    def add_message(self, message: MscMessage) -> None:
        """Add message and update tracking."""
        self.messages.append(message)
        self._update_tracked_identifiers(message)
        self.updated_at = datetime.now()
    
    def remove_message(self, message_id: str) -> bool:
        """Remove message by ID and clean up tracking."""
        for i, msg in enumerate(self.messages):
            if msg.id == message_id:
                del self.messages[i]
                self._cleanup_tracked_identifiers(message_id)
                self.updated_at = datetime.now()
                return True
        return False
    
    def update_message(self, message_id: str, new_data: Dict[str, Any]) -> bool:
        """Update message data by ID."""
        for i, msg in enumerate(self.messages):
            if msg.id == message_id:
                updated_msg = msg.update_data(new_data)
                self.messages[i] = updated_msg
                self.updated_at = datetime.now()
                return True
        return False
    
    def _update_tracked_identifiers(self, message: MscMessage) -> None:
        """Business rule: Extract and track identifier values from message data."""
        # This would integrate with IIdentifierDetector to know which fields to track
        # For now, placeholder logic for common RRC identifiers
        tracked_fields = ['ue-Identity', 'rrc-TransactionIdentifier', 'establishmentCause']
        
        for field in tracked_fields:
            if field in message.data:
                value = message.data[field]
                identifier_name = field
                message_index = len(self.messages) - 1
                
                if identifier_name not in self.tracked_identifiers:
                    self.tracked_identifiers[identifier_name] = TrackedIdentifier(
                        name=identifier_name,
                        values={message_index: value}
                    )
                else:
                    self.tracked_identifiers[identifier_name] = self.tracked_identifiers[identifier_name].add_value(
                        message_index, value
                    )
    
    def _cleanup_tracked_identifiers(self, message_id: str) -> None:
        """Clean up tracking when message is removed."""
        message_index = next((i for i, msg in enumerate(self.messages) if msg.id == message_id), None)
        if message_index is not None:
            for identifier in self.tracked_identifiers.values():
                if message_index in identifier.values:
                    # Remove the value - this would need immutable update
                    {k: v for k, v in identifier.values.items() if k != message_index}
                    # Recreate with updated values (simplified)
                    pass  # Implementation would update the dataclass
    
    def validate(self) -> List[ValidationResult]:
        """Business rule: Validate the entire sequence."""
        results = []
        
        # Validate individual messages
        for i, message in enumerate(self.messages):
            if not message.is_valid():
                for error in message.validation_errors:
                    results.append(error)
        
        # Validate identifier consistency
        for identifier in self.tracked_identifiers.values():
            if not identifier.is_consistent():
                results.append(ValidationResult(
                    type=ValidationType.ERROR,
                    message=f"Inconsistent values for identifier '{identifier.name}'",
                    code="INCONSISTENT_IDENTIFIER"
                ))
        
        # Validate state transitions (would use IStateMachine)
        # Placeholder for state machine validation
        if len(self.messages) > 1:
            # Simple example: check if second message follows first
            results.append(ValidationResult(
                type=ValidationType.WARNING,
                message="State transition validation pending implementation",
                code="STATE_TRANSITION_CHECK"
            ))
        
        self.validation_results = results
        return results
    
    def get_suggestions(self, message_index: int, field_name: str) -> List[dict]:
        """Business rule: Get suggestions for field values from previous messages."""
        suggestions = []
        if field_name in self.tracked_identifiers:
            identifier = self.tracked_identifiers[field_name]
            # Suggest most recent value before current index
            for idx in sorted(identifier.values.keys()):
                if idx < message_index:
                    suggestions.append({
                        'value': identifier.values[idx],
                        'source_message_index': idx,
                        'confidence': 1.0  # Exact match
                    })
        
        return suggestions
