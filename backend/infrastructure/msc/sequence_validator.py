from typing import List, Dict, Any
from backend.domain.msc.interfaces import ISequenceValidator, IConfigurationTracker
from backend.domain.msc.entities import (
    MscSequence, 
    MscMessage, 
    ValidationResult, 
    ValidationType
)
from backend.core.manager import manager

class SequenceValidator(ISequenceValidator):
    """Concrete implementation for validating MSC sequences."""
    
    def __init__(self, config_tracker: IConfigurationTracker):
        self.config_tracker = config_tracker
    
    def validate_sequence(self, sequence: MscSequence) -> List[ValidationResult]:
        """
        Validate the entire MSC sequence for consistency and correctness.
        
        Args:
            sequence: MscSequence to validate
            
        Returns:
            List of validation results (errors and warnings)
        """
        results = []
        
        # 1. Validate sequence metadata
        results.extend(self._validate_metadata(sequence))
        
        # 2. Validate individual messages
        for i, message in enumerate(sequence.messages):
            message_results = self.validate_message(message, {
                'sequence_index': i,
                'sequence_protocol': sequence.protocol,
                'previous_messages': sequence.messages[:i]
            })
            results.extend(message_results)
        
        # 3. Validate cross-message consistency (identifiers)
        results.extend(self._validate_identifier_consistency(sequence))
        
        # 4. Validate sequence-level rules
        results.extend(self._validate_sequence_rules(sequence))
        
        return results
    
    def validate_message(self, message: MscMessage, sequence_context: Dict[str, Any]) -> List[ValidationResult]:
        """
        Validate a single message in the context of the sequence.
        
        Args:
            message: MscMessage to validate
            sequence_context: Context information about the sequence
            
        Returns:
            List of validation results for this message
        """
        results = []
        sequence_index = sequence_context.get('sequence_index', 0)
        protocol = sequence_context.get('sequence_protocol', 'unknown')
        
        # 1. Basic message structure validation
        results.extend(self._validate_message_structure(message, protocol))
        
        # 2. Data validation based on message type
        results.extend(self._validate_message_data(message, protocol))
        
        # 3. Actor validation
        results.extend(self._validate_actors(message))
        
        # 4. Track identifiers and validate consistency up to this point
        results.extend(self._track_and_validate_identifiers(message, sequence_index))
        
        return results
    
    def _validate_metadata(self, sequence: MscSequence) -> List[ValidationResult]:
        """Validate sequence metadata."""
        results = []
        
        # Check protocol exists
        if not manager.list_protocols().__contains__(sequence.protocol):
            results.append(ValidationResult(
                type=ValidationType.ERROR,
                message=f"Unknown protocol '{sequence.protocol}'",
                code="UNKNOWN_PROTOCOL"
            ))
        
        # Check sequence has at least one message or sub-sequence
        if not sequence.messages and not sequence.sub_sequences:
            results.append(ValidationResult(
                type=ValidationType.WARNING,
                message="Sequence is empty - consider adding messages",
                code="EMPTY_SEQUENCE"
            ))
        
        # Check timestamps are reasonable
        if sequence.updated_at < sequence.created_at:
            results.append(ValidationResult(
                type=ValidationType.ERROR,
                message="Sequence updated_at timestamp precedes created_at",
                code="INVALID_TIMESTAMP"
            ))
        
        return results
    
    def _validate_message_structure(self, message: MscMessage, protocol: str) -> List[ValidationResult]:
        """Validate basic message structure."""
        results = []
        
        # Check required fields are present
        if not message.type_name:
            results.append(ValidationResult(
                type=ValidationType.ERROR,
                message="Message type_name is required",
                message_index=0,  # Will be set by caller
                code="MISSING_TYPE_NAME"
            ))
        
        # Check message type exists in protocol
        compiler = manager.get_compiler(protocol)
        if compiler and message.type_name not in compiler.types:
            results.append(ValidationResult(
                type=ValidationType.WARNING,
                message=f"Message type '{message.type_name}' not found in protocol '{protocol}'",
                code="UNKNOWN_MESSAGE_TYPE"
            ))
        
        # Check actors are valid (basic validation)
        valid_actors = {'UE', 'gNB', 'Network', 'CoreNetwork'}
        if message.source_actor not in valid_actors:
            results.append(ValidationResult(
                type=ValidationType.WARNING,
                message=f"Unknown source actor '{message.source_actor}'",
                field="source_actor",
                code="UNKNOWN_ACTOR"
            ))
        
        if message.target_actor not in valid_actors:
            results.append(ValidationResult(
                type=ValidationType.WARNING,
                message=f"Unknown target actor '{message.target_actor}'",
                field="target_actor",
                code="UNKNOWN_ACTOR"
            ))
        
        # Check timestamp is reasonable
        if message.timestamp < 0:
            results.append(ValidationResult(
                type=ValidationType.ERROR,
                message="Message timestamp cannot be negative",
                field="timestamp",
                code="INVALID_TIMESTAMP"
            ))
        
        return results
    
    def _validate_message_data(self, message: MscMessage, protocol: str) -> List[ValidationResult]:
        """Validate message data content."""
        results = []
        
        # Basic data structure validation
        if not isinstance(message.data, dict):
            results.append(ValidationResult(
                type=ValidationType.ERROR,
                message="Message data must be a dictionary",
                field="data",
                code="INVALID_DATA_TYPE"
            ))
            return results
        
        # Protocol-specific validation (RRC example)
        if protocol.startswith('rrc_') or protocol == 'rrc_demo':
            results.extend(self._validate_rrc_message_data(message))
        
        # Generic validation for common fields
        if 'timestamp' in message.data and not isinstance(message.data['timestamp'], (int, float)):
            results.append(ValidationResult(
                type=ValidationType.ERROR,
                message="Data timestamp must be numeric",
                field="data.timestamp",
                code="INVALID_DATA_TIMESTAMP"
            ))
        
        return results
    
    def _validate_rrc_message_data(self, message: MscMessage) -> List[ValidationResult]:
        """RRC-specific message data validation."""
        results = []
        data = message.data
        
        # Common RRC field validations
        if message.type_name == 'RRCConnectionRequest':
            if 'ue-Identity' not in data:
                results.append(ValidationResult(
                    type=ValidationType.ERROR,
                    message="RRCConnectionRequest requires ue-Identity field",
                    field="ue-Identity",
                    code="MISSING_REQUIRED_FIELD"
                ))
            
            if 'establishmentCause' not in data:
                results.append(ValidationResult(
                    type=ValidationType.ERROR,
                    message="RRCConnectionRequest requires establishmentCause field",
                    field="establishmentCause",
                    code="MISSING_REQUIRED_FIELD"
                ))
        
        elif message.type_name == 'RRCConnectionSetup':
            if 'rrc-TransactionIdentifier' not in data:
                results.append(ValidationResult(
                    type=ValidationType.WARNING,
                    message="RRCConnectionSetup should include rrc-TransactionIdentifier",
                    field="rrc-TransactionIdentifier",
                    code="MISSING_RECOMMENDED_FIELD"
                ))
        
        # Validate common data types
        for field, value in data.items():
            if field == 'ue-Identity' and not isinstance(value, (str, dict)):
                results.append(ValidationResult(
                    type=ValidationType.ERROR,
                    message="ue-Identity must be string or structured object",
                    field=f"data.{field}",
                    code="INVALID_UE_IDENTITY"
                ))
            
            elif field == 'establishmentCause' and not isinstance(value, str):
                results.append(ValidationResult(
                    type=ValidationType.ERROR,
                    message="establishmentCause must be string enum value",
                    field=f"data.{field}",
                    code="INVALID_CAUSE"
                ))
        
        return results
    
    def _validate_actors(self, message: MscMessage) -> List[ValidationResult]:
        """Validate message source and target actors."""
        results = []
        
        # Basic actor validation
        if message.source_actor == message.target_actor:
            results.append(ValidationResult(
                type=ValidationType.WARNING,
                message="Source and target actors are the same - this may indicate a self-message",
                field="actors",
                code="SAME_ACTORS"
            ))
        
        # RRC protocol actor validation
        rrc_source_rules = {
            'RRCConnectionRequest': {'UE'},
            'RRCConnectionSetup': {'gNB'},
            'RRCConnectionSetupComplete': {'UE'},
            'RRCReconfiguration': {'gNB'},
            'MeasurementReport': {'UE'}
        }
        
        if message.type_name in rrc_source_rules:
            expected_sources = rrc_source_rules[message.type_name]
            if message.source_actor not in expected_sources:
                results.append(ValidationResult(
                    type=ValidationType.WARNING,
                    message=f"{message.type_name} typically sent from {expected_sources}, but received from {message.source_actor}",
                    field="source_actor",
                    code="UNEXPECTED_SOURCE"
                ))
        
        return results
    
    def _track_and_validate_identifiers(self, message: MscMessage, message_index: int) -> List[ValidationResult]:
        """Track identifiers in message and validate consistency with previous messages."""
        results = []
        
        # Get identifiers to track for this message type
        # In full implementation, this would use IIdentifierDetector
        identifiers_to_track = self._get_identifiers_for_message_type(message.type_name)
        
        for identifier_name in identifiers_to_track:
            if identifier_name in message.data:
                value = message.data[identifier_name]
                
                # Track the value
                tracked = self.config_tracker.track_value(identifier_name, message_index, value)
                
                # Check for conflicts with previous values
                conflicts = self.config_tracker.detect_conflicts(identifier_name)
                for conflict in conflicts:
                    results.append(ValidationResult(
                        type=ValidationType.ERROR,
                        message=conflict,
                        field=identifier_name,
                        message_index=message_index,
                        code="IDENTIFIER_CONFLICT"
                    ))
            
            else:
                # Missing expected identifier
                results.append(ValidationResult(
                    type=ValidationType.WARNING,
                    message=f"Missing expected identifier '{identifier_name}' in {message.type_name}",
                    field=identifier_name,
                    message_index=message_index,
                    code="MISSING_IDENTIFIER"
                ))
        
        return results
    
    def _get_identifiers_for_message_type(self, type_name: str) -> List[str]:
        """Get identifiers that should be tracked for a specific message type."""
        # RRC-specific identifier mapping
        rrc_identifiers = {
            'RRCConnectionRequest': ['ue-Identity', 'establishmentCause'],
            'RRCConnectionSetup': ['rrc-TransactionIdentifier'],
            'RRCConnectionSetupComplete': ['rrc-TransactionIdentifier'],
            'RRCReconfiguration': ['rrc-TransactionIdentifier'],
            'RRCConnectionRelease': ['rrc-TransactionIdentifier'],
            'MeasurementReport': ['measId'],
            'RRCReestablishmentRequest': ['ue-Identity'],
            'RRCReestablishment': ['rrc-TransactionIdentifier'],
            'RRCReestablishmentComplete': ['rrc-TransactionIdentifier'],
            'SecurityModeCommand': ['rrc-TransactionIdentifier'],
            'SecurityModeComplete': ['rrc-TransactionIdentifier'],
            'SecurityModeFailure': ['rrc-TransactionIdentifier'],
            'UECapabilityEnquiry': ['rrc-TransactionIdentifier'],
            'UECapabilityInformation': ['rrc-TransactionIdentifier']
        }
        
        return rrc_identifiers.get(type_name, [])
    
    def _validate_identifier_consistency(self, sequence: MscSequence) -> List[ValidationResult]:
        """Validate consistency of identifiers across the entire sequence."""
        results = []
        
        for identifier_name, identifier in sequence.tracked_identifiers.items():
            if not identifier.is_consistent():
                conflicts = self.config_tracker.detect_conflicts(identifier_name)
                for conflict in conflicts:
                    # Find which messages have conflicting values
                    conflicting_messages = []
                    value_to_messages = {}
                    
                    for msg_idx, msg in enumerate(sequence.messages):
                        # Check if this message contains the identifier
                        if identifier_name in msg.data:
                            value = msg.data[identifier_name]
                            value_str = str(value)
                            if value_str not in value_to_messages:
                                value_to_messages[value_str] = []
                            value_to_messages[value_str].append(msg_idx)
                    
                    # Find conflicting values (more than one group)
                    conflicting_values = [
                        (val, indices) for val, indices in value_to_messages.items()
                        if len(value_to_messages) > 1
                    ]
                    
                    for value, indices in conflicting_values:
                        results.append(ValidationResult(
                            type=ValidationType.ERROR,
                            message=f"Inconsistent '{identifier_name}': value '{value}' used in messages {indices}",
                            field=identifier_name,
                            code="IDENTIFIER_CONFLICT"
                        ))
        
        return results
    
    def _validate_sequence_rules(self, sequence: MscSequence) -> List[ValidationResult]:
        """Validate sequence-level business rules."""
        results = []
        
        # Rule 1: Messages should generally alternate between UE and gNB (RRC is point-to-point)
        ue_to_gnb_count = 0
        gnb_to_ue_count = 0
        
        for message in sequence.messages:
            if message.source_actor == 'UE' and message.target_actor == 'gNB':
                ue_to_gnb_count += 1
            elif message.source_actor == 'gNB' and message.target_actor == 'UE':
                gnb_to_ue_count += 1
        
        # In RRC, we expect roughly balanced communication
        total_messages = len(sequence.messages)
        if total_messages > 0:
            ue_ratio = ue_to_gnb_count / total_messages
            gnb_ratio = gnb_to_ue_count / total_messages
            
            if ue_ratio > 0.8 or gnb_ratio > 0.8:
                results.append(ValidationResult(
                    type=ValidationType.WARNING,
                    message="Sequence appears unbalanced - RRC communication should alternate between UE and gNB",
                    code="UNBALANCED_COMMUNICATION"
                ))
        
        # Rule 2: Check for duplicate consecutive messages of same type
        for i in range(1, len(sequence.messages)):
            if (sequence.messages[i].type_name == sequence.messages[i-1].type_name and
                sequence.messages[i].source_actor == sequence.messages[i-1].source_actor):
                
                results.append(ValidationResult(
                    type=ValidationType.WARNING,
                    message=f"Consecutive identical messages of type '{sequence.messages[i].type_name}' from same actor",
                    message_index=i,
                    code="DUPLICATE_CONSECUTIVE_MESSAGES"
                ))
        
        # Rule 3: Basic RRC flow validation
        rrc_start_messages = ['RRCConnectionRequest', 'RRCReestablishmentRequest']
        has_start_message = any(msg.type_name in rrc_start_messages for msg in sequence.messages)
        
        if not has_start_message and len(sequence.messages) > 0:
            results.append(ValidationResult(
                type=ValidationType.WARNING,
                message="RRC sequence should typically start with connection establishment (RRCConnectionRequest or similar)",
                code="MISSING_CONNECTION_START"
            ))
        
        return results
