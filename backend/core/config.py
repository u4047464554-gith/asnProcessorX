import os
import json
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class AppConfig(BaseModel):
    specs_directories: List[str] = ["asn_specs"]
    server_port: int = 0  # 0 for ephemeral
    server_host: str = "127.0.0.1"
    log_level: str = "INFO"

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

# Singleton
config_manager = ConfigManager()

