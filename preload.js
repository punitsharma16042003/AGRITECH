const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Database IPC
    query: (sql, params = []) => ipcRenderer.invoke('db-query', sql, params),
    run: (sql, params = []) => ipcRenderer.invoke('db-run', sql, params),
    
    // Backup IPC
    backupCreate: () => ipcRenderer.invoke('backup-create'),
    backupList: () => ipcRenderer.invoke('backup-list'),
    backupRestore: (filename) => ipcRenderer.invoke('backup-restore', filename),
    
    // File Management IPC
    saveFile: (filters) => ipcRenderer.invoke('save-file-dialog', filters),
    
    // Notification IPC
    showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body)
});
