const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess = null;
let buffer = '';
let isBackendReady = false;

// Log setup to C:\Users\User\AsnProcessorLogs
const logDir = path.join(process.env.USERPROFILE, 'AsnProcessorLogs');
if (!fs.existsSync(logDir)) {
    try { fs.mkdirSync(logDir); } catch(e) {}
}
const logPath = path.join(logDir, 'electron.log');

function log(msg) {
    try {
        const text = `[${new Date().toISOString()}] ${msg}\n`;
        fs.appendFileSync(logPath, text);
    } catch(e) {}
    console.log(msg);
}

let splashDuration = 10000;
try {
    const configPath = process.platform === 'win32' 
        ? path.join(process.env.APPDATA, 'AsnProcessor', 'config.json')
        : path.join(process.env.HOME, '.config', 'asn_processor', 'config.json');
        
    if (fs.existsSync(configPath)) {
        const conf = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (conf.splash_duration !== undefined) {
            splashDuration = conf.splash_duration;
        }
    }
} catch (e) {
    log(`Config read error: ${e.message}`);
}
log(`Splash duration: ${splashDuration}ms`);
let startTime = Date.now();

log('--- Electron Process Starting ---');

const isDev = process.env.NODE_ENV === 'development';
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    log('Second instance detected, quitting');
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        log('App Ready');
        startBackendAndWindow();
        
        globalShortcut.register('CommandOrControl+Shift+I', () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
        });
    });
}

function createWindow() {
    log('Creating window...');
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "ASN.1 Processor",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        autoHideMenuBar: true,
        show: false,
        backgroundColor: '#ffffff'
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.show();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'splash.html'));
        mainWindow.once('ready-to-show', () => {
            mainWindow.show();
        });
    }

    mainWindow.on('closed', () => {
        // Clean up backend process when window closes
        if (backendProcess) {
            log('Window closed, killing backend process');
            try {
                backendProcess.kill();
            } catch (e) {
                log(`Error killing backend: ${e.message}`);
            }
            backendProcess = null;
        }
        mainWindow = null;
    });
}

function startBackendAndWindow() {
    startTime = Date.now();
    if (isDev) {
        createWindow();
        return;
    }
    createWindow(); 

    // Clean up any existing backend process
    if (backendProcess) {
        log('Cleaning up existing backend process');
        try {
            backendProcess.kill();
            backendProcess = null;
        } catch (e) {
            log(`Error killing existing backend: ${e.message}`);
        }
    }
    
    isBackendReady = false;
    buffer = '';

    let backendPath;
    if (process.platform === 'win32') {
        backendPath = path.join(process.resourcesPath, 'asn_backend.exe');
    } else {
        backendPath = path.join(process.resourcesPath, 'asn_backend');
    }

    log(`Spawning backend: ${backendPath}`);
    const distPath = path.join(process.resourcesPath, 'dist');
    log(`Frontend Dist Path: ${distPath}`);
    
    try {
        backendProcess = spawn(backendPath, [distPath]);
    } catch (e) {
        log(`Failed to spawn: ${e.message}`);
        reportError(`Spawn failed: ${e.message}`);
        return;
    }

    // Open DevTools in production to see if page loads
    if (mainWindow) mainWindow.webContents.openDevTools();

    const timeout = setTimeout(() => {
        if (!isBackendReady) {
            log('Timeout waiting for backend');
            reportError("Timeout waiting for backend.\nCheck logs in " + logDir);
        }
    }, 15000);

    backendProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        buffer += chunk;
        
        // Log first few lines
        if (buffer.length < 2000) log(`Backend STDOUT: ${chunk.trim()}`);

        if (!isBackendReady) {
            const match = buffer.match(/SERVER_READY: (\d+)/);
            if (match) {
                isBackendReady = true;
                clearTimeout(timeout);
                const port = match[1];
                log(`Backend ready on port ${port}`);
                
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, splashDuration - elapsed);
                log(`Waiting ${remaining}ms for splash...`);

                setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed() && isBackendReady) {
                        const url = `http://127.0.0.1:${port}`;
                        log(`Navigating to ${url}`);
                        mainWindow.loadURL(url).catch((err) => {
                            log(`Failed to load URL: ${err.message}`);
                            reportError(`Failed to load application: ${err.message}`);
                        });
                    }
                }, remaining);
            }
        }
    });

    backendProcess.stderr.on('data', (data) => {
        log(`Backend STDERR: ${data.toString().trim()}`);
    });

    backendProcess.on('close', (code) => {
        log(`Backend exited with code ${code}`);
        backendProcess = null; // Clear reference
        if (!isBackendReady) {
            // Backend died before ready - show error
            clearTimeout(timeout);
            reportError(`Backend exited with code ${code} before startup.\nCheck logs in ${logDir}`);
        } else if (code !== 0 && code !== null && mainWindow && !mainWindow.isDestroyed()) {
            // Backend died after ready - show error
            reportError(`Backend process exited unexpectedly (code ${code}).\nCheck logs in ${logDir}`);
        }
    });
    
    backendProcess.on('error', (err) => {
        log(`Backend process error: ${err.message}`);
        clearTimeout(timeout);
        backendProcess = null; // Clear reference
        reportError(`Process error: ${err.message}`);
    });
}

function reportError(msg) {
    if (!mainWindow) return;
    const errorHtml = `
      data:text/html;charset=utf-8,
      <html><body>
        <h2 style="color:red">Startup Error</h2>
        <pre>${msg}</pre>
        <p>Logs: ${logDir}</p>
      </body></html>
    `;
    mainWindow.loadURL(errorHtml);
}

app.on('window-all-closed', () => {
    // Clean up backend before quitting
    if (backendProcess) {
        log('App closing, killing backend process');
        try {
            backendProcess.kill();
            backendProcess = null;
        } catch (e) {
            log(`Error killing backend: ${e.message}`);
        }
    }
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', (event) => {
    if (backendProcess) {
        log('App will-quit, killing backend process');
        try {
            backendProcess.kill();
            backendProcess = null;
        } catch (e) {
            log(`Error killing backend: ${e.message}`);
        }
    }
});

app.on('before-quit', () => {
    if (backendProcess) {
        log('App before-quit, killing backend process');
        try {
            backendProcess.kill();
            backendProcess = null;
        } catch (e) {
            log(`Error killing backend: ${e.message}`);
        }
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) startBackendAndWindow();
});
