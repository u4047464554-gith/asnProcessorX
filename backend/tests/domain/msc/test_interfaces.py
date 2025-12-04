import pytest
from unittest.mock import Mock
from backend.domain.msc.interfaces import (
    IIdentifierDetector, 
    IConfigurationTracker, 
    ISequenceValidator, 
    IStateMachine, 
    IMscRepository
)
from backend.domain.msc.entities import MscSequence, MscMessage, ValidationResult, TrackedIdentifier, ValidationType

class TestIIdentifierDetector:
    def test_abstract_cannot_instantiate(self):
        """Test that the abstract interface cannot be instantiated."""
        with pytest.raises(TypeError):
            detector = IIdentifierDetector()
    
    def test_detect_identifiers_contract(self):
        """Test the detect_identifiers method contract with a mock implementation."""
        # Create mock implementation
        mock_detector = Mock(spec=IIdentifierDetector)
        mock_detector.detect_identifiers.return_value = ["ue-Identity", "rrc-TransactionIdentifier"]
        
        # Test contract
        result = mock_detector.detect_identifiers("rrc_demo", "RRCConnectionRequest")
        assert isinstance(result, list)
        assert "ue-Identity" in result
        mock_detector.detect_identifiers.assert_called_once_with("rrc_demo", "RRCConnectionRequest")
    
    def test_is_identifier_field_contract(self):
        """Test the is_identifier_field method contract."""
        mock_detector = Mock(spec=IIdentifierDetector)
        mock_detector.is_identifier_field.return_value = True
        
        result = mock_detector.is_identifier_field("ue-Identity", "SEQUENCE")
        assert result is True
        mock_detector.is_identifier_field.assert_called_once_with("ue-Identity", "SEQUENCE")

class TestIConfigurationTracker:
    def test_abstract_cannot_instantiate(self):
        with pytest.raises(TypeError):
            tracker = IConfigurationTracker()
    
    def test_track_value_contract(self):
        """Test track_value method returns TrackedIdentifier."""
        mock_tracker = Mock(spec=IConfigurationTracker)
        mock_tracked = TrackedIdentifier(name="test", values={0: "value"})
        mock_tracker.track_value.return_value = mock_tracked
        
        result = mock_tracker.track_value("ue-Identity", 0, "UE123")
        assert isinstance(result, TrackedIdentifier)
        assert result.name == "test"
        mock_tracker.track_value.assert_called_once_with("ue-Identity", 0, "UE123")
    
    def test_get_suggestions_contract(self):
        """Test get_suggestions returns list of suggestion dicts."""
        mock_tracker = Mock(spec=IConfigurationTracker)
        mock_tracker.get_suggestions.return_value = [
            {"value": "UE123", "source_message_index": 0, "confidence": 1.0}
        ]
        
        result = mock_tracker.get_suggestions("ue-Identity", 1)
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["value"] == "UE123"
        mock_tracker.get_suggestions.assert_called_once_with("ue-Identity", 1)
    
    def test_detect_conflicts_contract(self):
        """Test detect_conflicts returns list of conflict strings."""
        mock_tracker = Mock(spec=IConfigurationTracker)
        mock_tracker.detect_conflicts.return_value = ["Multiple UE identities detected"]
        
        result = mock_tracker.detect_conflicts("ue-Identity")
        assert isinstance(result, list)
        assert "Multiple UE identities" in result[0]
        mock_tracker.detect_conflicts.assert_called_once_with("ue-Identity")

class TestISequenceValidator:
    def test_abstract_cannot_instantiate(self):
        with pytest.raises(TypeError):
            validator = ISequenceValidator()
    
    def test_validate_sequence_contract(self):
        """Test validate_sequence returns list of ValidationResult."""
        mock_validator = Mock(spec=ISequenceValidator)
        mock_sequence = MscSequence(protocol="test")
        mock_results = [
            ValidationResult(type=ValidationType.WARNING, message="Test warning")
        ]
        mock_validator.validate_sequence.return_value = mock_results
        
        result = mock_validator.validate_sequence(mock_sequence)
        assert isinstance(result, list)
        assert len(result) == 1
        assert isinstance(result[0], ValidationResult)
        mock_validator.validate_sequence.assert_called_once_with(mock_sequence)
    
    def test_validate_message_contract(self):
        """Test validate_message returns list of ValidationResult."""
        mock_validator = Mock(spec=ISequenceValidator)
        mock_message = MscMessage(type_name="Test", data={}, source_actor="UE", target_actor="gNB", timestamp=0)
        mock_context = {"current_state": "IDLE"}
        mock_results = []
        mock_validator.validate_message.return_value = mock_results
        
        result = mock_validator.validate_message(mock_message, mock_context)
        assert isinstance(result, list)
        assert len(result) == 0
        mock_validator.validate_message.assert_called_once_with(mock_message, mock_context)

