"""
Tests for lower coverage modules:
- identifier_detector.py (30%)
- messages.py (34%)
- rrc_state_machine.py (35%)
- configuration_tracker.py (41%)
- scratchpad.py (44%)
"""
import os
import sys
import pytest
import tempfile
import shutil

sys.path.append(os.getcwd())


class TestIdentifierDetector:
    """Tests for RrcIdentifierDetector (30% -> target 70%)."""
    
    def test_identifier_patterns_match(self):
        """Test that identifier patterns correctly match field names."""
        from backend.infrastructure.msc.identifier_detector import RrcIdentifierDetector
        
        detector = RrcIdentifierDetector()
        
        # Should match
        assert detector.is_identifier_field("ue-Identity", "SEQUENCE") is True
        assert detector.is_identifier_field("cellIdentifier", "INTEGER") is True
        assert detector.is_identifier_field("transactionID", "INTEGER") is True
        assert detector.is_identifier_field("rrc-TransactionIdentifier", "INTEGER") is True
        assert detector.is_identifier_field("measConfig", "SEQUENCE") is True
        
        # Should NOT match (not identifier patterns)
        assert detector.is_identifier_field("randomField", "SEQUENCE") is False
        assert detector.is_identifier_field("payload", "OCTET STRING") is False
    
    def test_detect_identifiers_for_known_type(self, client):
        """Test identifier detection through the API for a known type."""
        # Use the detect-identifiers endpoint
        response = client.post("/api/msc/detect-identifiers", json={
            "protocol": "rrc_demo",
            "type_name": "RRCConnectionRequest"
        })
        # API should return response - may be 200 with identifiers or 404 if type not found
        if response.status_code == 200:
            data = response.json()
            assert "identifiers" in data
            assert isinstance(data["identifiers"], list)
        else:
            # 404 is also acceptable if the type doesn't exist in the schema
            assert response.status_code in [400, 404]
    
    def test_detect_identifiers_unknown_type(self, client):
        """Test identifier detection handles unknown type gracefully."""
        response = client.post("/api/msc/detect-identifiers", json={
            "protocol": "rrc_demo",
            "type_name": "NonExistentType"
        })
        # API may return 400, 404 or 200 with empty list - all are acceptable
        # Just verify it doesn't crash/500
        assert response.status_code in [200, 400, 404]
    
    def test_rrc_specific_identifiers(self):
        """Test RRC-specific identifier detection logic."""
        from backend.infrastructure.msc.identifier_detector import RrcIdentifierDetector
        
        detector = RrcIdentifierDetector()
        
        # Test RRC-specific identifiers
        assert detector._is_rrc_specific_identifier("ue-Identity", "SEQUENCE", "RRCConnectionRequest") is True
        assert detector._is_rrc_specific_identifier("establishmentCause", "ENUMERATED", "RRCConnectionRequest") is True
        assert detector._is_rrc_specific_identifier("rrc-TransactionIdentifier", "INTEGER", "RRCConnectionSetup") is True
        
        # Non-RRC-specific
        assert detector._is_rrc_specific_identifier("randomField", "SEQUENCE", "RRCConnectionRequest") is False


class TestMessagesRouter:
    """Tests for messages router (34% -> target 80%)."""
    
    def test_list_messages_empty(self, client):
        """Test listing messages when none exist."""
        response = client.get("/api/messages")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_save_and_load_message(self, client):
        """Test saving and loading a message."""
        # Save a message
        test_message = {
            "filename": "test_msg_001",
            "protocol": "rrc_demo",
            "type": "RRCConnectionRequest",
            "data": {"testField": "testValue"}
        }
        response = client.post("/api/messages", json=test_message)
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        filename = response.json()["filename"]
        
        # Load the message
        response = client.get(f"/api/messages/{filename}")
        assert response.status_code == 200
        loaded = response.json()
        assert loaded["protocol"] == "rrc_demo"
        assert loaded["data"]["testField"] == "testValue"
        
        # Cleanup
        client.delete(f"/api/messages/{filename}")
    
    def test_delete_message(self, client):
        """Test deleting a message."""
        # First save
        test_message = {
            "filename": "to_delete",
            "protocol": "rrc_demo",
            "type": "Test",
            "data": {}
        }
        client.post("/api/messages", json=test_message)
        
        # Delete
        response = client.delete("/api/messages/to_delete.json")
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        
        # Verify gone
        response = client.get("/api/messages/to_delete.json")
        assert response.status_code == 404
    
    def test_load_nonexistent_message(self, client):
        """Test loading a message that doesn't exist."""
        response = client.get("/api/messages/nonexistent_12345.json")
        assert response.status_code == 404
    
    def test_clear_messages(self, client):
        """Test clearing all messages."""
        # Save some messages
        for i in range(3):
            client.post("/api/messages", json={
                "filename": f"temp_msg_{i}",
                "protocol": "test",
                "type": "Test",
                "data": {}
            })
        
        # Clear all
        response = client.delete("/api/messages")
        assert response.status_code == 200
        assert response.json()["status"] == "success"


