import os
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from backend.core.codegen import CodegenService
from backend.core.manager import AsnManager

@pytest.fixture
def mock_manager():
    manager = MagicMock(spec=AsnManager)
    manager.protocols = {
        "test_proto": "dummy_def"
    }
    return manager

@pytest.fixture
def codegen_service(mock_manager):
    return CodegenService(mock_manager)

def test_codegen_service_init(codegen_service):
    assert codegen_service.manager is not None

@patch("backend.core.codegen.shutil.which")
@patch("backend.core.codegen.os.path.exists")
def test_get_asn1c_path_vendored(mock_exists, mock_which, codegen_service):
    # Case 1: Vendored binary exists
    mock_exists.return_value = True
    path = codegen_service._get_asn1c_path()
    assert "sources/asn1c/bin/asn1c" in path.replace("\\", "/")

@patch("backend.core.codegen.shutil.which")
@patch("backend.core.codegen.os.path.exists")
def test_get_asn1c_path_system(mock_exists, mock_which, codegen_service):
    # Case 2: Vendored binary missing, found in system
    mock_exists.return_value = False
    mock_which.return_value = "/usr/bin/asn1c"
    
    path = codegen_service._get_asn1c_path()
    assert path == "/usr/bin/asn1c"

@patch("backend.core.codegen.shutil.which")
@patch("backend.core.codegen.os.path.exists")
def test_get_asn1c_path_missing(mock_exists, mock_which, codegen_service):
    # Case 3: Both missing
    mock_exists.return_value = False
    mock_which.return_value = None
    
    with pytest.raises(FileNotFoundError, match="asn1c binary not found"):
        codegen_service._get_asn1c_path()

@patch("backend.core.codegen.subprocess.run")
@patch("backend.core.codegen.tempfile.TemporaryDirectory")
@patch("backend.core.codegen.zipfile.ZipFile")
@patch("backend.core.codegen.os.makedirs")
@patch("backend.core.codegen.os.path.exists")
@patch("backend.core.codegen.Path.glob")
def test_generate_c_stubs_success(mock_glob, mock_exists, mock_makedirs, mock_zip, mock_temp_dir, mock_run, codegen_service):
    # Setup mocks
    mock_exists.return_value = True
    mock_glob.return_value = [Path("spec.asn")]
    
    # Mock temp dir context manager
    mock_temp_dir.return_value.__enter__.return_value = "/tmp/work"
    
    # Mock subprocess success
    mock_run.return_value = MagicMock(returncode=0)
    
    # Mock ZipFile context manager
    mock_zip.return_value.__enter__.return_value = MagicMock()

    # Execute
    zip_path = codegen_service.generate_c_stubs("test_proto", ["MyType"])
    
    # Verify
    assert "test_proto" in zip_path
    assert zip_path.endswith(".zip")
    mock_run.assert_called_once()
    
    # Check args passed to asn1c
    cmd_args = mock_run.call_args[0][0]
    assert "-gen-PER" in cmd_args
    assert "spec.asn" in str(cmd_args[-1])

def test_generate_c_stubs_invalid_protocol(codegen_service):
    with pytest.raises(ValueError, match="Protocol 'bad_proto' not found"):
        codegen_service.generate_c_stubs("bad_proto", [])
