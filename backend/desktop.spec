# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from PyInstaller.utils.hooks import copy_metadata

block_cipher = None

# Collect metadata for packages that use entry points or metadata (like versions)
datas = []
datas += copy_metadata('uvicorn')
datas += copy_metadata('fastapi')
datas += copy_metadata('asn1tools')

# We need to add the project root to pathex so 'backend' package can be found
# Assuming we run pyinstaller from 'backend/' directory, '..' is the root.
pathex = [os.path.abspath('..')]

a = Analysis(
    ['desktop_main.py'],
    pathex=pathex,
    binaries=[],
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
    ],
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
