from __future__ import annotations

import sys
from pathlib import Path


def _ensure_vendor_asn1tools():
    """Prefer the vendored asn1tools checkout when present.

    This allows us to patch parser/compiler behavior (e.g., X.683
    parameterization) without modifying the globally installed package.
    """

    vendor_root = Path(__file__).resolve().parents[2] / "sources" / "asn1tools"

    if not vendor_root.exists():
        return

    vendor_path = str(vendor_root)

    if vendor_path not in sys.path:
        sys.path.insert(0, vendor_path)


_ensure_vendor_asn1tools()

import asn1tools  # noqa: E402  # pylint: disable=wrong-import-position

__all__ = ["asn1tools"]











