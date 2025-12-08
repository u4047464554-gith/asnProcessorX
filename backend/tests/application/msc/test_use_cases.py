from unittest.mock import Mock, MagicMock

from backend.domain.msc.entities import MscSequence, MscMessage, ValidationResult, ValidationType
from backend.domain.msc.interfaces import (
    IMscRepository, IIdentifierDetector, IConfigurationTracker, 
    ISequenceValidator, IStateMachine
)
from backend.application.msc.use_cases import (
    CreateSequenceUseCase, UpdateSequenceUseCase, 
    ValidateSequenceUseCase, DetectIdentifiersUseCase, 
    GetConfigurationSuggestionsUseCase, MscUseCaseFactory
)

class TestCreateSequenceUseCase:
    def test_create_sequence_success(self):
        """Test successful sequence creation."""
        mock_repo = Mock(spec=IMscRepository)
        mock_sequence = MscSequence(
            id="test-id",
            name="Test Sequence",
            protocol="rrc_demo"
        )
        mock_repo.create_sequence.return_value = mock_sequence
        
        use_case = CreateSequenceUseCase(mock_repo)
        result = use_case.execute("Test Sequence", "rrc_demo")
        
        assert result == mock_sequence
        # Check that create_sequence was called (ignore exact datetime comparison)
        assert mock_repo.create_sequence.called
        call_args = mock_repo.create_sequence.call_args[0][0]
        assert call_args.name == "Test Sequence"
        assert call_args.protocol == "rrc_demo"
    
    def test_create_sequence_with_default_name(self):
        """Test sequence creation with default name generation."""
        mock_repo = Mock(spec=IMscRepository)
        mock_sequence = MagicMock()
        mock_repo.create_sequence.return_value = mock_sequence
        
        use_case = CreateSequenceUseCase(mock_repo)
        result = use_case.execute(None, "rrc_demo")
        
        assert result is mock_sequence
        mock_repo.create_sequence.assert_called_once()

class TestUpdateSequenceUseCase:
    def test_update_sequence_success(self):
        """Test successful sequence update."""
        mock_repo = Mock(spec=IMscRepository)
        existing_sequence = MscSequence(
            id="seq1",
            name="Old Name",
            protocol="rrc_demo"
        )
        updated_sequence = MscSequence(
            id="seq1",
            name="New Name",
            protocol="rrc_demo"
        )
        mock_repo.get_sequence.return_value = existing_sequence
        mock_repo.update_sequence.return_value = updated_sequence
        
        use_case = UpdateSequenceUseCase(mock_repo)
        updates = {'name': 'New Name'}
        result = use_case.execute("seq1", updates)
        
        assert result == updated_sequence
        mock_repo.get_sequence.assert_called_once_with("seq1")
        # Check that update_sequence was called (ignore exact datetime comparison)
        assert mock_repo.update_sequence.called
        call_args = mock_repo.update_sequence.call_args[0][0]
        assert call_args.id == "seq1"
        assert call_args.name == "New Name"
    
    def test_update_sequence_not_found(self):
        """Test update when sequence doesn't exist."""
        mock_repo = Mock(spec=IMscRepository)
        mock_repo.get_sequence.return_value = None
        
        use_case = UpdateSequenceUseCase(mock_repo)
        result = use_case.execute("nonexistent", {'name': 'New Name'})
        
        assert result is None
        mock_repo.get_sequence.assert_called_once_with("nonexistent")
        mock_repo.update_sequence.assert_not_called()
    
    def test_update_add_message(self):
        """Test adding a message during sequence update."""
        mock_repo = Mock(spec=IMscRepository)
        existing_sequence = MscSequence(id="seq1", protocol="rrc_demo")
        updated_sequence = MscSequence(id="seq1", protocol="rrc_demo", messages=[Mock()])
        mock_repo.get_sequence.return_value = existing_sequence
        mock_repo.update_sequence.return_value = updated_sequence
        
        use_case = UpdateSequenceUseCase(mock_repo)
        message_data = {
            'type_name': 'RRCConnectionRequest',
            'data': {'ue-Identity': 'UE123'},
            'source_actor': 'UE',
            'target_actor': 'gNB'
        }
        updates = {'add_message': message_data}
        result = use_case.execute("seq1", updates)
        
        assert result == updated_sequence
        mock_repo.update_sequence.assert_called_once()

