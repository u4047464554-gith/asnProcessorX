"""
Application version information.
This module provides a single source of truth for the application version.
"""

__version__ = "0.3.0"

def get_version() -> str:
    """Get the current application version."""
    return __version__
