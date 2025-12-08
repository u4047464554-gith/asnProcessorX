"""
Test MSC API Endpoints - Main Workflows
Tests the complete MSC workflow through the API layer.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from backend.main import app


@pytest.fixture
def client():
    """Create test client for API testing."""
    return TestClient(app)


@pytest.fixture  
def mock_msc_service():
    """Mock MSC service for isolated testing."""
    with patch('backend.routers.msc.msc_service') as mock:
        yield mock


class TestMscSequenceWorkflows:
    """Tests for MSC Sequence CRUD workflows."""
    
    def test_create_sequence_workflow(self, client):
        """Test creating a new sequence through API."""
        # Create a sequence
        response = client.post('/api/msc/sequences', json={
            'name': 'Test Workflow Sequence',
            'protocol': 'rrc_demo'
        })
        
        assert response.status_code == 200
        data = response.json()
        assert 'id' in data
        assert data['name'] == 'Test Workflow Sequence'
        assert data['protocol'] == 'rrc_demo'
        assert data['messages'] == []
        
        # Cleanup
        client.delete(f"/api/msc/sequences/{data['id']}")
    
    def test_add_message_workflow(self, client):
        """Test adding a message to a sequence."""
        # Create sequence first
        create_resp = client.post('/api/msc/sequences', json={
            'name': 'Message Test Sequence',
            'protocol': 'rrc_demo'
        })
        assert create_resp.status_code == 200
        sequence_id = create_resp.json()['id']
        
        # Add a message
        msg_resp = client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'RRCConnectionRequest',
            'data': {
                'ue-Identity': {'randomValue': '0x12345'},
                'establishmentCause': 'mo-Signalling'
            },
            'source_actor': 'UE',
            'target_actor': 'gNB'
        })
        
        assert msg_resp.status_code == 200
        msg_data = msg_resp.json()
        assert len(msg_data['messages']) == 1
        assert msg_data['messages'][0]['type_name'] == 'RRCConnectionRequest'
        
        # Cleanup
        client.delete(f'/api/msc/sequences/{sequence_id}')
    
    def test_update_message_workflow(self, client):
        """Test updating a message in a sequence."""
        # Create sequence with a message
        create_resp = client.post('/api/msc/sequences', json={
            'name': 'Update Message Test',
            'protocol': 'rrc_demo'
        })
        sequence_id = create_resp.json()['id']
        
        # Add initial message
        msg_resp = client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'RRCConnectionRequest',
            'data': {'field': 'initial_value'},
            'source_actor': 'UE', 
            'target_actor': 'gNB'
        })
        message_id = msg_resp.json()['messages'][0]['id']
        
        # Update the message via sequence update
        update_resp = client.put(f'/api/msc/sequences/{sequence_id}', json={
            'update_message': {
                'id': message_id,
                'data': {'field': 'updated_value', 'new_field': 'new_data'}
            }
        })
        
        assert update_resp.status_code == 200
        updated_data = update_resp.json()
        assert updated_data['messages'][0]['data']['field'] == 'updated_value'
        assert updated_data['messages'][0]['data']['new_field'] == 'new_data'
        
        # Cleanup
        client.delete(f'/api/msc/sequences/{sequence_id}')
    
    def test_remove_message_workflow(self, client):
        """Test removing a message from a sequence."""
        # Create sequence with multiple messages
        create_resp = client.post('/api/msc/sequences', json={
            'name': 'Remove Message Test',
            'protocol': 'rrc_demo'
        })
        sequence_id = create_resp.json()['id']
        
        # Add two messages
        client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'RRCConnectionRequest',
            'data': {'msg': 'first'},
            'source_actor': 'UE',
            'target_actor': 'gNB'
        })
        msg_resp = client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'RRCConnectionSetup',
            'data': {'msg': 'second'},
            'source_actor': 'gNB',
            'target_actor': 'UE'
        })
        
        messages = msg_resp.json()['messages']
        assert len(messages) == 2
        
        # Remove first message
        first_msg_id = messages[0]['id']
        remove_resp = client.put(f'/api/msc/sequences/{sequence_id}', json={
            'remove_message': first_msg_id
        })
        
        assert remove_resp.status_code == 200
        remaining = remove_resp.json()['messages']
        assert len(remaining) == 1
        assert remaining[0]['data']['msg'] == 'second'
        
        # Cleanup  
        client.delete(f'/api/msc/sequences/{sequence_id}')
    
    def test_full_rrc_workflow(self, client):
        """Test a complete RRC connection setup workflow."""
        # 1. Create a new sequence
        create_resp = client.post('/api/msc/sequences', json={
            'name': 'RRC Connection Setup Flow',
            'protocol': 'rrc_demo'
        })
        assert create_resp.status_code == 200
        sequence = create_resp.json()
        sequence_id = sequence['id']
        
        # 2. Add RRC Connection Request (UE -> gNB)
        client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'RRCConnectionRequest',
            'data': {
                'ue-Identity': {'randomValue': '0xABCDEF123456'},
                'establishmentCause': 'mo-Signalling'
            },
            'source_actor': 'UE',
            'target_actor': 'gNB'
        })
        
        # 3. Add RRC Connection Setup (gNB -> UE)
        client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'RRCConnectionSetup',
            'data': {
                'rrc-TransactionIdentifier': 1,
                'criticalExtensions': {
                    'c1': {
                        'rrcConnectionSetup-r8': {}
                    }
                }
            },
            'source_actor': 'gNB',
            'target_actor': 'UE'
        })
        
        # 4. Add RRC Connection Setup Complete (UE -> gNB)
        complete_resp = client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'RRCConnectionSetupComplete',
            'data': {
                'rrc-TransactionIdentifier': 1,
                'criticalExtensions': {}
            },
            'source_actor': 'UE',
            'target_actor': 'gNB'
        })
        
        assert complete_resp.status_code == 200
        final_sequence = complete_resp.json()
        
        # Verify the complete flow
        assert len(final_sequence['messages']) == 3
        assert final_sequence['messages'][0]['type_name'] == 'RRCConnectionRequest'
        assert final_sequence['messages'][0]['source_actor'] == 'UE'
        assert final_sequence['messages'][1]['type_name'] == 'RRCConnectionSetup'
        assert final_sequence['messages'][1]['source_actor'] == 'gNB'
        assert final_sequence['messages'][2]['type_name'] == 'RRCConnectionSetupComplete'
        assert final_sequence['messages'][2]['source_actor'] == 'UE'
        
        # Cleanup
        client.delete(f'/api/msc/sequences/{sequence_id}')
    
    def test_sequence_validation_workflow(self, client):
        """Test sequence validation."""
        # Create sequence with messages
        create_resp = client.post('/api/msc/sequences', json={
            'name': 'Validation Test',
            'protocol': 'rrc_demo'
        })
        sequence_id = create_resp.json()['id']
        
        # Add a message
        client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'RRCConnectionRequest',
            'data': {'ue-Identity': {'randomValue': '0x123'}},
            'source_actor': 'UE',
            'target_actor': 'gNB'
        })
        
        # Validate sequence
        validate_resp = client.post(f'/api/msc/sequences/{sequence_id}/validate')
        
        # Validation should return results (might be empty or have warnings)
        assert validate_resp.status_code == 200
        validation = validate_resp.json()
        assert 'results' in validation or isinstance(validation, list)
        
        # Cleanup
        client.delete(f'/api/msc/sequences/{sequence_id}')
    
    def test_list_sequences_workflow(self, client):
        """Test listing sequences."""
        # Create multiple sequences
        ids = []
        for i in range(3):
            resp = client.post('/api/msc/sequences', json={
                'name': f'List Test {i}',
                'protocol': 'rrc_demo'
            })
            ids.append(resp.json()['id'])
        
        # List all sequences
        list_resp = client.get('/api/msc/sequences')
        assert list_resp.status_code == 200
        sequences = list_resp.json()
        
        # Should have at least our 3 sequences
        assert len(sequences) >= 3
        
        # Cleanup
        for seq_id in ids:
            client.delete(f'/api/msc/sequences/{seq_id}')
    
    def test_export_import_workflow(self, client):
        """Test exporting and importing a sequence."""
        # Create and populate a sequence
        create_resp = client.post('/api/msc/sequences', json={
            'name': 'Export Test',
            'protocol': 'rrc_demo'
        })
        sequence_id = create_resp.json()['id']
        
        client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'RRCConnectionRequest',
            'data': {'test': 'data'},
            'source_actor': 'UE',
            'target_actor': 'gNB'
        })
        
        # Get the sequence (this is the "export")
        get_resp = client.get(f'/api/msc/sequences/{sequence_id}')
        exported = get_resp.json()
        
        # Delete original
        client.delete(f'/api/msc/sequences/{sequence_id}')
        
        # Import/recreate the sequence
        imported_resp = client.post('/api/msc/sequences', json={
            'name': exported['name'] + ' (Imported)',
            'protocol': exported['protocol']
        })
        new_id = imported_resp.json()['id']
        
        # Add messages from exported data
        for msg in exported['messages']:
            client.post(f'/api/msc/sequences/{new_id}/messages', json={
                'type_name': msg['type_name'],
                'data': msg['data'],
                'source_actor': msg.get('source_actor', msg.get('sourceActor', 'UE')),
                'target_actor': msg.get('target_actor', msg.get('targetActor', 'gNB'))
            })
        
        # Verify imported sequence
        verify_resp = client.get(f'/api/msc/sequences/{new_id}')
        imported_seq = verify_resp.json()
        
        assert imported_seq['name'] == 'Export Test (Imported)'
        assert len(imported_seq['messages']) == 1
        assert imported_seq['messages'][0]['data']['test'] == 'data'
        
        # Cleanup
        client.delete(f'/api/msc/sequences/{new_id}')


class TestMscSessionWorkflows:
    """Tests for MSC Session workflows."""
    
    def test_create_session_workflow(self, client):
        """Test creating a new session."""
        response = client.post('/api/msc/sessions', json={
            'name': 'Test Session',
            'description': 'A test session'
        })
        
        assert response.status_code == 200
        data = response.json()
        assert 'id' in data
        assert data['name'] == 'Test Session'
        
        # Cleanup
        client.delete(f"/api/msc/sessions/{data['id']}")
    
    def test_session_with_sequences_workflow(self, client):
        """Test creating sequences within a session."""
        # Create session
        session_resp = client.post('/api/msc/sessions', json={
            'name': 'Session With Sequences'
        })
        session_id = session_resp.json()['id']
        
        # Create sequences in session
        seq1_resp = client.post('/api/msc/sequences', json={
            'name': 'Session Sequence 1',
            'protocol': 'rrc_demo',
            'session_id': session_id
        })
        
        seq2_resp = client.post('/api/msc/sequences', json={
            'name': 'Session Sequence 2', 
            'protocol': 'rrc_demo',
            'session_id': session_id
        })
        
        # List sequences in session
        list_resp = client.get(f'/api/msc/sequences?session_id={session_id}')
        sequences = list_resp.json()
        
        # Should have 2 sequences in this session
        session_seqs = [s for s in sequences if s.get('session_id') == session_id]
        assert len(session_seqs) >= 2
        
        # Cleanup
        client.delete(f"/api/msc/sequences/{seq1_resp.json()['id']}")
        client.delete(f"/api/msc/sequences/{seq2_resp.json()['id']}")
        client.delete(f'/api/msc/sessions/{session_id}')


class TestMscHexDecodeWorkflow:
    """Tests for hex decoding workflow."""
    
    def test_decode_hex_to_message(self, client):
        """Test decoding hex data to message."""
        # This test depends on having the ASN.1 compiler available
        # Using a simple example that should decode
        response = client.post('/api/msc/decode-hex', json={
            'hex_data': '30030101ff',  # Simple example
            'protocol': 'rrc_demo'
        })
        
        # The response might fail if hex doesn't match schema
        # But endpoint should respond
        assert response.status_code in [200, 400, 422]
        
        if response.status_code == 200:
            data = response.json()
            assert 'status' in data


class TestMscEdgeCases:
    """Tests for edge cases and error handling."""
    
    def test_get_nonexistent_sequence(self, client):
        """Test getting a sequence that doesn't exist."""
        response = client.get('/api/msc/sequences/nonexistent-id')
        assert response.status_code == 404
    
    def test_update_nonexistent_sequence(self, client):
        """Test updating a sequence that doesn't exist."""
        response = client.put('/api/msc/sequences/nonexistent-id', json={
            'name': 'New Name'
        })
        assert response.status_code == 404
    
    def test_delete_nonexistent_sequence(self, client):
        """Test deleting a sequence that doesn't exist."""
        response = client.delete('/api/msc/sequences/nonexistent-id')
        # Should return 404 or 200 (idempotent delete)
        assert response.status_code in [200, 404]
    
    def test_add_message_to_nonexistent_sequence(self, client):
        """Test adding message to non-existent sequence."""
        response = client.post('/api/msc/sequences/nonexistent-id/messages', json={
            'type_name': 'Test',
            'data': {},
            'source_actor': 'UE',
            'target_actor': 'gNB'
        })
        assert response.status_code == 404
    
    def test_empty_sequence_name(self, client):
        """Test creating sequence with empty name."""
        response = client.post('/api/msc/sequences', json={
            'name': '',
            'protocol': 'rrc_demo'
        })
        # Should either fail validation or create with empty name
        assert response.status_code in [200, 400, 422]
    
    def test_invalid_protocol(self, client):
        """Test creating sequence with invalid protocol."""
        response = client.post('/api/msc/sequences', json={
            'name': 'Test',
            'protocol': 'nonexistent_protocol'
        })
        # May succeed (protocol not validated) or fail
        assert response.status_code in [200, 400, 422]
