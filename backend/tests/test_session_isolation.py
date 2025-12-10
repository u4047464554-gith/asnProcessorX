"""
Test suite for session isolation and persistence.

This tests the critical requirement that:
1. Sequences created in Session A should NOT appear in Session B
2. Switching sessions should not lose data
3. Reopening a session should restore all previous work
"""
import os
import sys
import pytest
from datetime import datetime

sys.path.append(os.getcwd())


class TestSessionIsolation:
    """Test that sessions properly isolate data."""

    def test_sequences_are_isolated_by_session(self, client):
        """
        CRITICAL TEST: Sequences created in one session must NOT appear in another.
        
        Steps:
        1. Create Session A
        2. Create a sequence in Session A
        3. Create Session B  
        4. Verify sequence from Session A does NOT appear in Session B
        5. Create a sequence in Session B
        6. Verify Session B sequence does NOT appear in Session A
        """
        # Step 1: Create Session A
        response = client.post("/api/sessions", json={
            "name": "Test Session A",
            "description": "First test session"
        })
        assert response.status_code == 200, f"Failed to create session A: {response.text}"
        session_a = response.json()
        session_a_id = session_a["id"]
        
        # Step 2: Create a sequence IN Session A
        response = client.post("/api/msc/sequences", json={
            "name": "Sequence in A",
            "protocol": "rrc_demo",
            "session_id": session_a_id
        })
        assert response.status_code == 200, f"Failed to create sequence in A: {response.text}"
        sequence_a = response.json()
        sequence_a_id = sequence_a["id"]
        
        # Step 3: Create Session B
        response = client.post("/api/sessions", json={
            "name": "Test Session B",
            "description": "Second test session"
        })
        assert response.status_code == 200, f"Failed to create session B: {response.text}"
        session_b = response.json()
        session_b_id = session_b["id"]
        
        # Step 4: List sequences for Session B - should NOT include Session A's sequence
        response = client.get(f"/api/msc/sequences?session_id={session_b_id}")
        assert response.status_code == 200
        sequences_in_b = response.json()
        sequence_ids_in_b = [s["id"] for s in sequences_in_b]
        
        assert sequence_a_id not in sequence_ids_in_b, \
            f"ISOLATION FAILURE: Sequence from Session A ({sequence_a_id}) appeared in Session B. " \
            f"Session B sequences: {sequence_ids_in_b}"
        
        # Step 5: Create a sequence in Session B
        response = client.post("/api/msc/sequences", json={
            "name": "Sequence in B",
            "protocol": "rrc_demo", 
            "session_id": session_b_id
        })
        assert response.status_code == 200, f"Failed to create sequence in B: {response.text}"
        sequence_b = response.json()
        sequence_b_id = sequence_b["id"]
        
        # Step 6: List sequences for Session A - should NOT include Session B's sequence
        response = client.get(f"/api/msc/sequences?session_id={session_a_id}")
        assert response.status_code == 200
        sequences_in_a = response.json()
        sequence_ids_in_a = [s["id"] for s in sequences_in_a]
        
        assert sequence_a_id in sequence_ids_in_a, \
            f"Session A should still have its own sequence. Found: {sequence_ids_in_a}"
        assert sequence_b_id not in sequence_ids_in_a, \
            f"ISOLATION FAILURE: Sequence from Session B ({sequence_b_id}) appeared in Session A. " \
            f"Session A sequences: {sequence_ids_in_a}"
        
        # Cleanup
        client.delete(f"/api/sessions/{session_a_id}")
        client.delete(f"/api/sessions/{session_b_id}")
    
    def test_sequence_persists_after_session_switch(self, client):
        """
        Test that switching sessions and coming back preserves data.
        
        Steps:
        1. Create Session A
        2. Create sequence with messages in Session A
        3. "Switch" to Session B (create it)
        4. "Switch back" to Session A (query it again)
        5. Verify all messages are still there
        """
        # Create Session A
        response = client.post("/api/sessions", json={
            "name": "Persistence Test A",
            "description": ""
        })
        assert response.status_code == 200
        session_a_id = response.json()["id"]
        
        # Create sequence in Session A
        response = client.post("/api/msc/sequences", json={
            "name": "My Important Sequence",
            "protocol": "rrc_demo",
            "session_id": session_a_id
        })
        assert response.status_code == 200
        sequence_id = response.json()["id"]
        
        # Add a message to the sequence
        response = client.post(f"/api/msc/sequences/{sequence_id}/messages", json={
            "type_name": "RRCConnectionRequest",
            "data": {"test": "value"},
            "source_actor": "UE",
            "target_actor": "gNB"
        })
        assert response.status_code == 200, f"Failed to add message: {response.text}"
        
        # Verify message was added
        response = client.get(f"/api/msc/sequences/{sequence_id}")
        assert response.status_code == 200
        sequence_data = response.json()
        assert len(sequence_data["messages"]) == 1, "Message should be saved"
        original_message = sequence_data["messages"][0]
        
        # "Switch" to Session B
        response = client.post("/api/sessions", json={
            "name": "Persistence Test B",
            "description": ""
        })
        session_b_id = response.json()["id"]
        
        # "Switch back" to Session A and retrieve the sequence
        response = client.get(f"/api/msc/sequences/{sequence_id}")
        assert response.status_code == 200, "Sequence should still exist after session switch"
        sequence_after_switch = response.json()
        
        # Verify data integrity
        assert len(sequence_after_switch["messages"]) == 1, \
            f"Expected 1 message after switch, got {len(sequence_after_switch['messages'])}"
        assert sequence_after_switch["messages"][0]["typeName"] == original_message["typeName"], \
            "Message type should be preserved"
        
        # Cleanup
        client.delete(f"/api/sessions/{session_a_id}")
        client.delete(f"/api/sessions/{session_b_id}")
    
    def test_message_updates_persist_in_session(self, client):
        """
        Test that message edits are saved and persist.
        
        Steps:
        1. Create session and sequence
        2. Add a message
        3. Update the message data
        4. Reload the sequence
        5. Verify the update persisted
        """
        # Create session
        response = client.post("/api/sessions", json={
            "name": "Update Test Session",
            "description": ""
        })
        session_id = response.json()["id"]
        
        # Create sequence
        response = client.post("/api/msc/sequences", json={
            "name": "Editable Sequence",
            "protocol": "rrc_demo",
            "session_id": session_id
        })
        sequence_id = response.json()["id"]
        
        # Add initial message
        response = client.post(f"/api/msc/sequences/{sequence_id}/messages", json={
            "type_name": "RRCConnectionRequest",
            "data": {"initial": "value"},
            "source_actor": "UE",
            "target_actor": "gNB"
        })
        assert response.status_code == 200
        message_id = response.json()["messages"][0]["id"]
        
        # Update the message using the sequence update endpoint
        response = client.put(f"/api/msc/sequences/{sequence_id}", json={
            "update_message": {
                "id": message_id,
                "data": {"updated": "new_value", "extra": "field"}
            }
        })
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        # Reload the sequence (simulates page reload)
        response = client.get(f"/api/msc/sequences/{sequence_id}")
        assert response.status_code == 200
        reloaded = response.json()
        
        # Verify update persisted
        assert len(reloaded["messages"]) == 1
        updated_data = reloaded["messages"][0]["data"]
        assert "updated" in updated_data or "updated" in str(updated_data), \
            f"Update did not persist. Current data: {updated_data}"
        
        # Cleanup
        client.delete(f"/api/sessions/{session_id}")


class TestSchemaEditorIntegration:
    """Test that Schema Editor (Edit Schema) works correctly."""
    
    def test_list_schema_files(self, client):
        """Test that we can list schema files for a protocol."""
        response = client.get("/api/protocols/rrc_demo/files")
        assert response.status_code == 200, f"Failed to list files: {response.text}"
        files = response.json()
        assert isinstance(files, list), "Should return a list of files"
    
    def test_read_schema_file(self, client):
        """Test that we can read an existing schema file."""
        # First get list of files
        response = client.get("/api/protocols/rrc_demo/files")
        assert response.status_code == 200
        files = response.json()
        
        if len(files) > 0:
            first_file = files[0]
            response = client.get(f"/api/protocols/rrc_demo/files/{first_file}")
            assert response.status_code == 200, f"Failed to read file: {response.text}"
            data = response.json()
            assert "content" in data, "Response should include content"
    
    def test_get_protocol_definitions(self, client):
        """Test that we can get type definitions (for the exports panel)."""
        response = client.get("/api/protocols/rrc_demo/definitions")
        assert response.status_code == 200, f"Failed to get definitions: {response.text}"
        definitions = response.json()
        assert isinstance(definitions, dict), "Definitions should be a dict"
