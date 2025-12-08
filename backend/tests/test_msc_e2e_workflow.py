"""
End-to-End Test for MSC Main Workflow
Tests the complete user flow: create session, add messages, edit, validate, save, delete

API Paths:
- Sessions: /api/sessions/*
- MSC Sequences: /api/msc/sequences/*
"""
import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client():
    """Create test client for API testing."""
    return TestClient(app)


class TestMscMainWorkflow:
    """
    End-to-end tests simulating the main MSC workflow:
    1. Create/select session
    2. Add first message to MSC diagram
    3. Add second message  
    4. Add third message
    5. Edit messages by updating JSON data
    6. Validate for ASN.1 compliance
    7. Ensure session is saved
    8. Change messages
    9. Delete messages
    """
    
    def test_complete_msc_workflow(self, client):
        """Test the complete MSC editing workflow."""
        
        # === STEP 1: Create a sequence ===
        seq_resp = client.post('/api/msc/sequences', json={
            'name': 'RRC Connection Workflow',
            'protocol': 'rrc_demo'
        })
        assert seq_resp.status_code == 200, f"Failed to create sequence: {seq_resp.text}"
        sequence = seq_resp.json()
        sequence_id = sequence['id']
        assert sequence['messages'] == []
        print(f"✓ Step 1: Created sequence {sequence_id}")
        
        # === STEP 3: Add first message - RRC Connection Request (UE -> gNB) ===
        msg1_resp = client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'RRCConnectionRequest',
            'data': {
                'ue-Identity': {
                    'randomValue': '0xABCDEF123456'
                },
                'establishmentCause': 'mo-Signalling',
                'spare': '0x0'
            },
            'source_actor': 'UE',
            'target_actor': 'gNB'
        })
        assert msg1_resp.status_code == 200, f"Failed to add first message: {msg1_resp.text}"
        seq_after_msg1 = msg1_resp.json()
        assert len(seq_after_msg1['messages']) == 1
        msg1_id = seq_after_msg1['messages'][0]['id']
        print(f"✓ Step 3: Added first message (RRCConnectionRequest) - id: {msg1_id}")
        
        # === STEP 4: Add second message - RRC Connection Setup (gNB -> UE) ===
        msg2_resp = client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'RRCConnectionSetup',
            'data': {
                'rrc-TransactionIdentifier': 1,
                'criticalExtensions': {
                    'c1': {
                        'rrcConnectionSetup-r8': {
                            'radioResourceConfigDedicated': {}
                        }
                    }
                }
            },
            'source_actor': 'gNB',
            'target_actor': 'UE'
        })
        assert msg2_resp.status_code == 200, f"Failed to add second message: {msg2_resp.text}"
        seq_after_msg2 = msg2_resp.json()
        assert len(seq_after_msg2['messages']) == 2
        msg2_id = seq_after_msg2['messages'][1]['id']
        print(f"✓ Step 4: Added second message (RRCConnectionSetup) - id: {msg2_id}")
        
        # === STEP 5: Add third message - RRC Connection Setup Complete (UE -> gNB) ===
        msg3_resp = client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'RRCConnectionSetupComplete',
            'data': {
                'rrc-TransactionIdentifier': 1,
                'criticalExtensions': {
                    'c1': {
                        'rrcConnectionSetupComplete-r8': {
                            'selectedPLMN-Identity': 1
                        }
                    }
                }
            },
            'source_actor': 'UE',
            'target_actor': 'gNB'
        })
        assert msg3_resp.status_code == 200, f"Failed to add third message: {msg3_resp.text}"
        seq_after_msg3 = msg3_resp.json()
        assert len(seq_after_msg3['messages']) == 3
        msg3_id = seq_after_msg3['messages'][2]['id']
        print(f"✓ Step 5: Added third message (RRCConnectionSetupComplete) - id: {msg3_id}")
        
        # === STEP 6: Edit first message - update JSON data ===
        edit1_resp = client.put(f'/api/msc/sequences/{sequence_id}', json={
            'update_message': {
                'id': msg1_id,
                'data': {
                    'ue-Identity': {
                        'randomValue': '0x999888777666'  # Changed value
                    },
                    'establishmentCause': 'emergency',  # Changed cause
                    'spare': '0x0'
                }
            }
        })
        assert edit1_resp.status_code == 200, f"Failed to edit message: {edit1_resp.text}"
        edited_seq = edit1_resp.json()
        assert edited_seq['messages'][0]['data']['establishmentCause'] == 'emergency'
        print("✓ Step 6: Edited first message - changed establishmentCause to 'emergency'")
        
        # === STEP 7: Validate the sequence for ASN.1 compliance ===
        validate_resp = client.post(f'/api/msc/sequences/{sequence_id}/validate')
        assert validate_resp.status_code == 200, f"Failed to validate: {validate_resp.text}"
        validation = validate_resp.json()
        result_count = len(validation.get('results', [])) if isinstance(validation, dict) else 0
        print(f"✓ Step 7: Validated sequence - {result_count} validation results")
        
        # === STEP 8: Verify sequence is persisted (reload) ===
        reload_resp = client.get(f'/api/msc/sequences/{sequence_id}')
        assert reload_resp.status_code == 200
        reloaded = reload_resp.json()
        assert len(reloaded['messages']) == 3
        assert reloaded['messages'][0]['data']['establishmentCause'] == 'emergency'
        print("✓ Step 8: Verified sequence persisted correctly after reload")
        
        # === STEP 9: Change second message ===
        edit2_resp = client.put(f'/api/msc/sequences/{sequence_id}', json={
            'update_message': {
                'id': msg2_id,
                'data': {
                    'rrc-TransactionIdentifier': 2,  # Changed from 1 to 2
                    'criticalExtensions': {
                        'c1': {
                            'rrcConnectionSetup-r8': {
                                'radioResourceConfigDedicated': {
                                    'physicalConfigDedicated': {}  # Added new field
                                }
                            }
                        }
                    }
                }
            }
        })
        assert edit2_resp.status_code == 200
        print("✓ Step 9: Changed second message - updated transaction ID and added field")
        
        # === STEP 10: Delete third message ===
        delete_resp = client.put(f'/api/msc/sequences/{sequence_id}', json={
            'remove_message': msg3_id
        })
        assert delete_resp.status_code == 200
        after_delete = delete_resp.json()
        assert len(after_delete['messages']) == 2
        assert all(m['id'] != msg3_id for m in after_delete['messages'])
        print("✓ Step 10: Deleted third message")
        
        # === STEP 11: Verify final state ===
        final_resp = client.get(f'/api/msc/sequences/{sequence_id}')
        final_seq = final_resp.json()
        
        assert len(final_seq['messages']) == 2
        # Handle both camelCase and snake_case
        type1 = final_seq['messages'][0].get('type_name') or final_seq['messages'][0].get('typeName')
        type2 = final_seq['messages'][1].get('type_name') or final_seq['messages'][1].get('typeName')
        assert type1 == 'RRCConnectionRequest'
        assert final_seq['messages'][0]['data']['establishmentCause'] == 'emergency'
        assert type2 == 'RRCConnectionSetup'
        print("✓ Step 11: Verified final sequence state")
        
        # === CLEANUP ===
        client.delete(f'/api/msc/sequences/{sequence_id}')
        # Don't try to delete the session if it's the last one
        print("✓ Cleanup: Deleted sequence")
        
        print("\n" + "="*50)
        print("MSC Main Workflow Test PASSED!")
        print("="*50)
    
    def test_message_flow_direction(self, client):
        """Test that message directions (UE <-> gNB) are properly tracked."""
        # Create sequence
        seq_resp = client.post('/api/msc/sequences', json={
            'name': 'Direction Test',
            'protocol': 'rrc_demo'
        })
        sequence_id = seq_resp.json()['id']
        
        # Add uplink message (UE -> gNB)
        client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'UplinkMessage',
            'data': {},
            'source_actor': 'UE',
            'target_actor': 'gNB'
        })
        
        # Add downlink message (gNB -> UE)
        client.post(f'/api/msc/sequences/{sequence_id}/messages', json={
            'type_name': 'DownlinkMessage',
            'data': {},
            'source_actor': 'gNB',
            'target_actor': 'UE'
        })
        
        # Verify directions
        seq = client.get(f'/api/msc/sequences/{sequence_id}').json()
        
        # Handle both camelCase and snake_case
        msg0_source = seq['messages'][0].get('source_actor') or seq['messages'][0].get('sourceActor')
        msg0_target = seq['messages'][0].get('target_actor') or seq['messages'][0].get('targetActor')
        msg1_source = seq['messages'][1].get('source_actor') or seq['messages'][1].get('sourceActor')
        msg1_target = seq['messages'][1].get('target_actor') or seq['messages'][1].get('targetActor')
        
        assert msg0_source == 'UE'
        assert msg0_target == 'gNB'
        assert msg1_source == 'gNB'
        assert msg1_target == 'UE'
        
        # Cleanup
        client.delete(f'/api/msc/sequences/{sequence_id}')
    
    def test_sequence_name_update(self, client):
        """Test updating sequence name."""
        # Create
        seq_resp = client.post('/api/msc/sequences', json={
            'name': 'Original Name',
            'protocol': 'rrc_demo'
        })
        sequence_id = seq_resp.json()['id']
        
        # Update name
        update_resp = client.put(f'/api/msc/sequences/{sequence_id}', json={
            'name': 'Updated Name'
        })
        assert update_resp.status_code == 200
        assert update_resp.json()['name'] == 'Updated Name'
        
        # Verify persisted
        verify = client.get(f'/api/msc/sequences/{sequence_id}').json()
        assert verify['name'] == 'Updated Name'
        
        # Cleanup
        client.delete(f'/api/msc/sequences/{sequence_id}')


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short', '-s'])
