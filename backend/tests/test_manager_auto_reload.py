import textwrap

from backend.core.config import AppConfig, config_manager
from backend.core.manager import AsnManager


def _write_protocol(root, name: str):
    proto_dir = root / name
    proto_dir.mkdir()
    type_name = f"{name.capitalize()}Message"
    source = textwrap.dedent(
        f"""
        {name.upper()} DEFINITIONS AUTOMATIC TAGS ::= BEGIN

        {type_name} ::= INTEGER (0..255)

        END
        """
    ).strip()
    (proto_dir / f"{name}.asn").write_text(source)
    return proto_dir


def test_manager_detects_new_protocol_without_manual_reload(tmp_path, monkeypatch):
    specs_root = tmp_path / "specs"
    specs_root.mkdir()
    _write_protocol(specs_root, "alpha")

    monkeypatch.setattr(
        config_manager,
        "config",
        AppConfig(specs_directories=[str(specs_root)]),
        raising=False,
    )

    mgr = AsnManager()
    assert "alpha" in mgr.list_protocols()

    _write_protocol(specs_root, "beta")
    mgr._snapshot_interval = 0

    protocols = mgr.list_protocols()
    assert "beta" in protocols
    assert mgr.get_compiler("beta") is not None

