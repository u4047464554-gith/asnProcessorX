import os
import json
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class AppConfig(BaseModel):
    specs_directories: List[str] = ["asn_specs"]
    asn_extensions: List[str] = [".asn", ".asn1"]
    server_port: int = 0  # 0 for ephemeral
    server_host: str = "127.0.0.1"
    log_level: str = "INFO"
    splash_duration: int = 10000
    saved_messages_dir: str = "saved_messages"
    msc_storage_path: Optional[str] = None  # None for default (backend/msc_storage)

    model_config = ConfigDict(extra="ignore")

class ConfigManager:
    def __init__(self):
        # Store config in APPDATA/AsnProcessor/config.json
        if os.name == 'nt':
            self.config_dir = os.path.join(os.getenv('APPDATA'), 'AsnProcessor')
        else:
            self.config_dir = os.path.expanduser('~/.config/asn_processor')
            
        if not os.path.exists(self.config_dir):
            try:
                os.makedirs(self.config_dir)
            except OSError:
                pass
                
        self.config_file = os.path.join(self.config_dir, 'config.json')
        self.config = self.load()

    def load(self) -> AppConfig:
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    data = json.load(f)
                    return AppConfig(**data)
            except Exception as e:
                print(f"Error loading config: {e}")
                return AppConfig()
        return AppConfig()

    def save(self, config: AppConfig):
        try:
            with open(self.config_file, 'w') as f:
                json.dump(config.model_dump(), f, indent=2)
            self.config = config
        except Exception as e:
            print(f"Error saving config: {e}")

    def get(self) -> AppConfig:
        return self.config

    def reload(self) -> AppConfig:
        self.config = self.load()
        return self.config

    def update(self, **kwargs):
        current = self.config.model_dump()
        current.update(kwargs)
        self.save(AppConfig(**current))

    def get_messages_path(self) -> str:
        path = self.config.saved_messages_dir
        if os.path.isabs(path):
            return path
        return os.path.join(self.config_dir, path)
    
    def get_msc_storage_path(self) -> str:
        """Get MSC storage path from config or use default."""
        if self.config.msc_storage_path:
            path = self.config.msc_storage_path
            if os.path.isabs(path):
                return path
            # Relative to project root
            return os.path.abspath(path)
        # Default: backend/msc_storage (for backward compatibility)
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return os.path.join(base_dir, 'msc_storage')

# Singleton
config_manager = ConfigManager()

