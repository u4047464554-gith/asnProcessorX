import os
import glob
import sys
from dataclasses import dataclass, asdict
from typing import Dict, Optional, List, Any

from backend.core.asn1_runtime import asn1tools
from backend.core.config import config_manager


@dataclass
class ProtocolMetadata:
    """Lightweight DAO describing compiled ASN.1 assets."""

    name: str
    files: List[str]
    types: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class AsnManager:
    def __init__(self):
        # We now use config_manager for specs locations
        self.compilers: Dict[str, asn1tools.compiler.Specification] = {}
        self.metadata: Dict[str, ProtocolMetadata] = {}
        self.load_protocols()
        
    def _resolve_specs_paths(self) -> List[str]:
        """Resolve spec directories from config, handling relative/absolute paths."""
        config = config_manager.get()
        paths = []
        
        # If running frozen, we might want to look relative to executable for default 'asn_specs'
        base_dir = os.getcwd()
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
            
        for path in config.specs_directories:
            if os.path.isabs(path):
                if os.path.exists(path):
                    paths.append(path)
            else:
                # Try relative to base_dir
                abs_path = os.path.join(base_dir, path)
                if os.path.exists(abs_path):
                    paths.append(abs_path)
                # Fallback: Try relative to CWD if different
                elif os.path.exists(os.path.join(os.getcwd(), path)):
                    paths.append(os.path.join(os.getcwd(), path))
                # Fallback: Try ../path (development mode)
                elif os.path.exists(os.path.join("..", path)):
                    paths.append(os.path.join("..", path))
                    
        return paths

    def load_protocols(self):
        """
        Scans all configured specs directories.
        """
        search_paths = self._resolve_specs_paths()
        print(f"[AsnManager] Scanning paths: {search_paths}")

        for specs_dir in search_paths:
            if not os.path.isdir(specs_dir):
                continue

            # List subdirectories
            subdirs = [d for d in os.listdir(specs_dir) 
                       if os.path.isdir(os.path.join(specs_dir, d))]

            for protocol in subdirs:
                proto_path = os.path.join(specs_dir, protocol)
                asn_files = sorted(glob.glob(os.path.join(proto_path, "*.asn")))
                
                if asn_files:
                    print(f"Compiling protocol: {protocol} with files: {asn_files}")
                    try:
                        compiler = asn1tools.compile_files(asn_files, codec='per')
                        self.compilers[protocol] = compiler
                        type_names = sorted(list(compiler.types.keys()))
                        self.metadata[protocol] = ProtocolMetadata(
                            name=protocol,
                            files=[os.path.relpath(path, specs_dir) for path in asn_files],
                            types=type_names,
                        )
                        print(f"Successfully compiled {protocol}")
                    except Exception as e:
                        print(f"Error compiling {protocol}: {e}")

    def get_compiler(self, protocol: str) -> Optional[asn1tools.compiler.Specification]:
        return self.compilers.get(protocol)

    def reload(self):
        self.compilers.clear()
        self.metadata.clear()
        # Reload config in case it changed
        config_manager.reload()
        self.load_protocols()

    def list_protocols(self) -> List[str]:
        return list(self.compilers.keys())

    def get_protocol_metadata(self, protocol: str) -> Optional[Dict[str, Any]]:
        meta = self.metadata.get(protocol)
        return meta.to_dict() if meta else None

    def list_metadata(self) -> List[Dict[str, Any]]:
        return [meta.to_dict() for meta in self.metadata.values()]

# Singleton instance
manager = AsnManager()
