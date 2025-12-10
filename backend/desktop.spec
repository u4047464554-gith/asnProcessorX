# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from PyInstaller.utils.hooks import copy_metadata, collect_all

block_cipher = None

# Collect metadata for packages that use entry points or metadata (like versions)
datas = []
datas += copy_metadata('uvicorn')
datas += copy_metadata('fastapi')
datas += copy_metadata('asn1tools')

# Collect all of asn1tools (including source from editable install)
asn1tools_datas, asn1tools_binaries, asn1tools_hiddenimports = collect_all('asn1tools')
datas += asn1tools_datas

# We need to add the project root and sources/asn1tools to pathex
# Assuming we run pyinstaller from 'backend/' directory, '..' is the root.
pathex = [os.path.abspath('..'), os.path.abspath('../sources/asn1tools')]

a = Analysis(
    ['desktop_main.py'],
    pathex=pathex,
    binaries=asn1tools_binaries,
    datas=datas,
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'engineio.async_drivers.asgi',
        'fastapi',
        'starlette',
        'backend', # Ensure backend package is included
        'backend.main',
        'backend.routers',
        'backend.routers.asn',
        'backend.core',
        'backend.core.manager',
        'backend.core.tracer',
        'backend.core.codegen',
        'backend.core.serialization',
        'backend.core.asn1_runtime',
        'backend.core.type_tree',
        # asn1tools and its submodules (editable install from sources/asn1tools)
        'asn1tools',
        'asn1tools.parser',
        'asn1tools.compiler',
        'asn1tools.codecs',
        'asn1tools.codecs.per',
        'asn1tools.codecs.uper',
        'asn1tools.codecs.ber',
        'asn1tools.codecs.der',
        'asn1tools.codecs.jer',
        'asn1tools.codecs.oer',
        'asn1tools.codecs.xer',
        'asn1tools.codecs.compiler',
        'asn1tools.codecs.constraints_checker',
        'asn1tools.source',
    ] + asn1tools_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='asn_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True, # Set to False to hide console window, but we need stdout for now
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
