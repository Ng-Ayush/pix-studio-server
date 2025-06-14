const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV !== 'production';

let mainWindow;
let serverProcess;
let serverPort;

// Disable logging in production
if (!isDev) {
    app.commandLine.appendSwitch('disable-logging');
}

function startServer() {
    console.log('Starting server...');
    // Get the correct path for server.js
    const serverPath = isDev ? path.join(__dirname, 'server.js') : path.join(process.resourcesPath, 'server.js');
    console.log('Server path:', serverPath);
    
    try {
        serverProcess = spawn('node', [serverPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { 
                ...process.env, 
                NODE_ENV: isDev ? 'development' : 'production'
            },
            windowsHide: true,
            shell: false,
            windowsVerbatimArguments: true
        });

        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            if (isDev) {
                console.log(`Server: ${output}`);
            }
            
            // Check if the server has started successfully
            if (output.includes('Server is running on port')) {
                const portMatch = output.match(/port (\d+)/);
                if (portMatch) {
                    serverPort = parseInt(portMatch[1]);
                    if (isDev) {
                        console.log(`Server started on port ${serverPort}`);
                    }
                    createWindow();
                }
            }
        });

        serverProcess.stderr.on('data', (data) => {
            if (isDev) {
                console.error(`Server Error: ${data}`);
            }
        });

        serverProcess.on('error', (error) => {
            if (isDev) {
                console.error('Failed to start server:', error);
            }
            createWindow();
        });

        serverProcess.on('exit', (code) => {
            if (isDev) {
                console.log(`Server process exited with code ${code}`);
            }
        });
    } catch (error) {
        if (isDev) {
            console.error('Error starting server:', error);
        }
        createWindow();
    }
}

function createWindow() {
    try {
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false,
                enableRemoteModule: true
            },
            icon: path.join(__dirname, 'assets/icon.ico')
        });

        mainWindow.once('ready-to-show', () => {
            mainWindow.show();
            mainWindow.focus();
        });

        // In development, load from Angular dev server
        if (isDev) {
            mainWindow.loadURL('http://localhost:4200');
            mainWindow.webContents.openDevTools();
        } else {
            // In production, load the built Angular app
            const indexPath = path.join(process.resourcesPath, 'pix-studio-pro/dist/pix-studio-pro/index.html');
            
            // Check if file exists
            const fs = require('fs');
            if (!fs.existsSync(indexPath)) {
                // Try alternative path
                const altPath = path.join(__dirname, 'pix-studio-pro/dist/pix-studio-pro/index.html');
                if (fs.existsSync(altPath)) {
                    loadIndexFile(altPath);
                }
            } else {
                loadIndexFile(indexPath);
            }
        }

        mainWindow.webContents.on('did-fail-load', () => {
            if (isDev) {
                console.error('Failed to load window');
            }
            mainWindow.reload();
        });

        mainWindow.on('closed', () => {
            mainWindow = null;
        });

        // Handle external URLs
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            if (url.startsWith('http')) {
                shell.openExternal(url);
                return { action: 'deny' };
            }
            return { action: 'allow' };
        });
    } catch (error) {
        if (isDev) {
            console.error('Error creating window:', error);
        }
    }
}

function loadIndexFile(indexPath) {
    try {
        const fs = require('fs');
        let htmlContent = fs.readFileSync(indexPath, 'utf8');
        
        // Inject the server port before loading the app
        const scriptTag = `<script>window.SERVER_PORT = ${serverPort || 3000};</script>`;
        htmlContent = htmlContent.replace('</head>', `${scriptTag}</head>`);
        
        // Write the modified content to a temporary file
        const tempPath = path.join(process.resourcesPath, 'temp-index.html');
        fs.writeFileSync(tempPath, htmlContent);
        
        // Load the modified file
        mainWindow.loadFile(tempPath);
    } catch (error) {
        if (isDev) {
            console.error('Error loading index file:', error);
        }
    }
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(startServer);
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (serverProcess) {
            serverProcess.kill();
        }
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle file upload dialog
ipcMain.handle('open-file-dialog', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections']
    });
    return result.filePaths;
});

// Handle file save dialog
ipcMain.handle('save-file-dialog', async (event, defaultPath) => {
    const { dialog } = require('electron');
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultPath
    });
    return result.filePath;
});