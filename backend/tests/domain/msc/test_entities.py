from datetime import datetime
from backend.domain.msc.entities import (
    MscSequence, 
    MscMessage, 
    TrackedIdentifier, 
    ValidationResult, 
    ValidationType
)

class TestValidationResult:
    def test_validation_result_creation(self):
        result = ValidationResult(
            type=ValidationType.ERROR,
            message="Test error",
            field="ue-Identity",
            message_index=0,
            code="INCONSISTENT_ID"
        )
        assert result.type == ValidationType.ERROR
        assert result.message == "Test error"
        assert result.field == "ue-Identity"
        assert result.message_index == 0
        assert result.code == "INCONSISTENT_ID"
        assert result.is_error() is True
    
    def test_validation_result_warning(self):
        result = ValidationResult(
            type=ValidationType.WARNING,
            message="Test warning"
        )
        assert result.type == ValidationType.WARNING
        assert result.is_error() is False

class TestTrackedIdentifier:
    def test_tracked_identifier_creation(self):
        identifier = TrackedIdentifier(
            name="ue-Identity",
            values={0: "UE123"}
        )
        assert identifier.name == "ue-Identity"
        assert identifier.values == {0: "UE123"}
        assert identifier.is_consistent() is True
        assert identifier.conflicts == []
    
    def test_tracked_identifier_consistent_values(self):
        values = {0: "UE123", 1: "UE123", 2: "UE123"}
        identifier = TrackedIdentifier(name="ue-Identity", values=values)
        assert identifier.is_consistent() is True
    
    def test_tracked_identifier_inconsistent_values(self):
        # Create identifier with one value, then add conflicting value
        identifier = TrackedIdentifier(name="ue-Identity", values={0: "UE123"})
        identifier = identifier.add_value(1, "UE456")  # Add conflicting value
        assert identifier.is_consistent() is False
        assert len(identifier.conflicts) == 1
        assert "Multiple values for ue-Identity" in identifier.conflicts[0]
    
    def test_add_value_immutable(self):
        original = TrackedIdentifier(name="test", values={0: "value1"})
        updated = original.add_value(1, "value1")
        assert original.values == {0: "value1"}
        assert updated.values == {0: "value1", 1: "value1"}
        assert updated.is_consistent() is True
        assert original is not updated  # Immutable
    
    def test_add_conflicting_value(self):
        original = TrackedIdentifier(name="test", values={0: "value1"})
        updated = original.add_value(1, "value2")
        assert updated.is_consistent() is False
        assert len(updated.conflicts) == 1

class TestMscMessage:
    def test_msc_message_creation(self):
        message = MscMessage(
            id="msg1",
            type_name="RRCConnectionRequest",
            data={"ue-Identity": "UE123"},
            source_actor="UE",
            target_actor="gNB",
            timestamp=1234567890.0
        )
        assert message.id == "msg1"
        assert message.type_name == "RRCConnectionRequest"
        assert message.data == {"ue-Identity": "UE123"}
        assert message.source_actor == "UE"
        assert message.target_actor == "gNB"
        assert message.timestamp == 1234567890.0
        assert message.validation_errors == []
        assert message.is_valid() is True
    
    def test_msc_message_auto_id(self):
        message = MscMessage(
            type_name="TestMessage",
            data={},
            source_actor="UE",
            target_actor="gNB",
            timestamp=0
        )
        assert message.id is not None
        assert len(message.id) > 0
    
    def test_msc_message_with_errors(self):
        error = ValidationResult(type=ValidationType.ERROR, message="Invalid UE identity")
        message = MscMessage(
            id="msg1",
            type_name="Test",
            data={},
            source_actor="UE",
            target_actor="gNB",
            timestamp=0,
            validation_errors=[error]
        )
        assert not message.is_valid()
    
    def test_update_data_immutable(self):
        original = MscMessage(
            id="msg1",
            type_name="Test",
            data={"old": "value"},
            source_actor="UE",
            target_actor="gNB",
            timestamp=0
        )
        updated = original.update_data({"new": "value"})
        assert original.data == {"old": "value"}
        assert updated.data == {"new": "value"}
        assert original is not updated