class TestValidateSequenceUseCase:
    def test_validate_sequence_success(self):
        """Test successful sequence validation."""
        mock_validator = Mock(spec=ISequenceValidator)
        mock_state_machine = Mock(spec=IStateMachine)
        mock_sequence = MscSequence(id="seq1", protocol="rrc_demo")
        
        validation_results = [
            ValidationResult(type=ValidationType.WARNING, message="Test warning")
        ]
        mock_validator.validate_sequence.return_value = validation_results
        mock_state_machine.get_current_state.return_value = "IDLE"
        mock_state_machine.is_valid_transition.return_value = True
        mock_state_machine.get_next_state.return_value = "CONNECTING"
        
        use_case = ValidateSequenceUseCase(mock_validator, mock_state_machine)
        result = use_case.execute(mock_sequence)
        
        assert result == validation_results
        mock_validator.validate_sequence.assert_called_once_with(mock_sequence)
        mock_state_machine.get_current_state.assert_called_once_with(mock_sequence)
    
    def test_validate_sequence_with_invalid_transition(self):
        """Test validation with invalid state transition."""
        mock_validator = Mock(spec=ISequenceValidator)
        mock_state_machine = Mock(spec=IStateMachine)
        mock_sequence = MscSequence(
            id="seq1", 
            protocol="rrc_demo",
            messages=[
                MscMessage(
                    type_name="InvalidMessage",
                    data={},
                    source_actor="UE",
                    target_actor="gNB",
                    timestamp=0
                )
            ]
        )
        
        mock_validator.validate_sequence.return_value = []
        mock_state_machine.get_current_state.return_value = "IDLE"
        mock_state_machine.is_valid_transition.return_value = False
        
        use_case = ValidateSequenceUseCase(mock_validator, mock_state_machine)
        result = use_case.execute(mock_sequence)
        
        # Should include invalid transition error
        assert len(result) > 0
        assert any("Invalid state transition" in r.message for r in result)
        mock_state_machine.is_valid_transition.assert_called()

class TestDetectIdentifiersUseCase:
    def test_detect_identifiers_success(self):
        """Test successful identifier detection."""
        mock_detector = Mock(spec=IIdentifierDetector)
        expected_identifiers = ["ue-Identity", "rrc-TransactionIdentifier", "establishmentCause"]
        mock_detector.detect_identifiers.return_value = expected_identifiers
        
        use_case = DetectIdentifiersUseCase(mock_detector)
        result = use_case.execute("rrc_demo", "RRCConnectionRequest")
        
        assert result == expected_identifiers
        mock_detector.detect_identifiers.assert_called_once_with("rrc_demo", "RRCConnectionRequest")
    
    def test_detect_identifiers_empty(self):
        """Test when no identifiers are detected."""
        mock_detector = Mock(spec=IIdentifierDetector)
        mock_detector.detect_identifiers.return_value = []
        
        use_case = DetectIdentifiersUseCase(mock_detector)
        result = use_case.execute("test", "TestType")
        
        assert result == []
        mock_detector.detect_identifiers.assert_called_once_with("test", "TestType")