class TestIStateMachine:
    def test_abstract_cannot_instantiate(self):
        with pytest.raises(TypeError):
            state_machine = IStateMachine()
    
    def test_get_current_state_contract(self):
        """Test get_current_state returns state string."""
        mock_sm = Mock(spec=IStateMachine)
        mock_sequence = MscSequence(protocol="rrc_demo")
        mock_sm.get_current_state.return_value = "IDLE"
        
        result = mock_sm.get_current_state(mock_sequence)
        assert isinstance(result, str)
        assert result == "IDLE"
        mock_sm.get_current_state.assert_called_once_with(mock_sequence)
    
    def test_is_valid_transition_contract(self):
        """Test is_valid_transition returns boolean."""
        mock_sm = Mock(spec=IStateMachine)
        mock_sm.is_valid_transition.return_value = True
        
        result = mock_sm.is_valid_transition("IDLE", "RRCConnectionRequest", {})
        assert isinstance(result, bool)
        assert result is True
        mock_sm.is_valid_transition.assert_called_once_with("IDLE", "RRCConnectionRequest", {})
    
    def test_get_next_state_contract(self):
        """Test get_next_state returns state string."""
        mock_sm = Mock(spec=IStateMachine)
        mock_sm.get_next_state.return_value = "CONNECTING"
        
        result = mock_sm.get_next_state("IDLE", "RRCConnectionRequest", {})
        assert isinstance(result, str)
        assert result == "CONNECTING"
        mock_sm.get_next_state.assert_called_once_with("IDLE", "RRCConnectionRequest", {})

class TestIMscRepository:
    def test_abstract_cannot_instantiate(self):
        with pytest.raises(TypeError):
            repo = IMscRepository()
    
    def test_create_sequence_contract(self):
        """Test create_sequence returns MscSequence."""
        mock_repo = Mock(spec=IMscRepository)
        mock_sequence = MscSequence(protocol="test")
        mock_repo.create_sequence.return_value = mock_sequence
        
        result = mock_repo.create_sequence(mock_sequence)
        assert isinstance(result, MscSequence)
        mock_repo.create_sequence.assert_called_once_with(mock_sequence)
    
    def test_get_sequence_contract(self):
        """Test get_sequence returns Optional[MscSequence]."""
        mock_repo = Mock(spec=IMscRepository)
        mock_sequence = MscSequence(protocol="test")
        mock_repo.get_sequence.return_value = mock_sequence
        
        result = mock_repo.get_sequence("seq1")
        assert isinstance(result, MscSequence)
        mock_repo.get_sequence.assert_called_once_with("seq1")
    
    def test_update_sequence_contract(self):
        """Test update_sequence returns MscSequence."""
        mock_repo = Mock(spec=IMscRepository)
        mock_sequence = MscSequence(protocol="test")
        mock_repo.update_sequence.return_value = mock_sequence
        
        result = mock_repo.update_sequence(mock_sequence)
        assert isinstance(result, MscSequence)
        mock_repo.update_sequence.assert_called_once_with(mock_sequence)
    
    def test_delete_sequence_contract(self):
        """Test delete_sequence returns boolean."""
        mock_repo = Mock(spec=IMscRepository)
        mock_repo.delete_sequence.return_value = True
        
        result = mock_repo.delete_sequence("seq1")
        assert isinstance(result, bool)
        assert result is True
        mock_repo.delete_sequence.assert_called_once_with("seq1")
    
    def test_list_sequences_contract(self):
        """Test list_sequences returns List[MscSequence]."""
        mock_repo = Mock(spec=IMscRepository)
        mock_sequence1 = MscSequence(protocol="test")
        mock_sequence2 = MscSequence(protocol="test")
        mock_repo.list_sequences.return_value = [mock_sequence1, mock_sequence2]
        
        result = mock_repo.list_sequences("rrc_demo")
        assert isinstance(result, list)
        assert len(result) == 2
        assert all(isinstance(s, MscSequence) for s in result)
        mock_repo.list_sequences.assert_called_once_with("rrc_demo")
    
    def test_list_sequences_no_protocol(self):
        """Test list_sequences without protocol filter."""
        mock_repo = Mock(spec=IMscRepository)
        mock_repo.list_sequences.return_value = []
        
        result = mock_repo.list_sequences()
        assert isinstance(result, list)
        # Check it was called (with or without None argument)
        assert mock_repo.list_sequences.called