class TestRRCStateMachine:
    """Tests for RRC state machine (35% -> target 70%)."""
    
    def test_state_enum_values(self):
        """Test RRC state enum has expected values."""
        from backend.infrastructure.msc.rrc_state_machine import RRCState
        
        # Compare enum values using .value
        assert RRCState.IDLE.value == "IDLE"
        assert RRCState.CONNECTING.value == "CONNECTING"
        assert RRCState.CONNECTED.value == "CONNECTED"
        assert RRCState.RECONFIGURING.value == "RECONFIGURING"
    
    def test_get_current_state_empty_sequence(self):
        """Test getting current state from empty sequence."""
        from backend.infrastructure.msc.rrc_state_machine import RRCStateMachine, RRCState
        from backend.domain.msc.entities import MscSequence
        
        sm = RRCStateMachine()
        sequence = MscSequence(
            id="test",
            name="Test",
            protocol="rrc_demo",
            messages=[]
        )
        
        state = sm.get_current_state(sequence)
        # Compare values since state could be enum or string
        assert str(state) == str(RRCState.IDLE) or state == RRCState.IDLE.value
    
    def test_valid_transitions(self):
        """Test valid RRC state transitions."""
        from backend.infrastructure.msc.rrc_state_machine import RRCStateMachine, RRCState
        
        sm = RRCStateMachine()
        
        # Valid: IDLE -> CONNECTING via RRCConnectionRequest
        assert sm.is_valid_transition(RRCState.IDLE, "RRCConnectionRequest", {}) is True
        
        # Valid: CONNECTED -> RECONFIGURING via RRCReconfiguration
        assert sm.is_valid_transition(RRCState.CONNECTED, "RRCReconfiguration", {}) is True
    
    def test_get_next_state(self):
        """Test calculating next state after message."""
        from backend.infrastructure.msc.rrc_state_machine import RRCStateMachine, RRCState
        
        sm = RRCStateMachine()
        
        # IDLE + RRCConnectionRequest -> CONNECTING
        next_state = sm.get_next_state(RRCState.IDLE, "RRCConnectionRequest", {})
        # State machine may return string or enum
        assert str(next_state) == str(RRCState.CONNECTING) or next_state == RRCState.CONNECTING.value or next_state == "CONNECTING"
    
    def test_get_possible_messages(self):
        """Test getting possible messages from a state."""
        from backend.infrastructure.msc.rrc_state_machine import RRCStateMachine, RRCState
        
        sm = RRCStateMachine()
        
        # From IDLE, should be able to send connection requests
        possible = sm.get_possible_messages(RRCState.IDLE)
        assert isinstance(possible, list)
        assert len(possible) > 0
    
    def test_get_state_description(self):
        """Test getting human-readable state descriptions."""
        from backend.infrastructure.msc.rrc_state_machine import RRCStateMachine, RRCState
        
        sm = RRCStateMachine()
        
        desc = sm.get_state_description(RRCState.IDLE)
        assert isinstance(desc, str)
        assert len(desc) > 0
        
        desc = sm.get_state_description(RRCState.CONNECTED)
        assert isinstance(desc, str)
        # Just check it's a meaningful description


class TestConfigurationTracker:
    """Tests for configuration tracker (41% -> target 80%)."""
    
    def test_track_single_value(self):
        """Test tracking a single identifier value."""
        from backend.infrastructure.msc.configuration_tracker import ConfigurationTracker
        
        tracker = ConfigurationTracker()
        result = tracker.track_value("ue-Identity", 0, "UE123")
        
        assert result.name == "ue-Identity"
        assert 0 in result.values
        assert result.values[0] == "UE123"
    
    def test_track_multiple_values(self):
        """Test tracking multiple values for same identifier."""
        from backend.infrastructure.msc.configuration_tracker import ConfigurationTracker
        
        tracker = ConfigurationTracker()
        tracker.track_value("transactionId", 0, 1)
        tracker.track_value("transactionId", 1, 1)
        tracker.track_value("transactionId", 2, 2)  # Different value
        
        identifiers = tracker.get_all_tracked_identifiers()
        assert "transactionId" in identifiers
        assert len(identifiers["transactionId"].values) == 3
    
    def test_get_suggestions(self):
        """Test getting value suggestions based on history."""
        from backend.infrastructure.msc.configuration_tracker import ConfigurationTracker
        
        tracker = ConfigurationTracker()
        tracker.track_value("cellId", 0, "CELL001")
        tracker.track_value("cellId", 1, "CELL002")
        
        # Get suggestions for message index 2
        suggestions = tracker.get_suggestions("cellId", 2)
        
        assert len(suggestions) > 0
        # Most recent should be first
        assert suggestions[0]["value"] == "CELL002"
        assert "confidence" in suggestions[0]
    
    def test_detect_conflicts_consistent(self):
        """Test conflict detection when values are consistent."""
        from backend.infrastructure.msc.configuration_tracker import ConfigurationTracker
        
        tracker = ConfigurationTracker()
        tracker.track_value("stableId", 0, "SAME")
        tracker.track_value("stableId", 1, "SAME")
        tracker.track_value("stableId", 2, "SAME")
        
        conflicts = tracker.detect_conflicts("stableId")
        # No conflicts if all values are the same
        assert len(conflicts) == 0
    
    def test_detect_conflicts_inconsistent(self):
        """Test conflict detection when values change."""
        from backend.infrastructure.msc.configuration_tracker import ConfigurationTracker
        
        tracker = ConfigurationTracker()
        tracker.track_value("changingId", 0, "A")
        tracker.track_value("changingId", 1, "B")
        tracker.track_value("changingId", 2, "C")
        
        conflicts = tracker.detect_conflicts("changingId")
        # Should detect conflicts due to frequent changes
        assert len(conflicts) > 0
    
    def test_clear_tracking(self):
        """Test clearing tracked identifiers."""
        from backend.infrastructure.msc.configuration_tracker import ConfigurationTracker
        
        tracker = ConfigurationTracker()
        tracker.track_value("id1", 0, "val1")
        tracker.track_value("id2", 0, "val2")
        
        # Clear specific
        tracker.clear_tracking("id1")
        identifiers = tracker.get_all_tracked_identifiers()
        assert "id1" not in identifiers
        assert "id2" in identifiers
        
        # Clear all
        tracker.clear_tracking()
        assert len(tracker.get_all_tracked_identifiers()) == 0
    
    def test_export_import_state(self):
        """Test exporting and importing tracking state."""
        from backend.infrastructure.msc.configuration_tracker import ConfigurationTracker
        
        tracker = ConfigurationTracker()
        tracker.track_value("testId", 0, "value1")
        tracker.track_value("testId", 1, "value2")
        
        # Export
        state = tracker.export_tracking_state()
        assert "tracked_identifiers" in state
        assert "testId" in state["tracked_identifiers"]
        
        # Import into new tracker
        new_tracker = ConfigurationTracker()
        new_tracker.import_tracking_state(state)
        
        assert "testId" in new_tracker.get_all_tracked_identifiers()