class TestGetConfigurationSuggestionsUseCase:
    def test_get_suggestions_for_tracked_identifier(self):
        """Test getting suggestions for a tracked identifier field."""
        mock_tracker = Mock(spec=IConfigurationTracker)
        mock_detector = Mock(spec=IIdentifierDetector)
        mock_sequence = Mock()
        
        expected_suggestions = [
            {"value": "UE123", "source_message_index": 0, "confidence": 1.0},
            {"value": "UE456", "source_message_index": 1, "confidence": 0.8}
        ]
        mock_tracker.get_suggestions.return_value = expected_suggestions
        mock_detector.detect_identifiers.return_value = ["ue-Identity", "rrc-TransactionIdentifier"]
        
        use_case = GetConfigurationSuggestionsUseCase(mock_tracker, mock_detector)
        result = use_case.execute(
            mock_sequence, 2, "ue-Identity", "rrc_demo", "RRCConnectionRequest"
        )
        
        assert result == expected_suggestions
        mock_detector.detect_identifiers.assert_called_once_with("rrc_demo", "RRCConnectionRequest")
        mock_tracker.get_suggestions.assert_called_once_with("ue-Identity", 2)
    
    def test_get_suggestions_for_non_tracked_field(self):
        """Test getting suggestions for a non-tracked field."""
        mock_tracker = Mock(spec=IConfigurationTracker)
        mock_detector = Mock(spec=IIdentifierDetector)
        mock_sequence = Mock()
        
        mock_detector.detect_identifiers.return_value = ["ue-Identity"]  # Not including testField
        
        use_case = GetConfigurationSuggestionsUseCase(mock_tracker, mock_detector)
        result = use_case.execute(
            mock_sequence, 1, "testField", "rrc_demo", "RRCConnectionRequest"
        )
        
        assert result == []  # No suggestions for non-tracked field
        mock_detector.detect_identifiers.assert_called_once_with("rrc_demo", "RRCConnectionRequest")
        mock_tracker.get_suggestions.assert_not_called()
    
    def test_get_suggestions_no_sequence(self):
        """Test when sequence is None (should handle gracefully)."""
        mock_tracker = Mock(spec=IConfigurationTracker)
        mock_detector = Mock(spec=IIdentifierDetector)
        mock_detector.detect_identifiers.return_value = []  # Return empty list
        
        use_case = GetConfigurationSuggestionsUseCase(mock_tracker, mock_detector)
        # Note: In real implementation, this would check if sequence exists
        # For test, we expect empty suggestions
        result = use_case.execute(
            None, 0, "ue-Identity", "rrc_demo", "TestType"
        )
        
        assert result == []

class TestMscUseCaseFactory:
    def test_factory_creates_use_cases(self):
        """Test that factory creates all use case instances."""
        mock_repo = Mock(spec=IMscRepository)
        mock_detector = Mock(spec=IIdentifierDetector)
        mock_tracker = Mock(spec=IConfigurationTracker)
        mock_validator = Mock(spec=ISequenceValidator)
        mock_state_machine = Mock(spec=IStateMachine)
        
        factory = MscUseCaseFactory(
            repository=mock_repo,
            detector=mock_detector,
            tracker=mock_tracker,
            validator=mock_validator,
            state_machine=mock_state_machine
        )
        
        # Test each factory method
        create_uc = factory.create_sequence()
        assert isinstance(create_uc, CreateSequenceUseCase)
        assert create_uc.repository == mock_repo
        
        update_uc = factory.update_sequence()
        assert isinstance(update_uc, UpdateSequenceUseCase)
        assert update_uc.repository == mock_repo
        
        validate_uc = factory.validate_sequence()
        assert isinstance(validate_uc, ValidateSequenceUseCase)
        assert validate_uc.validator == mock_validator
        assert validate_uc.state_machine == mock_state_machine
        
        detect_uc = factory.detect_identifiers()
        assert isinstance(detect_uc, DetectIdentifiersUseCase)
        assert detect_uc.detector == mock_detector
        
        suggestions_uc = factory.get_configuration_suggestions()
        assert isinstance(suggestions_uc, GetConfigurationSuggestionsUseCase)
        assert suggestions_uc.tracker == mock_tracker
        assert suggestions_uc.detector == mock_detector
