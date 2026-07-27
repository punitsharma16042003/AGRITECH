const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess = null;

const DATA_DIR = path.join(__dirname, 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents');

// Ensure frontend assets directories exist
function initializeDirectories() {
    [DATA_DIR, IMAGES_DIR, DOCUMENTS_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// Start database background server using host Node
function startDatabaseServer() {
    return new Promise((resolve) => {
        initializeDirectories();
        
        const serverScript = path.join(__dirname, 'db_server.js');
        console.log('Spawning SQLite server with host Node at:', serverScript);

        // Spawn using shell to correctly locate node command on Windows path
        serverProcess = spawn('node', [serverScript], { 
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'] 
        });

        serverProcess.stdout.on('data', (data) => {
            console.log(`[Server Stdout]: ${data}`);
        });

        serverProcess.stderr.on('data', (data) => {
            console.error(`[Server Stderr]: ${data}`);
        });

        serverProcess.on('close', (code) => {
            console.log(`SQLite Server process exited with code ${code}`);
        });

        // Poll ping URL until server responds or we timeout
        let attempts = 0;
        const maxAttempts = 30; // 3 seconds total

        const checkPing = () => {
            sendRequest('/ping', 'GET')
                .then(() => {
                    console.log('SQLite backend micro-server is online and responsive!');
                    resolve(true);
                })
                .catch(() => {
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkPing, 100);
                    } else {
                        console.error('Failed to connect to SQLite backend server (Timeout).');
                        resolve(false);
                    }
                });
        };

        // Give it 100ms before first ping
        setTimeout(checkPing, 100);
    });
}

// Helper to communicate with local SQLite micro-server
function sendRequest(apiPath, method, body = null) {
    return new Promise((resolve, reject) => {
        const postData = body ? JSON.stringify(body) : '';
        const options = {
            hostname: '127.0.0.1',
            port: 3030,
            path: apiPath,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    reject(new Error(`Server error (${res.statusCode}): ${data}`));
                } else {
                    try {
                        resolve(JSON.parse(data));
                    } catch(e) {
                        resolve(data); // If not JSON (e.g. text/plain)
                    }
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (body) {
            req.write(postData);
        }
        req.end();
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        title: 'Agritech v1.0',
        autoHideMenuBar: true
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    // Optional: Open DevTools for debugging renderer side
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App lifecycle hooks
app.whenReady().then(async () => {
    const serverStarted = await startDatabaseServer();
    if (!serverStarted) {
        dialog.showErrorBox('Database Connection Error', 'Failed to connect to local SQLite database server. Please ensure Node.js is installed on your PATH and launch start.bat again.');
    }
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    // Kill database child process cleanly
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handler routes linking renderer directly to db_server HTTP routes
ipcMain.handle('db-query', async (event, sql, params) => {
    try {
        return await sendRequest('/query', 'POST', { sql, params });
    } catch(err) {
        console.error('IPC query failed:', err.message);
        throw err;
    }
});

ipcMain.handle('db-run', async (event, sql, params) => {
    try {
        return await sendRequest('/run', 'POST', { sql, params });
    } catch(err) {
        console.error('IPC run failed:', err.message);
        throw err;
    }
});

ipcMain.handle('backup-create', async () => {
    try {
        return await sendRequest('/backup/create', 'POST');
    } catch(err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('backup-list', async () => {
    try {
        return await sendRequest('/backup/list', 'GET');
    } catch(err) {
        console.error('IPC fetch backups list failed:', err.message);
        return [];
    }
});

ipcMain.handle('backup-restore', async (event, filename) => {
    try {
        return await sendRequest('/backup/restore', 'POST', { filename });
    } catch(err) {
        return { success: false, error: err.message };
    }
});

// Native file dialog saving images/docs
ipcMain.handle('save-file-dialog', async (event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: filters || [
            { name: 'All Files', extensions: ['*'] },
            { name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'gif', 'svg'] },
            { name: 'Documents', extensions: ['pdf', 'xlsx', 'xls', 'docx', 'doc', 'txt'] }
        ]
    });
    
    if (result.canceled || result.filePaths.length === 0) return null;
    
    const srcPath = result.filePaths[0];
    const fileName = path.basename(srcPath);
    const ext = path.extname(srcPath).toLowerCase();
    
    const isImg = ['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(ext);
    const destDir = isImg ? IMAGES_DIR : DOCUMENTS_DIR;
    const uniqueName = `${Date.now()}_${fileName}`;
    const destPath = path.join(destDir, uniqueName);
    
    fs.copyFileSync(srcPath, destPath);
    const stats = fs.statSync(destPath);
    
    return {
        originalName: fileName,
        savedName: uniqueName,
        path: destPath,
        size: stats.size,
        type: isImg ? 'image' : 'document'
    };
});

ipcMain.handle('show-notification', (event, title, body) => {
    if (Notification.isSupported()) {
        new Notification({ title, body }).show();
    }
});
