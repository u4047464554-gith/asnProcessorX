import os
import glob
import sys
import json
import re
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
        self.examples: Dict[str, Dict[str, Any]] = {}
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

    def load_protocols(self) -> Dict[str, str]:
        """
        Scans all configured specs directories.
        Returns a dict of protocol_name -> error_message for any failures.
        """
        search_paths = self._resolve_specs_paths()
        print(f"[AsnManager] Scanning paths: {search_paths}")
        
        self.compilers.clear()
        self.metadata.clear()
        self.examples.clear()

        errors = {}

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
                        
                        # Load JSON examples
                        json_files = sorted(glob.glob(os.path.join(proto_path, "*.json")))
                        loaded_examples = {}
                        for jf in json_files:
                            try:
                                with open(jf, 'r') as f:
                                    data = json.load(f)
                                    # Use filename stem as key (e.g. "MyMessage" from "MyMessage.json")
                                    name = os.path.splitext(os.path.basename(jf))[0]
                                    loaded_examples[name] = data
                            except Exception as e:
                                print(f"Warning: Failed to load example {jf}: {e}")
                        
                        if loaded_examples:
                            self.examples[protocol] = loaded_examples
                            print(f"Loaded {len(loaded_examples)} examples for {protocol}")

                        print(f"Successfully compiled {protocol}")
                    except Exception as e:
                        print(f"Error compiling {protocol}: {e}")
                        errors[protocol] = str(e)
        
        return errors

    def get_compiler(self, protocol: str) -> Optional[asn1tools.compiler.Specification]:
        return self.compilers.get(protocol)

    def reload(self) -> Dict[str, str]:
        # Reload config in case it changed
        config_manager.reload()
        return self.load_protocols()

    def list_protocols(self) -> List[str]:
        return list(self.compilers.keys())

    def get_protocol_metadata(self, protocol: str) -> Optional[Dict[str, Any]]:
        meta = self.metadata.get(protocol)
        return meta.to_dict() if meta else None

    def list_metadata(self) -> List[Dict[str, Any]]:
        return [meta.to_dict() for meta in self.metadata.values()]

    def get_examples(self, protocol: str) -> Dict[str, Any]:
        return self.examples.get(protocol, {})
    
    def get_protocol_path(self, protocol: str) -> Optional[str]:
        """
        Finds the absolute path on disk for a given protocol name.
        """
        search_paths = self._resolve_specs_paths()
        for specs_dir in search_paths:
            if not os.path.isdir(specs_dir):
                continue
            proto_path = os.path.join(specs_dir, protocol)
            if os.path.isdir(proto_path):
                return os.path.abspath(proto_path)
        return None

    def scan_definitions(self, protocol: str) -> Dict[str, List[str]]:
        """
        Scans .asn files in the protocol directory and returns a mapping of
        filename -> [list of defined types].
        """
        path = self.get_protocol_path(protocol)
        if not path: return {}
        
        result = {}
        asn_files = sorted(glob.glob(os.path.join(path, "*.asn")))
        for f in asn_files:
            filename = os.path.basename(f)
            types = []
            try:
                with open(f, 'r', encoding='utf-8') as file:
                    content = file.read()
                    # Matches "Type ::="
                    matches = re.findall(r'^\s*([A-Z][a-zA-Z0-9-]*)\s*::=', content, re.MULTILINE)
                    types = matches
            except Exception:
                pass
            result[filename] = types
        return result

# Singleton instance
manager = AsnManager()
