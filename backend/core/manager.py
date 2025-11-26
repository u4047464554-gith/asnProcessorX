import os
import glob
from dataclasses import dataclass, asdict
from typing import Dict, Optional, List, Any

import asn1tools


@dataclass
class ProtocolMetadata:
    """Lightweight DAO describing compiled ASN.1 assets."""

    name: str
    files: List[str]
    types: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class AsnManager:
    def __init__(self, specs_dir: str = "asn_specs"):
        # If running from backend/, specs might be in ../asn_specs
        if not os.path.exists(specs_dir) and os.path.exists(os.path.join("..", specs_dir)):
            self.specs_dir = os.path.join("..", specs_dir)
        else:
            self.specs_dir = specs_dir
            
        self.compilers: Dict[str, asn1tools.compiler.Specification] = {}
        self.metadata: Dict[str, ProtocolMetadata] = {}
        self.ensure_specs_dir()
        
    def ensure_specs_dir(self):
        if not os.path.exists(self.specs_dir):
            os.makedirs(self.specs_dir)

    def load_protocols(self):
        """
        Scans the specs directory. Each subdirectory is treated as a 'Protocol'.
        Compiles all .asn files in that subdirectory.
        """
        if not os.path.exists(self.specs_dir):
            return

        # List subdirectories
        subdirs = [d for d in os.listdir(self.specs_dir) 
                   if os.path.isdir(os.path.join(self.specs_dir, d))]

        for protocol in subdirs:
            proto_path = os.path.join(self.specs_dir, protocol)
            asn_files = sorted(glob.glob(os.path.join(proto_path, "*.asn")))
            
            if asn_files:
                print(f"Compiling protocol: {protocol} with files: {asn_files}")
                try:
                    compiler = asn1tools.compile_files(asn_files, codec='per')
                    self.compilers[protocol] = compiler
                    type_names = sorted(list(compiler.types.keys()))
                    self.metadata[protocol] = ProtocolMetadata(
                        name=protocol,
                        files=[os.path.relpath(path, self.specs_dir) for path in asn_files],
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