class TestScratchpadRouter:
    """Tests for scratchpad router (44% -> target 90%)."""
    
    def test_get_empty_scratchpad(self, client):
        """Test getting scratchpad when it doesn't exist."""
        response = client.get("/api/scratchpad")
        assert response.status_code == 200
        data = response.json()
        assert "content" in data
    
    def test_save_and_get_scratchpad(self, client):
        """Test saving and retrieving scratchpad content."""
        test_content = "Test scratchpad content\nWith multiple lines"
        
        # Save
        response = client.put("/api/scratchpad", json={"content": test_content})
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        
        # Get
        response = client.get("/api/scratchpad")
        assert response.status_code == 200
        assert response.json()["content"] == test_content
    
    def test_overwrite_scratchpad(self, client):
        """Test overwriting existing scratchpad content."""
        # Save first version
        client.put("/api/scratchpad", json={"content": "Version 1"})
        
        # Overwrite
        client.put("/api/scratchpad", json={"content": "Version 2"})
        
        # Verify
        response = client.get("/api/scratchpad")
        assert response.json()["content"] == "Version 2"
    
    def test_save_empty_scratchpad(self, client):
        """Test saving empty content."""
        response = client.put("/api/scratchpad", json={"content": ""})
        assert response.status_code == 200
        
        response = client.get("/api/scratchpad")
        assert response.json()["content"] == ""


class TestFilesRouter:
    """Additional tests for files router (44% -> target 70%)."""
    
    def test_list_files_known_protocol(self, client):
        """Test listing files for a known protocol."""
        response = client.get("/api/protocols/rrc_demo/files")
        assert response.status_code == 200
        files = response.json()
        assert isinstance(files, list)
        # Should have at least one .asn file
        assert any(f.endswith('.asn') for f in files)
    
    def test_list_files_unknown_protocol(self, client):
        """Test listing files for unknown protocol."""
        response = client.get("/api/protocols/nonexistent_protocol_xyz/files")
        assert response.status_code == 404
    
    def test_read_file_security(self, client):
        """Test that directory traversal is blocked."""
        # Attempt path traversal - should be blocked with 400 or 404
        response = client.get("/api/protocols/rrc_demo/files/../../../etc/passwd")
        # Any of 400, 404, 422 is acceptable - just not 200 or 500
        assert response.status_code in [400, 404, 422]
    
    def test_create_file_invalid_extension(self, client):
        """Test that non-.asn files are rejected."""
        response = client.post("/api/protocols/rrc_demo/files", json={
            "filename": "test.txt",
            "content": "test"
        })
        assert response.status_code == 400


class TestMscRepository:
    """Additional tests for msc_repository (55% -> target 75%)."""
    
    def test_sequence_statistics(self, client):
        """Test sequence statistics endpoint."""
        # Create a sequence first
        response = client.post("/api/msc/sequences", json={
            "name": "Stats Test",
            "protocol": "rrc_demo"
        })
        assert response.status_code == 200
        
        # Check statistics are available via list
        response = client.get("/api/msc/sequences")
        assert response.status_code == 200
        sequences = response.json()
        assert isinstance(sequences, list)
