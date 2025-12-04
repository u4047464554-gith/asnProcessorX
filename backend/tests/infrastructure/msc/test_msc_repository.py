import pytest
import os
import tempfile
import json
from datetime import datetime, timedelta
from unittest.mock import Mock

from backend.domain.msc.entities import (
    MscSequence, MscMessage, TrackedIdentifier, 
    ValidationResult, ValidationType
)
from backend.infrastructure.msc.msc_repository import MscRepository

@pytest.fixture
def temp_storage_dir():
    """Create temporary directory for repository testing."""
    with tempfile.TemporaryDirectory() as temp_dir:
        repo = MscRepository(temp_dir)
        yield repo, temp_dir

class TestMscRepository:
    def test_create_sequence(self, temp_storage_dir):
        """Test creating and persisting a new sequence."""
        repo, temp_dir = temp_storage_dir
        
        # Create test sequence
        sequence = MscSequence(
            name="Test Sequence",
            protocol="rrc_demo",
            messages=[
                MscMessage(
                    type_name="RRCConnectionRequest",
                    data={"ue-Identity": "UE123"},
                    source_actor="UE",
                    target_actor="gNB",
                    timestamp=1234567890.0
                )
            ]
        )
        
        # Create sequence
        created = repo.create_sequence(sequence)
        
        assert created.id == sequence.id
        assert os.path.exists(repo._sequence_file_path(sequence.id))
        
        # Verify file content
        with open(repo._sequence_file_path(sequence.id), 'r') as f:
            data = json.load(f)
            assert data['name'] == "Test Sequence"
            assert data['protocol'] == "rrc_demo"
            assert len(data['messages']) == 1
            assert data['messages'][0]['type_name'] == "RRCConnectionRequest"
    
    def test_get_sequence(self, temp_storage_dir):
        """Test retrieving an existing sequence."""
        repo, temp_dir = temp_storage_dir
        
        # Create and save sequence
        sequence = MscSequence(name="Retrieved Sequence", protocol="rrc_demo")
        repo.create_sequence(sequence)
        
        # Retrieve sequence
        retrieved = repo.get_sequence(sequence.id)
        
        assert retrieved is not None
        assert retrieved.id == sequence.id
        assert retrieved.name == "Retrieved Sequence"
        assert retrieved.protocol == "rrc_demo"
    
    def test_get_sequence_not_found(self, temp_storage_dir):
        """Test retrieving non-existent sequence."""
        repo, _ = temp_storage_dir
        
        result = repo.get_sequence("nonexistent-id")
        assert result is None
    
    def test_update_sequence(self, temp_storage_dir):
        """Test updating an existing sequence."""
        repo, temp_dir = temp_storage_dir
        
        # Create initial sequence
        original = MscSequence(name="Original Name", protocol="rrc_demo")
        repo.create_sequence(original)
        
        # Update sequence
        original.name = "Updated Name"
        original.messages.append(
            MscMessage(
                type_name="RRCConnectionSetup",
                data={"rrc-TransactionIdentifier": 1},
                source_actor="gNB",
                target_actor="UE",
                timestamp=1234567891.0
            )
        )
        
        updated = repo.update_sequence(original)
        
        # Verify update persisted
        retrieved = repo.get_sequence(original.id)
        assert retrieved.name == "Updated Name"
        assert len(retrieved.messages) == 1
        assert retrieved.messages[0].type_name == "RRCConnectionSetup"
        assert retrieved.updated_at > original.created_at
    
    def test_delete_sequence(self, temp_storage_dir):
        """Test deleting a sequence."""
        repo, temp_dir = temp_storage_dir
        
        # Create sequence
        sequence = MscSequence(name="To Delete", protocol="rrc_demo")
        repo.create_sequence(sequence)
        
        # Verify exists
        assert os.path.exists(repo._sequence_file_path(sequence.id))
        
        # Delete
        success = repo.delete_sequence(sequence.id)
        assert success is True
        
        # Verify deleted
        assert not os.path.exists(repo._sequence_file_path(sequence.id))
        assert repo.get_sequence(sequence.id) is None
    
    def test_delete_nonexistent_sequence(self, temp_storage_dir):
        """Test deleting non-existent sequence."""
        repo, _ = temp_storage_dir
        
        success = repo.delete_sequence("nonexistent")
        assert success is False
    
    def test_list_sequences(self, temp_storage_dir):
        """Test listing all sequences."""
        repo, temp_dir = temp_storage_dir
        
        # Create multiple sequences
        seq1 = MscSequence(name="Sequence 1", protocol="rrc_demo")
        seq2 = MscSequence(name="Sequence 2", protocol="rrc_demo")
        seq3 = MscSequence(name="Sequence 3", protocol="s1ap_demo")
        
        repo.create_sequence(seq1)
        repo.create_sequence(seq2)
        repo.create_sequence(seq3)
        
        # List all sequences
        all_sequences = repo.list_sequences()
        assert len(all_sequences) == 3
        
        # List by protocol
        rrc_sequences = repo.list_sequences("rrc_demo")
        assert len(rrc_sequences) == 2
        assert all(seq.protocol == "rrc_demo" for seq in rrc_sequences)
        
        s1ap_sequences = repo.list_sequences("s1ap_demo")
        assert len(s1ap_sequences) == 1
        
        # Verify sorting by updated_at
        assert all_sequences[0].updated_at >= all_sequences[1].updated_at
    
    def test_list_sequences_empty(self, temp_storage_dir):
        """Test listing sequences when storage is empty."""
        repo, _ = temp_storage_dir
        
        sequences = repo.list_sequences()
        assert len(sequences) == 0
        
        filtered = repo.list_sequences("nonexistent")
        assert len(filtered) == 0
    
    def test_serialization_deserialization_roundtrip(self, temp_storage_dir):
        """Test full serialization/deserialization roundtrip."""
        repo, temp_dir = temp_storage_dir
        
        # Create complex sequence
        sequence = MscSequence(
            name="Complex Test",
            protocol="rrc_demo",
            messages=[
                MscMessage(
                    type_name="RRCConnectionRequest",
                    data={
                        "ue-Identity": {"randomValue": "0x1234567890ABCDEF"},
                        "establishmentCause": "mo-Signalling",
                        "spare": "0x0"
                    },
                    source_actor="UE",
                    target_actor="gNB",
                    timestamp=1234567890.0
                ),
                MscMessage(
                    type_name="RRCConnectionSetup",
                    data={
                        "rrc-TransactionIdentifier": 1,
                        "radioBearerConfig": {
                            "srb-ToAddModList": []
                        }
                    },
                    source_actor="gNB",
                    target_actor="UE",
                    timestamp=1234567891.0
                )
            ],
            tracked_identifiers={
                "ue-Identity": TrackedIdentifier(
                    name="ue-Identity",
                    values={0: {"randomValue": "0x1234567890ABCDEF"}}
                ),
                "rrc-TransactionIdentifier": TrackedIdentifier(
                    name="rrc-TransactionIdentifier",
                    values={1: 1}
                )
            },
            validation_results=[
                ValidationResult(
                    type=ValidationType.WARNING,
                    message="Test warning for sequence validation",
                    code="TEST_WARNING"
                )
            ]
        )
        
        # Serialize and deserialize
        repo.create_sequence(sequence)
        retrieved = repo.get_sequence(sequence.id)
        
        # Verify roundtrip integrity
        assert retrieved.name == sequence.name
        assert retrieved.protocol == sequence.protocol
        assert len(retrieved.messages) == 2
        assert retrieved.messages[0].type_name == "RRCConnectionRequest"
        assert retrieved.messages[0].data["ue-Identity"]["randomValue"] == "0x1234567890ABCDEF"
        assert retrieved.messages[1].type_name == "RRCConnectionSetup"
        assert retrieved.messages[1].data["rrc-TransactionIdentifier"] == 1
        
        assert len(retrieved.tracked_identifiers) == 2
        assert "ue-Identity" in retrieved.tracked_identifiers
        assert retrieved.tracked_identifiers["ue-Identity"].values == {0: {"randomValue": "0x1234567890ABCDEF"}}
        
        assert len(retrieved.validation_results) == 1
        assert retrieved.validation_results[0].type == ValidationType.WARNING
        assert "Test warning" in retrieved.validation_results[0].message
    
    def test_corrupted_file_handling(self, temp_storage_dir):
        """Test repository handles corrupted JSON files gracefully."""
        repo, temp_dir = temp_storage_dir
        
        # Create corrupted file
        corrupted_file = os.path.join(temp_dir, "corrupted.json")
        with open(corrupted_file, 'w') as f:
            f.write("invalid json")
        
        # Try to load - should skip corrupted file
        # Rename to sequence ID format
        sequence_id = "corrupted"
        os.rename(corrupted_file, repo._sequence_file_path(sequence_id))
        
        # List sequences should skip corrupted file
        sequences = repo.list_sequences()
        assert len(sequences) == 0  # No valid sequences
        
        # Get sequence should return None for corrupted
        result = repo.get_sequence(sequence_id)
        assert result is None
    
    def test_delete_sequence_file_not_found(self, temp_storage_dir):
        """Test delete handles missing files gracefully."""
        repo, _ = temp_storage_dir
        
        success = repo.delete_sequence("nonexistent")
        assert success is False
    
    def test_repository_statistics(self, temp_storage_dir):
        """Test repository statistics functionality."""
        repo, temp_dir = temp_storage_dir
        
        # Create sequences for stats
        seq1 = MscSequence(name="Stats 1", protocol="rrc_demo", messages=[Mock()])
        seq2 = MscSequence(name="Stats 2", protocol="rrc_demo", messages=[Mock(), Mock()])
        seq3 = MscSequence(name="Stats 3", protocol="s1ap_demo", messages=[Mock()])
        
        repo.create_sequence(seq1)
        repo.create_sequence(seq2)
        repo.create_sequence(seq3)
        
        stats = repo.get_sequence_statistics()
        
        assert stats['total_sequences'] == 3
        assert stats['total_messages'] == 4
        assert 'rrc_demo' in stats['protocols']
        assert stats['protocols']['rrc_demo']['count'] == 2
        assert stats['protocols']['rrc_demo']['messages'] == 3
        assert 's1ap_demo' in stats['protocols']
        assert len(stats['recent_sequences']) == 3
    
    def test_cleanup_old_sequences(self, temp_storage_dir):
        """Test cleanup of old sequences."""
        repo, temp_dir = temp_storage_dir
        
        # Create old and new sequences
        old_sequence = MscSequence(
            name="Old Sequence",
            protocol="rrc_demo",
            created_at=datetime.now() - timedelta(days=40),
            updated_at=datetime.now() - timedelta(days=40)
        )
        new_sequence = MscSequence(
            name="New Sequence", 
            protocol="rrc_demo",
            created_at=datetime.now() - timedelta(days=1),
            updated_at=datetime.now() - timedelta(days=1)
        )
        
        repo.create_sequence(old_sequence)
        repo.create_sequence(new_sequence)
        
        # Verify both exist
        assert len(repo.list_sequences()) == 2
        
        # Cleanup sequences older than 30 days
        deleted = repo.cleanup_old_sequences(max_age_days=30)
        
        assert deleted == 1  # Only old sequence deleted
        assert len(repo.list_sequences()) == 1  # Only new remains
        assert repo.list_sequences()[0].name == "New Sequence"

# Note: This test requires the mock manager to be available
# In full test suite, would need to mock the manager import
def test_repository_with_real_manager(mocker):
    """Test repository integration with real manager (mocked)."""
    # Mock the manager to avoid actual ASN.1 compilation during tests
    mocker.patch('backend.core.manager.manager')
    mock_manager = Mock()
    mock_manager.list_protocols.return_value = ['rrc_demo', 's1ap_demo']
    mock_manager.get_compiler.return_value = None  # No real compilation
    
    # This test would verify repository works with real domain objects
    # Implementation depends on full test setup
    pass