class TestMscSequence:
    def test_msc_sequence_creation(self):
        sequence = MscSequence(
            id="seq1",
            name="Test Sequence",
            protocol="rrc_demo",
            messages=[],
            sub_sequences=[],
            tracked_identifiers={},
            validation_results=[]
        )
        assert sequence.id == "seq1"
        assert sequence.name == "Test Sequence"
        assert sequence.protocol == "rrc_demo"
        assert len(sequence.messages) == 0
        assert len(sequence.sub_sequences) == 0
        assert len(sequence.tracked_identifiers) == 0
        assert len(sequence.validation_results) == 0
        assert isinstance(sequence.created_at, datetime)
        assert isinstance(sequence.updated_at, datetime)
    
    def test_msc_sequence_auto_id_and_name(self):
        sequence = MscSequence(protocol="test")
        assert len(sequence.id) > 0
        assert sequence.name.startswith("Sequence ")
    
    def test_add_message(self):
        sequence = MscSequence(protocol="rrc_demo")
        message = MscMessage(
            type_name="RRCConnectionRequest",
            data={"ue-Identity": "UE123"},
            source_actor="UE",
            target_actor="gNB",
            timestamp=1234567890.0
        )
        sequence.add_message(message)
        
        assert len(sequence.messages) == 1
        assert sequence.messages[0].id == message.id
        assert "ue-Identity" in sequence.tracked_identifiers
        assert sequence.updated_at > sequence.created_at
    
    def test_remove_message(self):
        sequence = MscSequence(protocol="rrc_demo")
        message = MscMessage(
            type_name="Test",
            data={"id": "test"},
            source_actor="UE",
            target_actor="gNB",
            timestamp=0
        )
        sequence.add_message(message)
        
        removed = sequence.remove_message(message.id)
        assert removed is True
        assert len(sequence.messages) == 0
    
    def test_remove_nonexistent_message(self):
        sequence = MscSequence(protocol="rrc_demo")
        removed = sequence.remove_message("nonexistent")
        assert removed is False
    
    def test_validate_sequence(self):
        sequence = MscSequence(protocol="rrc_demo")
        
        # Add valid message
        valid_msg = MscMessage(
            type_name="RRCConnectionRequest",
            data={"ue-Identity": "UE123"},
            source_actor="UE",
            target_actor="gNB",
            timestamp=0
        )
        sequence.add_message(valid_msg)
        
        # Add message with validation error
        error_msg = MscMessage(
            type_name="InvalidMessage",
            data={},
            source_actor="UE",
            target_actor="gNB",
            timestamp=0,
            validation_errors=[ValidationResult(type=ValidationType.ERROR, message="Invalid")]
        )
        sequence.add_message(error_msg)
        
        results = sequence.validate()
        
        # Should have validation results from the error message
        assert len(results) >= 1
        assert any(r.type == ValidationType.ERROR for r in results)
        
        # Should have state transition warning
        assert any("State transition validation pending" in r.message for r in results)
    
    def test_get_suggestions(self):
        sequence = MscSequence(protocol="rrc_demo")
        
        # Add messages with tracked identifiers
        msg1 = MscMessage(
            type_name="RRCSetup",
            data={"rrc-TransactionIdentifier": 1},
            source_actor="gNB",
            target_actor="UE",
            timestamp=0
        )
        sequence.add_message(msg1)
        
        msg2 = MscMessage(
            type_name="RRCSetupComplete",
            data={"rrc-TransactionIdentifier": 1},  # Same value
            source_actor="UE",
            target_actor="gNB",
            timestamp=1
        )
        sequence.add_message(msg2)
        
        # For third message at index 2, should suggest value 1 for rrc-TransactionIdentifier
        suggestions = sequence.get_suggestions(2, "rrc-TransactionIdentifier")
        assert len(suggestions) > 0
        assert any(s['value'] == 1 for s in suggestions)
    
    def test_get_suggestions_no_previous_values(self):
        sequence = MscSequence(protocol="rrc_demo")
        suggestions = sequence.get_suggestions(0, "ue-Identity")
        assert len(suggestions) == 0
    
    def test_nested_sub_sequences(self):
        sequence = MscSequence(name="Parent", protocol="rrc_demo")
        sub_sequence = MscSequence(name="Child", protocol="rrc_demo")
        sequence.sub_sequences.append(sub_sequence)
        
        assert len(sequence.sub_sequences) == 1
        assert sequence.sub_sequences[0].name == "Child"
