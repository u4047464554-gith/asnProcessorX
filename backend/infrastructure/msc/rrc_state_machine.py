from typing import Dict, Any, List
from enum import Enum
from backend.domain.msc.interfaces import IStateMachine
from backend.domain.msc.entities import MscSequence, ValidationResult, ValidationType

class RRCState(Enum):
    """RRC Protocol States."""
    IDLE = "IDLE"
    CONNECTING = "CONNECTING"
    CONNECTED = "CONNECTED"
    RECONFIGURING = "RECONFIGURING"
    MEASURING = "MEASURING"
    RELEASING = "RELEASING"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"

class RRCStateMachine(IStateMachine):
    """RRC-specific state machine for message sequence validation."""
    
    def __init__(self):
        # RRC message to state transition mapping
        self._transitions = {
            # Connection Establishment
            'RRCConnectionRequest': {
                RRCState.IDLE: RRCState.CONNECTING,
                RRCState.SUSPENDED: RRCState.CONNECTING
            },
            'RRCConnectionReject': {
                RRCState.CONNECTING: RRCState.IDLE
            },
            'RRCConnectionSetup': {
                RRCState.CONNECTING: RRCState.CONNECTED
            },
            'RRCConnectionSetupComplete': {
                RRCState.CONNECTED: RRCState.CONNECTED
            },
            
            # Reconfiguration
            'RRCReconfiguration': {
                RRCState.CONNECTED: RRCState.RECONFIGURING
            },
            'RRCReconfigurationComplete': {
                RRCState.RECONFIGURING: RRCState.CONNECTED
            },
            
            # Measurement
            'RRCConnectionReconfiguration': {  # Can contain measurement config
                RRCState.CONNECTED: RRCState.MEASURING
            },
            'MeasurementReport': {
                RRCState.MEASURING: RRCState.CONNECTED,
                RRCState.CONNECTED: RRCState.CONNECTED
            },
            
            # Security
            'SecurityModeCommand': {
                RRCState.CONNECTED: RRCState.CONNECTED
            },
            'SecurityModeComplete': {
                RRCState.CONNECTED: RRCState.CONNECTED
            },
            'SecurityModeFailure': {
                RRCState.CONNECTED: RRCState.CONNECTED
            },
            
            # Capability Enquiry
            'UECapabilityEnquiry': {
                RRCState.CONNECTED: RRCState.CONNECTED
            },
            'UECapabilityInformation': {
                RRCState.CONNECTED: RRCState.CONNECTED
            },
            
            # Reestablishment
            'RRCReestablishmentRequest': {
                RRCState.CONNECTED: RRCState.CONNECTING,
                RRCState.INACTIVE: RRCState.CONNECTING
            },
            'RRCReestablishment': {
                RRCState.CONNECTING: RRCState.CONNECTED
            },
            'RRCReestablishmentComplete': {
                RRCState.CONNECTED: RRCState.CONNECTED
            },
            'RRCReestablishmentReject': {
                RRCState.CONNECTING: RRCState.IDLE
            },
            
            # Release
            'RRCConnectionRelease': {
                RRCState.CONNECTED: RRCState.INACTIVE,
                RRCState.RECONFIGURING: RRCState.INACTIVE
            },
            'RRCConnectionResumeRequest': {
                RRCState.INACTIVE: RRCState.CONNECTING,
                RRCState.SUSPENDED: RRCState.CONNECTING
            },
            'RRCConnectionResume': {
                RRCState.CONNECTING: RRCState.CONNECTED
            },
            'RRCConnectionResumeComplete': {
                RRCState.CONNECTED: RRCState.CONNECTED
            },
            
            # Other common messages
            'RRCConnectionReestablishmentComplete': {
                RRCState.CONNECTED: RRCState.CONNECTED
            },
            'CSFBParametersRequestR8': {  # Legacy
                RRCState.CONNECTED: RRCState.CONNECTED
            },
            'CSFBParametersResponseR8': {
                RRCState.CONNECTED: RRCState.CONNECTED
            },
        }
        
        # Actor-specific transitions (UE vs gNB messages)
        self._actor_transitions = {
            # UE-initiated messages
            'UE': {
                'RRCConnectionRequest': RRCState.IDLE,
                'RRCConnectionSetupComplete': RRCState.CONNECTED,
                'MeasurementReport': [RRCState.CONNECTED, RRCState.MEASURING],
                'RRCReestablishmentRequest': [RRCState.CONNECTED, RRCState.INACTIVE],
                'RRCReestablishmentComplete': RRCState.CONNECTED,
                'SecurityModeComplete': RRCState.CONNECTED,
                'SecurityModeFailure': RRCState.CONNECTED,
                'UECapabilityInformation': RRCState.CONNECTED,
                'RRCConnectionResumeRequest': [RRCState.INACTIVE, RRCState.SUSPENDED],
                'RRCConnectionResumeComplete': RRCState.CONNECTED,
            },
            
            # gNB-initiated messages
            'gNB': {
                'RRCConnectionSetup': RRCState.CONNECTING,
                'RRCConnectionReject': RRCState.CONNECTING,
                'RRCConnectionReconfiguration': RRCState.CONNECTED,
                'RRCReconfiguration': RRCState.CONNECTED,
                'SecurityModeCommand': RRCState.CONNECTED,
                'UECapabilityEnquiry': RRCState.CONNECTED,
                'RRCConnectionRelease': [RRCState.CONNECTED, RRCState.RECONFIGURING],
                'RRCConnectionResume': RRCState.CONNECTING,
                'RRCReestablishment': RRCState.CONNECTING,
                'RRCReestablishmentReject': RRCState.CONNECTING,
            }
        }
    
    def get_current_state(self, sequence: MscSequence) -> str:
        """
        Determine current RRC state based on sequence history.
        
        Args:
            sequence: MscSequence with message history
            
        Returns:
            Current RRC state as string
        """
        if not sequence.messages:
            return RRCState.IDLE.value
        
        # Analyze the sequence to determine current state
        # This is a simplified implementation - in reality would track state changes
        last_message = sequence.messages[-1]
        message_type = last_message.type_name
        
        # Simple heuristic based on last message type
        state_mapping = {
            # Connection establishment complete
            'RRCConnectionSetupComplete': RRCState.CONNECTED,
            'RRCReestablishmentComplete': RRCState.CONNECTED,
            'RRCConnectionResumeComplete': RRCState.CONNECTED,
            
            # Connection released
            'RRCConnectionRelease': RRCState.INACTIVE,
            
            # Reconfiguration in progress
            'RRCConnectionReconfiguration': RRCState.RECONFIGURING,
            'RRCReconfiguration': RRCState.RECONFIGURING,
            
            # Measurement reporting
            'MeasurementReport': RRCState.CONNECTED,
            
            # Initial state for connection requests
            'RRCConnectionRequest': RRCState.CONNECTING,
            'RRCReestablishmentRequest': RRCState.CONNECTING,
            'RRCConnectionResumeRequest': RRCState.CONNECTING,
            
            # Default to connected for most other messages
        }
        
        return state_mapping.get(message_type, RRCState.CONNECTED.value)
    
    def is_valid_transition(self, current_state: str, message_type: str, message_data: Dict[str, Any]) -> bool:
        """
        Check if a message type is valid from the current RRC state.
        
        Args:
            current_state: Current RRC state
            message_type: Type of message being sent
            message_data: Message data for additional context
            
        Returns:
            True if transition is valid, False otherwise
        """
        current_state_enum = RRCState(current_state)
        
        # Check general transition rules
        if message_type in self._transitions:
            if current_state_enum in self._transitions[message_type]:
                return True
        
        # Actor-specific validation (would need actor info)
        # For now, use general RRC rules
        
        # RRC-specific rules
        rrc_rules = self._get_rrc_transition_rules(current_state_enum, message_type)
        return rrc_rules['valid']
    
    def get_next_state(self, current_state: str, message_type: str, message_data: Dict[str, Any]) -> str:
        """
        Calculate next RRC state after processing a message.
        
        Args:
            current_state: Current RRC state
            message_type: Type of message processed
            message_data: Message data for additional context
            
        Returns:
            Next RRC state
        """
        current_state_enum = RRCState(current_state)
        
        # Check defined transitions
        if message_type in self._transitions and current_state_enum in self._transitions[message_type]:
            return self._transitions[message_type][current_state_enum].value
        
        # RRC-specific state transitions
        next_state_mapping = self._get_rrc_next_state(current_state_enum, message_type, message_data)
        return next_state_mapping
    
    def validate_sequence_transitions(self, sequence: MscSequence) -> List[ValidationResult]:
        """
        Validate all state transitions in an RRC sequence.
        
        Args:
            sequence: MscSequence to validate
            
        Returns:
            List of validation results for state transitions
        """
        results = []
        current_state = RRCState.IDLE
        
        for i, message in enumerate(sequence.messages):
            # Determine if this is a UE or gNB message based on actors
            
            # Check if message is valid from current state
            is_valid = self.is_valid_transition(
                current_state.value, 
                message.type_name, 
                message.data
            )
            
            if not is_valid:
                results.append(ValidationResult(
                    type=ValidationType.ERROR,
                    message=f"Invalid RRC state transition: {current_state.value} -> {message.type_name} at message {i}",
                    message_index=i,
                    code="INVALID_RRC_TRANSITION"
                ))
            
            # Update state
            current_state = RRCState(self.get_next_state(
                current_state.value, 
                message.type_name, 
                message.data
            ))
        
        return results
    
    def _get_rrc_transition_rules(self, current_state: RRCState, message_type: str) -> Dict[str, Any]:
        """Get detailed RRC transition rules for validation reporting."""
        rules = {
            'valid': False,
            'reason': 'Unknown transition',
            'expected_messages': [],
            'current_state': current_state.value
        }
        
        # IDLE state rules
        if current_state == RRCState.IDLE:
            if message_type in ['RRCConnectionRequest', 'RRCConnectionResumeRequest']:
                rules['valid'] = True
                rules['reason'] = 'Connection initiation from IDLE state'
                rules['expected_messages'] = ['RRCConnectionRequest', 'RRCConnectionResumeRequest']
            else:
                rules['reason'] = 'Only connection requests allowed from IDLE'
        
        # CONNECTING state rules
        elif current_state == RRCState.CONNECTING:
            if message_type in ['RRCConnectionSetup', 'RRCConnectionReject', 'RRCConnectionResume']:
                rules['valid'] = True
                rules['reason'] = 'Network response to connection request'
                rules['expected_messages'] = ['RRCConnectionSetup', 'RRCConnectionReject', 'RRCConnectionResume']
            elif message_type == 'RRCConnectionSetupComplete':
                rules['valid'] = True
                rules['reason'] = 'UE response to setup (if already partially connected)'
            else:
                rules['reason'] = 'Only network responses or completion messages allowed in CONNECTING'
        
        # CONNECTED state rules
        elif current_state == RRCState.CONNECTED:
            valid_connected_messages = [
                'RRCConnectionReconfiguration', 'RRCReconfiguration',
                'MeasurementReport', 'SecurityModeCommand', 'SecurityModeComplete',
                'UECapabilityEnquiry', 'UECapabilityInformation',
                'RRCConnectionReestablishmentRequest', 'RRCConnectionRelease'
            ]
            
            if message_type in valid_connected_messages:
                rules['valid'] = True
                rules['reason'] = 'Normal connected mode operations'
                rules['expected_messages'] = valid_connected_messages[:3]  # Show first few
            else:
                rules['reason'] = f'Unexpected message {message_type} in CONNECTED state'
        
        # RECONFIGURING state rules
        elif current_state == RRCState.RECONFIGURING:
            if message_type in ['RRCReconfigurationComplete', 'RRCConnectionReconfigurationComplete']:
                rules['valid'] = True
                rules['reason'] = 'Completion of reconfiguration'
                rules['expected_messages'] = ['RRCReconfigurationComplete']
            else:
                rules['reason'] = 'Only reconfiguration completion allowed'
        
        # MEASURING state rules
        elif current_state == RRCState.MEASURING:
            if message_type == 'MeasurementReport':
                rules['valid'] = True
                rules['reason'] = 'Measurement reporting'
            else:
                rules['reason'] = 'Only measurement reports allowed during measurement'
        
        # INACTIVE state rules
        elif current_state == RRCState.INACTIVE:
            if message_type in ['RRCConnectionResumeRequest', 'RRCConnectionRelease']:
                rules['valid'] = True
                rules['reason'] = 'Resume from inactive or release'
                rules['expected_messages'] = ['RRCConnectionResumeRequest']
            else:
                rules['reason'] = 'Only resume requests or releases from INACTIVE'
        
        # SUSPENDED state rules
        elif current_state == RRCState.SUSPENDED:
            if message_type == 'RRCConnectionResumeRequest':
                rules['valid'] = True
                rules['reason'] = 'Resume from suspended state'
            else:
                rules['reason'] = 'Only resume requests from SUSPENDED'
        
        # RELEASING state rules
        elif current_state == RRCState.RELEASING:
            if message_type in ['RRCConnectionRelease', 'RRCConnectionReleaseComplete']:
                rules['valid'] = True
                rules['reason'] = 'Connection release completion'
            else:
                rules['reason'] = 'Only release completion messages allowed'
        
        return rules
    
    def _get_rrc_next_state(self, current_state: RRCState, message_type: str, message_data: Dict[str, Any]) -> str:
        """Calculate next RRC state based on message type and data."""
        
        # Connection establishment
        if message_type == 'RRCConnectionRequest':
            return RRCState.CONNECTING.value
        elif message_type in ['RRCConnectionSetup', 'RRCConnectionResume']:
            return RRCState.CONNECTED.value
        elif message_type == 'RRCConnectionSetupComplete':
            return RRCState.CONNECTED.value
        elif message_type == 'RRCConnectionReject':
            return RRCState.IDLE.value
        
        # Reconfiguration
        elif message_type in ['RRCConnectionReconfiguration', 'RRCReconfiguration']:
            return RRCState.RECONFIGURING.value
        elif message_type in ['RRCReconfigurationComplete', 'RRCConnectionReconfigurationComplete']:
            return RRCState.CONNECTED.value
        
        # Measurement
        elif message_type == 'MeasurementReport':
            # Check if report triggers reconfiguration
            if message_data.get('reportTrigger', '').lower() in ['reconfiguration', 'handover']:
                return RRCState.RECONFIGURING.value
            return RRCState.CONNECTED.value
        
        # Security
        elif message_type in ['SecurityModeCommand', 'SecurityModeComplete', 'SecurityModeFailure']:
            return RRCState.CONNECTED.value
        
        # Capability
        elif message_type in ['UECapabilityEnquiry', 'UECapabilityInformation']:
            return RRCState.CONNECTED.value
        
        # Reestablishment
        elif message_type == 'RRCReestablishmentRequest':
            return RRCState.CONNECTING.value
        elif message_type == 'RRCReestablishment':
            return RRCState.CONNECTED.value
        elif message_type == 'RRCReestablishmentComplete':
            return RRCState.CONNECTED.value
        elif message_type == 'RRCReestablishmentReject':
            return RRCState.IDLE.value
        
        # Release
        elif message_type == 'RRCConnectionRelease':
            # Check if suspendConfig is present (RRC Inactive)
            if message_data.get('suspendConfig'):
                return RRCState.SUSPENDED.value
            else:
                return RRCState.INACTIVE.value
        
        elif message_type == 'RRCConnectionResumeRequest':
            return RRCState.CONNECTING.value
        elif message_type == 'RRCConnectionResume':
            return RRCState.CONNECTED.value
        elif message_type == 'RRCConnectionResumeComplete':
            return RRCState.CONNECTED.value
        
        # Default: stay in current state
        return current_state.value
    
    def get_possible_messages(self, current_state: RRCState) -> List[str]:
        """
        Get list of possible messages that can be sent from current state.
        
        Args:
            current_state: Current RRC state
            
        Returns:
            List of valid message types
        """
        possible_messages = []
        
        # Reverse lookup through transitions
        for message_type, state_transitions in self._transitions.items():
            if current_state in state_transitions:
                possible_messages.append(message_type)
        
        # Add state-specific messages
        if current_state == RRCState.CONNECTED:
            possible_messages.extend([
                'RRCConnectionReconfiguration',
                'MeasurementReport',
                'SecurityModeCommand',
                'UECapabilityEnquiry'
            ])
        elif current_state == RRCState.IDLE:
            possible_messages.extend(['RRCConnectionRequest'])
        elif current_state == RRCState.INACTIVE:
            possible_messages.extend(['RRCConnectionResumeRequest'])
        
        return list(set(possible_messages))  # Remove duplicates
    
    def get_state_description(self, state: RRCState) -> str:
        """Get human-readable description of RRC state."""
        descriptions = {
            RRCState.IDLE: "UE is not RRC connected",
            RRCState.CONNECTING: "RRC connection establishment in progress",
            RRCState.CONNECTED: "RRC connection active",
            RRCState.RECONFIGURING: "RRC connection reconfiguration in progress",
            RRCState.MEASURING: "UE performing measurements",
            RRCState.RELEASING: "RRC connection release in progress",
            RRCState.INACTIVE: "RRC Inactive state (suspended)",
            RRCState.SUSPENDED: "RRC connection suspended"
        }
        
        return descriptions.get(state, "Unknown state")

