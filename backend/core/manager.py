import os
import glob
import sys
import json
import re
import threading
import time
import logging
import warnings
from dataclasses import dataclass, asdict
from typing import Dict, Optional, List, Any, Tuple

from backend.core.asn1_runtime import asn1tools
from backend.core.config import config_manager

logger = logging.getLogger(__name__)





@dataclass
class ProtocolMetadata:
    """Lightweight DAO describing compiled ASN.1 assets."""

    name: str
    files: List[str]
    types: List[str]
    is_bundled: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class AsnManager:
    def __init__(self):
        # We now use config_manager for specs locations
        self.compilers: Dict[str, asn1tools.compiler.Specification] = {}
        self.metadata: Dict[str, ProtocolMetadata] = {}
        self.examples: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()
        self._current_paths: List[str] = []
        self._snapshot_state: Dict[str, Tuple[float, int]] = {}
        self._last_snapshot_check: float = 0.0
        self._snapshot_interval: float = 2.0  # seconds
        self._compilation_warnings: List[str] = []  # Track implicit import warnings
        self.load_protocols()
        
    def _resolve_specs_paths(self) -> List[str]:
        """Resolve spec directories from config, handling relative/absolute paths."""
        config = config_manager.get()
        paths = []
        
        # If running frozen, we identify the install/bundle logic
        frozen = getattr(sys, 'frozen', False)
        base_dir = os.getcwd() # Default for non-frozen
        
        if frozen:
            # Look in the extracted temp folder for bundled resources
            if hasattr(sys, '_MEIPASS'):
                base_dir = sys._MEIPASS
            else:
                base_dir = os.path.dirname(sys.executable)
            
        for path in config.specs_directories:
            if os.path.isabs(path):
                if os.path.exists(path):
                    paths.append(path)
                else:
                    logger.warning(f"Configured absolute path does not exist: {path}")
            else:
                # 1. Try relative to base_dir (sys._MEIPASS when frozen)
                abs_path = os.path.join(base_dir, path)
                if os.path.exists(abs_path):
                    paths.append(abs_path)
                
                # 2. If frozen, ALSO try relative to the executable (external overrides)
                is_found = False
                if os.path.exists(abs_path):
                    is_found = True
                
                if frozen:
                    exe_dir = os.path.dirname(sys.executable)
                    exe_path = os.path.join(exe_dir, path)
                    if os.path.exists(exe_path):
                        if exe_path not in paths:
                            paths.append(exe_path)
                        is_found = True

                # 3. Fallback: Try relative to CWD if different
                cwd_path = os.path.join(os.getcwd(), path)
                if os.path.exists(cwd_path):
                    if cwd_path not in paths:
                        paths.append(cwd_path)
                    is_found = True
                
                # 4. Fallback: Try ../path (development mode)
                dev_path = os.path.join("..", path)
                if os.path.exists(dev_path):
                    if dev_path not in paths:
                        paths.append(dev_path)
                    is_found = True
                
                if not is_found:
                    logger.warning(f"Configured relative path not found: {path} (checked base={base_dir}, cwd={os.getcwd()})")

        return paths

    def _stat_entry(self, path: str) -> Tuple[float, int]:
        try:
            stat = os.stat(path)
            return (stat.st_mtime, stat.st_size)
        except OSError:
            return (0.0, 0)

    def _capture_snapshot(self, paths: List[str]) -> Dict[str, Tuple[float, int]]:
        config = config_manager.get()
        tracked_extensions = set(config.asn_extensions + [".json"])
        
        snapshot: Dict[str, Tuple[float, int]] = {}
        for path in paths:
            if os.path.isfile(path):
                snapshot[path] = self._stat_entry(path)
                continue
            
            specs_dir = path
            if not os.path.isdir(specs_dir):
                continue
            snapshot[specs_dir] = self._stat_entry(specs_dir)
            try:
                entries = os.listdir(specs_dir)
            except OSError:
                continue

            for entry in entries:
                proto_path = os.path.join(specs_dir, entry)
                if not os.path.isdir(proto_path):
                    continue
                snapshot[proto_path] = self._stat_entry(proto_path)

                for file_path in glob.glob(os.path.join(proto_path, "*")):
                    if not os.path.isfile(file_path):
                        continue
                    ext = os.path.splitext(file_path)[1].lower()
                    if ext not in tracked_extensions:
                        continue
                    snapshot[file_path] = self._stat_entry(file_path)
        return snapshot

    def _ensure_latest_locked(self):
        now = time.monotonic()
        if now - self._last_snapshot_check < self._snapshot_interval:
            return

        paths = self._current_paths or self._resolve_specs_paths()
        new_snapshot = self._capture_snapshot(paths)
        if new_snapshot != self._snapshot_state:
            logger.info("[AsnManager] Detected ASN.1 spec changes, reloading...")
            self._load_protocols_locked(paths)
        else:
            self._last_snapshot_check = now

    def load_protocols(self) -> Dict[str, str]:
        with self._lock:
            return self._load_protocols_locked()

    def get_last_warnings(self) -> List[str]:
        """Return warnings from the last compilation (e.g., implicit imports)."""
        with self._lock:
            return list(self._compilation_warnings)

    def _compile_with_warnings(self, asn_files: List[str], codec: str = 'per'):
        """Compile ASN.1 files and capture any warnings (e.g., implicit imports)."""
        with warnings.catch_warnings(record=True) as caught_warnings:
            warnings.simplefilter("always")
            compiler = asn1tools.compile_files(asn_files, codec=codec)
            
            # Add captured warnings to our list
            for w in caught_warnings:
                msg = str(w.message)
                if msg not in self._compilation_warnings:
                    self._compilation_warnings.append(msg)
                    logger.warning(f"Compilation warning: {msg}")
            
            return compiler

    def _load_protocols_locked(self, search_paths: Optional[List[str]] = None) -> Dict[str, str]:
        """
        Scans all configured specs directories.
        Returns a dict of protocol_name -> error_message for any failures.
        Warnings are stored in self._compilation_warnings.
        """
        search_paths = search_paths or self._resolve_specs_paths()
        logger.info(f"[AsnManager] Scanning paths: {search_paths}")
        
        # Clear previous warnings
        self._compilation_warnings = []
        
        config = config_manager.get()
        asn_extensions = set(config.asn_extensions)
        
        # We use temporary dicts to build the new state
        # If a protocol fails to compile, we try to retain the old version
        new_compilers = {}
        new_metadata = {}
        new_examples = {}

        errors = {}

        # Determine bundled dir
        base_dir = os.getcwd()
        if getattr(sys, 'frozen', False):
            if hasattr(sys, '_MEIPASS'):
                base_dir = sys._MEIPASS
            else:
                base_dir = os.path.dirname(sys.executable)
        
        bundled_dir_abs = os.path.abspath(os.path.join(base_dir, 'asn_specs'))

        for specs_path in search_paths:
            # Handle explicit single file
            # Handle explicit single file
            ext = os.path.splitext(specs_path)[1].lower()
            if os.path.isfile(specs_path) and ext in asn_extensions:
                protocol = os.path.splitext(os.path.basename(specs_path))[0]
                logger.info(f"Detected explicit spec file: {specs_path} (name: {protocol})")
                try:
                    compiler = asn1tools.compile_files([specs_path], codec='per')
                    new_compilers[protocol] = compiler
                    type_names = sorted(list(compiler.types.keys()))
                    
                    # File-based protocol is never grouped as "bundled" in the same way
                    new_metadata[protocol] = ProtocolMetadata(
                        name=protocol,
                        files=[os.path.basename(specs_path)],
                        types=type_names,
                        is_bundled=False
                    )
                    logger.info(f"Successfully compiled file protocol {protocol}")
                except Exception as e:
                    logger.error(f"Error compiling file protocol {protocol}: {e}", exc_info=True)
                    errors[protocol] = str(e)
                continue

            # Handle directory
            if not os.path.isdir(specs_path):
                continue
            
            specs_dir = specs_path
            
            is_bundled = os.path.abspath(specs_dir) == bundled_dir_abs
            
            # Check if likely a direct protocol directory (contains .asn or .asn1 files)
            direct_asn_files = []
            for ext in asn_extensions:
                direct_asn_files.extend(glob.glob(os.path.join(specs_dir, f"*{ext}")))
            direct_asn_files = sorted(direct_asn_files)

            if direct_asn_files:
                # Treat this directory itself as a protocol
                protocol = os.path.basename(specs_dir)
                logger.info(f"Detected defined protocol in: {specs_dir} (name: {protocol})")
                
                try:
                    compiler = self._compile_with_warnings(direct_asn_files, codec='per')
                    new_compilers[protocol] = compiler
                    type_names = sorted(list(compiler.types.keys()))
                    new_metadata[protocol] = ProtocolMetadata(
                        name=protocol,
                        files=[os.path.basename(path) for path in direct_asn_files],
                        types=type_names,
                        is_bundled=is_bundled
                    )
                    
                    # Load JSON examples
                    json_files = sorted(glob.glob(os.path.join(specs_dir, "*.json")))
                    loaded_examples = {}
                    for jf in json_files:
                        try:
                            with open(jf, 'r') as f:
                                data = json.load(f)
                                name = os.path.splitext(os.path.basename(jf))[0]
                                loaded_examples[name] = data
                        except Exception as e:
                            print(f"Warning: Failed to load example {jf}: {e}")
                    
                    if loaded_examples:
                        new_examples[protocol] = loaded_examples
                    
                    logger.info(f"Successfully compiled direct protocol {protocol}")
                except Exception as e:
                    logger.error(f"Error compiling direct protocol {protocol}: {e}", exc_info=True)
                    errors[protocol] = str(e)
            
            # Also scan subdirectories (normal structure)
            subdirs = [d for d in os.listdir(specs_dir) 
                       if os.path.isdir(os.path.join(specs_dir, d))]

            for protocol in subdirs:
                proto_path = os.path.join(specs_dir, protocol)
                asn_files = []
                for ext in asn_extensions:
                    asn_files.extend(glob.glob(os.path.join(proto_path, f"*{ext}")))
                asn_files = sorted(asn_files)
                
                if asn_files:
                    logger.info(f"Compiling protocol: {protocol} with files: {asn_files}")
                    try:
                        compiler = self._compile_with_warnings(asn_files, codec='per')
                        new_compilers[protocol] = compiler
                        type_names = sorted(list(compiler.types.keys()))
                        new_metadata[protocol] = ProtocolMetadata(
                            name=protocol,
                            files=[os.path.relpath(path, specs_dir) for path in asn_files],
                            types=type_names,
                            is_bundled=is_bundled
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
                                logger.warning(f"Failed to load example {jf}: {e}")
                        
                        if loaded_examples:
                            new_examples[protocol] = loaded_examples
                            logger.info(f"Loaded {len(loaded_examples)} examples for {protocol}")

                        logger.info(f"Successfully compiled {protocol}")
                    except Exception as e:
                        logger.error(f"Error compiling {protocol}: {e}", exc_info=True)
                        errors[protocol] = str(e)
                        # Retain old version if available
                        if protocol in self.compilers:
                            logger.warning(f"Retaining previous version of {protocol}")
                            new_compilers[protocol] = self.compilers[protocol]
                            new_metadata[protocol] = self.metadata[protocol]
                            if protocol in self.examples:
                                new_examples[protocol] = self.examples[protocol]
        
        self.compilers = new_compilers
        self.metadata = new_metadata
        self.examples = new_examples
        self._current_paths = list(search_paths)
        self._snapshot_state = self._capture_snapshot(self._current_paths)
        self._last_snapshot_check = time.monotonic()
        
        return errors

    def get_compiler(self, protocol: str) -> Optional[asn1tools.compiler.Specification]:
        with self._lock:
            self._ensure_latest_locked()
            return self.compilers.get(protocol)

    def reload(self) -> Dict[str, str]:
        with self._lock:
            # Reload config in case it changed
            config_manager.reload()
            return self._load_protocols_locked()

    def list_protocols(self) -> List[str]:
        with self._lock:
            self._ensure_latest_locked()
            return list(self.compilers.keys())

    def get_protocol_metadata(self, protocol: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            self._ensure_latest_locked()
            meta = self.metadata.get(protocol)
            return meta.to_dict() if meta else None

    def list_metadata(self) -> List[Dict[str, Any]]:
        with self._lock:
            self._ensure_latest_locked()
            return [meta.to_dict() for meta in self.metadata.values()]

    def get_examples(self, protocol: str) -> Dict[str, Any]:
        with self._lock:
            self._ensure_latest_locked()
            return self.examples.get(protocol, {})
    
    def _get_protocol_path_locked(self, protocol: str) -> Optional[str]:
        search_paths = self._current_paths or self._resolve_specs_paths()
        for specs_dir in search_paths:
            if not os.path.isdir(specs_dir):
                continue
            proto_path = os.path.join(specs_dir, protocol)
            if os.path.isdir(proto_path):
                return os.path.abspath(proto_path)
        return None

    def get_protocol_path(self, protocol: str) -> Optional[str]:
        """
        Finds the absolute path on disk for a given protocol name.
        """
        with self._lock:
            self._ensure_latest_locked()
            return self._get_protocol_path_locked(protocol)

    def scan_definitions(self, protocol: str) -> Dict[str, List[str]]:
        """
        Scans .asn files in the protocol directory and returns a mapping of
        filename -> [list of defined types].
        """
        with self._lock:
            self._ensure_latest_locked()
            path = self._get_protocol_path_locked(protocol)
        if not path:
            return {}

        config = config_manager.get()
        asn_extensions = set(config.asn_extensions)
        
        result = {}
        asn_files = []
        if os.path.isfile(path):
             asn_files = [path]
        else:
             for ext in asn_extensions:
                 asn_files.extend(glob.glob(os.path.join(path, f"*{ext}")))
        asn_files = sorted(asn_files)

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
