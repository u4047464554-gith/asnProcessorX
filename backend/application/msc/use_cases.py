from typing import List, Dict, Optional, Any
from uuid import uuid4
from datetime import datetime

from backend.domain.msc.entities import (
    MscSequence, 
    MscMessage, 
    ValidationResult, 
    ValidationType,
    TrackedIdentifier
)
from backend.domain.msc.interfaces import (
    IIdentifierDetector, 
    IConfigurationTracker, 
    ISequenceValidator, 
    IStateMachine, 
    IMscRepository
)

class CreateSequenceUseCase:
    """Use case for creating a new MSC sequence."""
    
    def __init__(self, repository: IMscRepository):
        self.repository = repository
    
    def execute(self, name: str, protocol: str) -> MscSequence:
        """
        Create a new MSC sequence.
        
        Args:
            name: Sequence name
            protocol: Protocol name (e.g., 'rrc_demo')
        
        Returns:
            Created MscSequence
        """
        sequence = MscSequence(
            id=str(uuid4()),
            name=name,
            protocol=protocol,
            messages=[],
            sub_sequences=[],
            tracked_identifiers={},
            validation_results=[]
        )
        return self.repository.create_sequence(sequence)

class UpdateSequenceUseCase:
    """Use case for updating an existing MSC sequence."""
    
    def __init__(self, repository: IMscRepository):
        self.repository = repository
    
    def execute(self, sequence_id: str, updates: Dict[str, Any]) -> Optional[MscSequence]:
        """
        Update an existing MSC sequence.
        
        Args:
            sequence_id: ID of sequence to update
            updates: Dictionary of updates (name, add_message, etc.)
        
        Returns:
            Updated MscSequence or None if not found
        """
        sequence = self.repository.get_sequence(sequence_id)
        if not sequence:
            return None
        
        # Apply updates
        if 'name' in updates:
            sequence.name = updates['name']
        
        if 'add_message' in updates:
            message_data = updates['add_message']
            message = MscMessage(
                id=str(uuid4()),
                type_name=message_data['type_name'],
                data=message_data['data'],
                source_actor=message_data['source_actor'],
                target_actor=message_data['target_actor'],
                timestamp=datetime.now().timestamp()
            )
            sequence.add_message(message)
        
        if 'remove_message' in updates:
            sequence.remove_message(updates['remove_message'])
        
        sequence.updated_at = datetime.now()
        return self.repository.update_sequence(sequence)

class ValidateSequenceUseCase:
    """Use case for validating an MSC sequence."""
    
    def __init__(self, validator: ISequenceValidator, state_machine: IStateMachine):
        self.validator = validator
        self.state_machine = state_machine
    
    def execute(self, sequence: MscSequence) -> List[ValidationResult]:
        """
        Validate the entire MSC sequence.
        
        Args:
            sequence: MscSequence to validate
        
        Returns:
            List of validation results
        """
        # Run sequence validation
        results = self.validator.validate_sequence(sequence)
        
        # Additional state machine validation
        current_state = self.state_machine.get_current_state(sequence)
        for i, message in enumerate(sequence.messages):
            is_valid_transition = self.state_machine.is_valid_transition(
                current_state, 
                message.type_name, 
                message.data
            )
            
            if not is_valid_transition:
                results.append(ValidationResult(
                    type=ValidationType.ERROR,
                    message=f"Invalid state transition from {current_state} with message {message.type_name}",
                    message_index=i,
                    code="INVALID_TRANSITION"
                ))
            
            # Update state for next message
            current_state = self.state_machine.get_next_state(
                current_state, 
                message.type_name, 
                message.data
            )
        
        sequence.validation_results = results
        return results

class DetectIdentifiersUseCase:
    """Use case for detecting identifiers from protocol schema."""
    
    def __init__(self, detector: IIdentifierDetector):
        self.detector = detector
    
    def execute(self, protocol: str, type_name: str) -> List[str]:
        """
        Detect identifiers and configuration fields for a message type.
        
        Args:
            protocol: Protocol name
            type_name: ASN.1 type name
        
        Returns:
            List of field names to track
        """
        return self.detector.detect_identifiers(protocol, type_name)

class GetConfigurationSuggestionsUseCase:
    """Use case for getting configuration suggestions for a message field."""
    
    def __init__(self, tracker: IConfigurationTracker, detector: IIdentifierDetector):
        self.tracker = tracker
        self.detector = detector
    
    def execute(self, sequence: MscSequence, message_index: int, field_name: str, protocol: str, type_name: str) -> List[dict]:
        """
        Get configuration suggestions for a field in a message.
        
        Args:
            sequence: Current sequence
            message_index: Index of message being edited
            field_name: Field name to get suggestions for
            protocol: Protocol name
            type_name: Message type name
        
        Returns:
            List of suggestion dictionaries
        """
        # First check if this is a tracked identifier
        identifiers = self.detector.detect_identifiers(protocol, type_name)
        
        if field_name in identifiers:
            # Get suggestions from tracker
            return self.tracker.get_suggestions(field_name, message_index)
        
        # For non-tracked fields, return empty suggestions
        return []

class MscUseCaseFactory:
    """Factory for creating MSC use cases with dependency injection."""
    
    def __init__(self, 
                 repository: IMscRepository,
                 detector: IIdentifierDetector,
                 tracker: IConfigurationTracker,
                 validator: ISequenceValidator,
                 state_machine: IStateMachine):
        self.repository = repository
        self.detector = detector
        self.tracker = tracker
        self.validator = validator
        self.state_machine = state_machine
    
    def create_sequence(self) -> CreateSequenceUseCase:
        return CreateSequenceUseCase(self.repository)
    
    def update_sequence(self) -> UpdateSequenceUseCase:
        return UpdateSequenceUseCase(self.repository)
    
    def validate_sequence(self) -> ValidateSequenceUseCase:
        return ValidateSequenceUseCase(self.validator, self.state_machine)
    
    def detect_identifiers(self) -> DetectIdentifiersUseCase:
        return DetectIdentifiersUseCase(self.detector)
    
    def get_configuration_suggestions(self) -> GetConfigurationSuggestionsUseCase:
        return GetConfigurationSuggestionsUseCase(self.tracker, self.detector)

