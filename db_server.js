const http = require('http');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.AGRITECH_DATA_DIR || path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'agritech.db');

// Ensure folders exist
function ensureDirectories() {
    [DATA_DIR, BACKUPS_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

ensureDirectories();

let db = null;
function openDb() {
    try {
        db = new DatabaseSync(DB_PATH);
        console.log(`Database connected successfully at: ${DB_PATH}`);
    } catch(err) {
        console.error('Failed to open SQLite database:', err);
        process.exit(1);
    }
}

openDb();

// Schema setup
function initializeSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT,
            investigator TEXT,
            team TEXT,
            start_date TEXT,
            end_date TEXT,
            objectives TEXT,
            status TEXT,
            notes TEXT,
            created_at TEXT
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS experiments (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            type TEXT,
            name TEXT,
            status TEXT,
            start_date TEXT,
            end_date TEXT,
            notes TEXT,
            control_notes TEXT,
            treatment_notes TEXT,
            created_at TEXT
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS observations (
            id TEXT PRIMARY KEY,
            experiment_id TEXT,
            group_type TEXT,
            observation_date TEXT,
            data TEXT,
            created_at TEXT
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS water_samples (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            sample_name TEXT,
            register_date TEXT,
            source TEXT,
            location TEXT,
            collected_by TEXT,
            data TEXT,
            wqi_score REAL,
            wqi_class TEXT,
            created_at TEXT
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT,
            description TEXT,
            due_date TEXT,
            priority TEXT,
            status TEXT,
            related_project_id TEXT,
            related_experiment_id TEXT,
            checklist TEXT,
            comments TEXT,
            reminder TEXT,
            attachments TEXT,
            created_at TEXT
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS sticky_notes (
            id TEXT PRIMARY KEY,
            content TEXT,
            color TEXT,
            created_at TEXT
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            type TEXT,
            name TEXT,
            data TEXT,
            created_at TEXT
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS gallery (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            experiment_id TEXT,
            file_path TEXT,
            file_name TEXT,
            file_type TEXT,
            file_size INTEGER,
            description TEXT,
            created_at TEXT
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);
}

initializeSchema();

// Backup logic
function createAutomaticBackup() {
    try {
        const dateStr = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
        const filename = `agritech_backup_${dateStr}.db`;
        const destPath = path.join(BACKUPS_DIR, filename);
        
        fs.copyFileSync(DB_PATH, destPath);
        console.log('Automated SQLite database backup created:', destPath);
        pruneBackups();
    } catch (error) {
        console.error('Failed to create automatic backup:', error);
    }
}

function pruneBackups() {
    fs.readdir(BACKUPS_DIR, (err, files) => {
        if (err) return;
        const backupFiles = files
            .filter(f => f.startsWith('agritech_backup_') && f.endsWith('.db'))
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        if (backupFiles.length > 5) {
            for (let i = 5; i < backupFiles.length; i++) {
                fs.unlink(path.join(BACKUPS_DIR, backupFiles[i].name), (err) => {
                    if (err) console.error('Failed to delete old backup:', err);
                });
            }
        }
    });
}

// Create startup backup
createAutomaticBackup();

// HTTP Micro Server setup
const server = http.createServer((req, res) => {
    // Set headers
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            let payload = {};
            try {
                if (body) payload = JSON.parse(body);
            } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
                return;
            }

            if (req.url === '/query') {
                const { sql, params } = payload;
                try {
                    const stmt = db.prepare(sql);
                    const rows = stmt.all(...(params || []));
                    res.end(JSON.stringify(rows));
                } catch (err) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: err.message, sql, params }));
                }
            } else if (req.url === '/run') {
                const { sql, params } = payload;
                try {
                    const stmt = db.prepare(sql);
                    const result = stmt.run(...(params || []));
                    res.end(JSON.stringify({
                        changes: result?.changes ?? 1,
                        lastInsertRowid: result?.lastInsertRowid ?? null
                    }));
                } catch (err) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: err.message, sql, params }));
                }
            } else if (req.url === '/backup/create') {
                try {
                    createAutomaticBackup();
                    res.end(JSON.stringify({ success: true, message: 'Backup created successfully!' }));
                } catch (err) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: err.message }));
                }
            } else if (req.url === '/backup/restore') {
                const { filename } = payload;
                try {
                    const srcPath = path.join(BACKUPS_DIR, filename);
                    if (!fs.existsSync(srcPath)) throw new Error('Backup file not found.');

                    db.close(); // Close DB connection before restoring
                    
                    fs.copyFileSync(srcPath, DB_PATH);
                    openDb(); // Reopen connection

                    res.end(JSON.stringify({ success: true, message: 'Database restored successfully!' }));
                } catch (err) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: err.message }));
                }
            } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Endpoint not found' }));
            }
        });
    } else if (req.method === 'GET') {
        if (req.url === '/ping') {
            res.end(JSON.stringify({ status: 'alive' }));
        } else if (req.url === '/backup/list') {
            try {
                if (!fs.existsSync(BACKUPS_DIR)) {
                    res.end(JSON.stringify([]));
                    return;
                }
                const files = fs.readdirSync(BACKUPS_DIR);
                const backups = files
                    .filter(f => f.startsWith('agritech_backup_'))
                    .map(f => {
                        const filePath = path.join(BACKUPS_DIR, f);
                        const stats = fs.statSync(filePath);
                        return {
                            filename: f,
                            path: filePath,
                            size: stats.size,
                            date: stats.mtime.toLocaleString()
                        };
                    })
                    .sort((a, b) => b.filename.localeCompare(a.filename));
                res.end(JSON.stringify(backups));
            } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
            }
        } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Endpoint not found' }));
        }
    } else {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
});

server.listen(3030, '127.0.0.1', () => {
    console.log('SQLite backend micro-server listening on port 3030');
});

// Graceful exit triggers to avoid orphaned processes
process.on('disconnect', () => {
    createAutomaticBackup();
    process.exit(0);
});

process.stdin.resume();
process.stdin.on('end', () => {
    createAutomaticBackup();
    process.exit(0);
});
