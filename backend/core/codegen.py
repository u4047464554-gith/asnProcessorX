import os
import subprocess
import shutil
import tempfile
import zipfile
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any

from backend.core.manager import AsnManager

# Configure logging
logger = logging.getLogger(__name__)

class CodegenService:
    """
    Service for generating C code from ASN.1 specifications using asn1c.
    """
    
    ASN1C_BIN = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../sources/asn1c/bin/asn1c"))
    if os.name == 'nt' and not ASN1C_BIN.endswith('.exe'):
         ASN1C_BIN += ".exe"

    def __init__(self, manager: AsnManager):
        self.manager = manager

    def _get_asn1c_path(self) -> str:
        """
        Resolve path to asn1c binary. 
        Falls back to system PATH if vendored binary not found.
        """
        if os.path.exists(self.ASN1C_BIN):
            return self.ASN1C_BIN
        
        system_path = shutil.which("asn1c")
        if system_path:
            return system_path
            
        raise FileNotFoundError("asn1c binary not found. Please build it or install it in system PATH.")

    def generate_c_stubs(self, 
                         protocol: str, 
                         types: List[str], 
                         options: Optional[Dict[str, Any]] = None) -> str:
        """
        Generate C stubs for the given protocol and types.
        
        Args:
            protocol: Name of the protocol (must be loaded in manager)
            types: List of specific type names to generate (unused by asn1c mostly, 
                   as it compiles the whole module, but kept for future filtering/manifest)
            options: Dict of options (e.g., {'pdu': 'MyType', 'flags': ['-fcompound-names']})
            
        Returns:
            Path to the generated zip file.
        """
        
        # 1. Validate protocol
        if protocol not in self.manager.protocols:
            raise ValueError(f"Protocol '{protocol}' not found")
            
        protocol_def = self.manager.protocols[protocol]
        # AsnManager doesn't strictly store file paths in a simple list in the MVP, 
        # but we can reconstruct or access them if we modify AsnManager to expose them.
        # For now, assuming we can get the source files from the protocol definition 
        # or by scanning the directory.
        
        # HACK: Reconstruct source path from protocol name. 
        # Ideally, AsnManager should expose the list of loaded files.
        # We'll look into the `asn_specs/{protocol}` directory.
        
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../asn_specs"))
        protocol_dir = os.path.join(base_dir, protocol)
        
        if not os.path.exists(protocol_dir):
             raise ValueError(f"Protocol directory not found: {protocol_dir}")
             
        asn_files = [str(p) for p in Path(protocol_dir).glob("*.asn")]
        if not asn_files:
            raise ValueError(f"No .asn files found in {protocol_dir}")

        # 2. Prepare options
        cmd_flags = ["-gen-PER"] # Default to PER
        
        if options:
             # Whitelist safe flags
             safe_flags = {
                 'compound-names': '-fcompound-names',
                 'wide-types': '-fwide-types',
                 'no-constraints': '-fno-constraints',
                 'print-constraints': '-print-constraints'
             }
             for key, flag in safe_flags.items():
                 if options.get(key):
                     cmd_flags.append(flag)
            
             if options.get('pdu'):
                 # Select specific PDU if supported by asn1c version (newer ones use -pdu=...)
                 # cmd_flags.append(f"-pdu={options['pdu']}")
                 pass

        # 3. Create temporary workspace
        # Structure: backend/generated/{protocol}/{random_id}/
        output_base = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../generated"))
        os.makedirs(output_base, exist_ok=True)
        
        with tempfile.TemporaryDirectory(dir=output_base) as temp_dir:
            logger.info(f"Generating C stubs for {protocol} in {temp_dir}")
            
            # 4. Run asn1c
            asn1c_exe = self._get_asn1c_path()
            cmd = [asn1c_exe] + cmd_flags + asn_files
            
            try:
                result = subprocess.run(
                    cmd,
                    cwd=temp_dir,
                    capture_output=True,
                    text=True,
                    check=True
                )
            except subprocess.CalledProcessError as e:
                logger.error(f"asn1c failed: {e.stderr}")
                raise RuntimeError(f"asn1c compilation failed:\n{e.stderr}")

            # 5. Package results (Zip)
            zip_filename = f"{protocol}_c_stubs.zip"
            zip_path = os.path.join(output_base, zip_filename) # This might overwrite concurrents, better use random
            
            # Better: return a temp file path that the router can stream and then delete
            # For now, let's create a unique zip
            import uuid
            unique_id = str(uuid.uuid4())[:8]
            zip_path = os.path.join(output_base, f"{protocol}_{unique_id}.zip")

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, temp_dir)
                        zipf.write(file_path, arcname)
                        
                # Add manifest
                import json
                manifest = {
                    "protocol": protocol,
                    "types": types,
                    "options": options,
                    "files": [os.path.basename(f) for f in asn_files],
                    "generator": "asn1c",
                    "timestamp": unique_id  # proxy for time
                }
                zipf.writestr("manifest.json", json.dumps(manifest, indent=2))

            return zip_path





