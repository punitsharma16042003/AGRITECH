/* Agritech v1.0 - Core Application Logic */

// Global state variables
let currentView = 'dashboard';
let activeProjectId = null;
let activeExperimentId = null;
let appSettings = {
    theme: 'dark',
    user_name: 'Dr. Sarah Connor',
    user_role: 'Lead Agricultural Researcher',
    units: 'metric',
    date_format: 'YYYY-MM-DD'
};

// Initialize app when DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
    await initSettings();
    await seedDemoDataIfEmpty();
    setupGlobalEventListeners();
    
    // Load initial view
    switchView('dashboard');
    updateNotificationCount();
});

/* ==========================================
   SETTINGS & INITIALIZATION LOGIC
   ========================================== */

async function initSettings() {
    try {
        const rows = await window.api.query("SELECT * FROM settings");
        if (rows && rows.length > 0) {
            rows.forEach(r => {
                if (r.key in appSettings) {
                    appSettings[r.key] = r.value;
                }
            });
        } else {
            // Write default settings to DB
            for (const [key, val] of Object.entries(appSettings)) {
                await window.api.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, val]);
            }
        }
    } catch (e) {
        console.warn("Could not fetch settings from DB, using defaults.", e);
    }
    
    // Apply theme
    applyTheme(appSettings.theme);
    
    // Apply user details to UI header
    const avatarEl = document.getElementById('header-user-avatar');
    const nameEl = document.getElementById('header-user-name');
    if (avatarEl && appSettings.user_name) avatarEl.textContent = appSettings.user_name.charAt(0).toUpperCase();
    if (nameEl && appSettings.user_name) nameEl.textContent = appSettings.user_name;
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
    }
    appSettings.theme = theme;
}

// Seed Demo Data so the application is immediately visual and ready
// Seed Demo Data so the application is immediately visual and ready
async function seedDemoDataIfEmpty() {
    try {
        const skipSeeding = await window.api.query("SELECT value FROM settings WHERE key = 'skip_demo_seeding'");
        if (skipSeeding && skipSeeding.length > 0 && skipSeeding[0].value === 'true') {
            console.log("Demo database seeding skipped by user settings.");
            return;
        }

        // 1. Ensure the correct 4 demo projects exist (create them if missing)
        const demoProjects = [
            { id: 'proj-hydro-01', name: 'Hydroponic Leafy Greens Study', investigator: 'Dr. Sarah Connor', team: 'A. Vance, L. Croft', start: '2026-06-01', end: '2026-08-30', objectives: 'Evaluate the impact of EC levels on nutrient absorption in Butterhead Lettuce.', status: 'active', notes: 'Funded by Agricultural Science Grant G-8891.' },
            { id: 'proj-soil-02', name: 'Soil Quality & Health Study', investigator: 'Dr. Sarah Connor', team: 'M. Faraday', start: '2026-05-10', end: '2026-11-15', objectives: 'Monitor soil macronutrient levels and evaluate borehole water salinity impact.', status: 'active', notes: 'Collaboration with Environmental Studies Department.' },
            { id: 'proj-irrigation-03', name: 'Orchard Infiltration & Irrigation Study', investigator: 'Dr. Sarah Connor', team: 'M. Faraday', start: '2026-06-10', end: '2026-10-15', objectives: 'Assessing water infiltration and sodicity effects on young pear trees.', status: 'active', notes: 'Collaboration with Environmental Studies Department.' },
            { id: 'proj-microgreens-04', name: 'Urban Microgreens Cultivation Project', investigator: 'Dr. Sarah Connor', team: 'A. Vance, L. Croft', start: '2026-07-10', end: '2026-07-25', objectives: 'Evaluating organic soil mixture versus coco coir substrate.', status: 'active', notes: 'Collaboration with local urban agriculture co-op.' }
        ];

        for (const p of demoProjects) {
            const countRow = await window.api.query("SELECT COUNT(*) as count FROM projects WHERE id = ?", [p.id]);
            if (countRow[0].count === 0) {
                await window.api.run(`
                    INSERT INTO projects (id, name, investigator, team, start_date, end_date, objectives, status, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [p.id, p.name, p.investigator, p.team, p.start, p.end, p.objectives, p.status, p.notes, new Date().toISOString()]);
            }
        }

        // 2. Ensure default demo experiments exist and point to the correct projects
        const demoExperiments = [
            { id: 'exp-butterhead-01', project_id: 'proj-hydro-01', type: 'hydroponics', name: 'Butterhead Lettuce EC Gradient Study', status: 'active', start: '2026-06-05', end: '2026-08-01', notes: 'Control group at standard EC (1.6 mS/cm). Treatment group at high EC (2.4 mS/cm).', ctrl: 'Standard nutrient dose (General Hydroponics Flora Series).', treat: 'Double dose of micro nutrients.' },
            { id: 'exp-soil-03', project_id: 'proj-soil-02', type: 'soil', name: 'Alfalfa Nitrogen Fixation Bio-Assay', status: 'active', start: '2026-05-15', end: '2026-09-01', notes: 'Testing inoculants on alfalfa root nodule formation.', ctrl: 'No soil inoculant.', treat: 'Rhizobia inoculant added on seeding.' },
            { id: 'exp-irrigation-04', project_id: 'proj-irrigation-03', type: 'irrigation', name: 'Orchard Drip Salinity Assessment', status: 'active', start: '2026-06-10', end: '2026-10-15', notes: 'Assessing water infiltration and sodicity effects on young pear trees.', ctrl: 'Irrigation using standard municipal water.', treat: 'Irrigation using borehole saline water.' },
            { id: 'exp-microgreen-02', project_id: 'proj-microgreens-04', type: 'microgreens', name: 'Radish Microgreen Yield Comparison', status: 'active', start: '2026-07-10', end: '2026-07-25', notes: 'Evaluating organic soil mixture versus coco coir substrate.', ctrl: 'Tray 1: Coco Coir Substrate.', treat: 'Tray 2: 50% Soil, 50% Compost.' }
        ];

        for (const e of demoExperiments) {
            const countRow = await window.api.query("SELECT COUNT(*) as count FROM experiments WHERE id = ?", [e.id]);
            if (countRow[0].count === 0) {
                await window.api.run(`
                    INSERT INTO experiments (id, project_id, type, name, status, start_date, end_date, notes, control_notes, treatment_notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [e.id, e.project_id, e.type, e.name, e.status, e.start, e.end, e.notes, e.ctrl, e.treat, new Date().toISOString()]);
            } else {
                // If it already exists, correct its project_id to align it with the proper project!
                await window.api.run("UPDATE experiments SET project_id = ? WHERE id = ?", [e.project_id, e.id]);
            }
        }

        // 3. Ensure observations for exp-butterhead-01 (hydroponics) exist
        const obsCheckHydro = await window.api.query("SELECT COUNT(*) as count FROM observations WHERE experiment_id = 'exp-butterhead-01'");
        if (obsCheckHydro[0].count === 0) {
            const obsDates = ['2026-06-10', '2026-06-15', '2026-06-20', '2026-06-25', '2026-07-02'];
            for (let i = 0; i < obsDates.length; i++) {
                const date = obsDates[i];
                const controlData = {
                    ph: (6.0 + (Math.random() * 0.4 - 0.2)).toFixed(2),
                    ec: (1.6 + (Math.random() * 0.1 - 0.05)).toFixed(2),
                    tds: (800 + Math.random() * 50 - 25).toFixed(0),
                    do: (8.1 + Math.random() * 0.4).toFixed(1),
                    temperature: (22.5 + Math.random() * 1.5).toFixed(1),
                    orp: (250 + Math.random() * 20).toFixed(0),
                    salinity: (0.8 + Math.random() * 0.1).toFixed(2),
                    specific_gravity: "1.001",
                    air_temp: (24.0 + Math.random() * 2.0).toFixed(1),
                    humidity: (55 + Math.random() * 10).toFixed(0),
                    light_intensity: (450 + i * 20).toFixed(0),
                    plant_height: (5 + i * 4.2).toFixed(1),
                    root_length: (4 + i * 3.1).toFixed(1),
                    leaf_count: (4 + i * 3).toFixed(0),
                    fresh_weight: (10 + i * 22).toFixed(1),
                    dry_weight: (0.8 + i * 2.1).toFixed(2),
                    chlorophyll: (38 + i * 2.5).toFixed(1),
                    health_score: (80 + i * 2.5).toFixed(0)
                };
                const treatmentData = {
                    ph: (6.1 + (Math.random() * 0.4 - 0.2)).toFixed(2),
                    ec: (2.4 + (Math.random() * 0.1 - 0.05)).toFixed(2),
                    tds: (1200 + Math.random() * 50 - 25).toFixed(0),
                    do: (7.9 + Math.random() * 0.4).toFixed(1),
                    temperature: (22.8 + Math.random() * 1.5).toFixed(1),
                    orp: (265 + Math.random() * 20).toFixed(0),
                    salinity: (1.2 + Math.random() * 0.1).toFixed(2),
                    specific_gravity: "1.002",
                    air_temp: (24.0 + Math.random() * 2.0).toFixed(1),
                    humidity: (55 + Math.random() * 10).toFixed(0),
                    light_intensity: (450 + i * 20).toFixed(0),
                    plant_height: (4.8 + i * 5.4).toFixed(1),
                    root_length: (3.5 + i * 2.5).toFixed(1),
                    leaf_count: (4 + i * 4).toFixed(0),
                    fresh_weight: (8 + i * 28).toFixed(1),
                    dry_weight: (0.7 + i * 2.8).toFixed(2),
                    chlorophyll: (42 + i * 3.0).toFixed(1),
                    health_score: (82 + i * 3).toFixed(0)
                };
                await window.api.run(`
                    INSERT INTO observations (id, experiment_id, group_type, observation_date, data, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [`obs-c-${i}`, 'exp-butterhead-01', 'control', date, JSON.stringify(controlData), new Date().toISOString()]);
                await window.api.run(`
                    INSERT INTO observations (id, experiment_id, group_type, observation_date, data, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [`obs-t-${i}`, 'exp-butterhead-01', 'treatment', date, JSON.stringify(treatmentData), new Date().toISOString()]);
            }
        }

        // 4. Ensure observations for exp-irrigation-04 (irrigation) exist
        const obsCheckIrr = await window.api.query("SELECT COUNT(*) as count FROM observations WHERE experiment_id = 'exp-irrigation-04'");
        if (obsCheckIrr[0].count === 0) {
            const obsDates = ['2026-06-10', '2026-06-15', '2026-06-20', '2026-06-25', '2026-07-02'];
            for (let i = 0; i < obsDates.length; i++) {
                const date = obsDates[i];
                const controlData = {
                    ph: (7.2 + (Math.random() * 0.2 - 0.1)).toFixed(2),
                    ec: (0.45 + (Math.random() * 0.05 - 0.025)).toFixed(2),
                    tds: (290 + Math.random() * 20 - 10).toFixed(0),
                    sodium: (1.2 + Math.random() * 0.2).toFixed(2),
                    calcium: (2.0 + Math.random() * 0.3).toFixed(2),
                    magnesium: (1.0 + Math.random() * 0.2).toFixed(2),
                    carbonate: (0.1 + Math.random() * 0.05).toFixed(2),
                    bicarbonate: (2.5 + Math.random() * 0.3).toFixed(2)
                };
                const treatmentData = {
                    ph: (8.1 + (Math.random() * 0.2 - 0.1)).toFixed(2),
                    ec: (1.85 + (Math.random() * 0.1 - 0.05)).toFixed(2),
                    tds: (1200 + Math.random() * 50 - 25).toFixed(0),
                    sodium: (8.5 + Math.random() * 0.8).toFixed(2),
                    calcium: (4.1 + Math.random() * 0.4).toFixed(2),
                    magnesium: (2.0 + Math.random() * 0.2).toFixed(2),
                    carbonate: (1.0 + Math.random() * 0.1).toFixed(2),
                    bicarbonate: (3.8 + Math.random() * 0.4).toFixed(2)
                };
                await window.api.run(`
                    INSERT INTO observations (id, experiment_id, group_type, observation_date, data, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [`obs-ir-c-${i}`, 'exp-irrigation-04', 'control', date, JSON.stringify(controlData), new Date().toISOString()]);
                await window.api.run(`
                    INSERT INTO observations (id, experiment_id, group_type, observation_date, data, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [`obs-ir-t-${i}`, 'exp-irrigation-04', 'treatment', date, JSON.stringify(treatmentData), new Date().toISOString()]);
            }
        }

        // 5. Ensure default Water Samples (Laboratory records) exist
        const sampleCheck = await window.api.query("SELECT COUNT(*) as count FROM water_samples WHERE id = 'sample-01'");
        if (sampleCheck[0].count === 0) {
            const w1_data = {
                ph: 7.2, ec: 450, tds: 290, tss: 15, turbidity: 2.1, temperature: 21.0, colour: "Clear", odour: "None",
                do: 7.8, bod: 2.0, cod: 8.5, alkalinity: 120, hardness: 150, chloride: 45, sulphate: 30, fluoride: 0.5,
                nitrate: 4.5, nitrite: 0.02, ammonia: 0.05, total_nitrogen: 6.2, orthophosphate: 0.12, total_phosphorus: 0.25,
                oil_grease: 0.1, phenol: 0.001, cyanide: 0.001, total_coliform: 2, fecal_coliform: 0, e_coli: 0
            };
            await window.api.run(`
                INSERT INTO water_samples (id, project_id, sample_name, register_date, source, location, collected_by, data, wqi_score, wqi_class, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                'sample-01', 'proj-soil-02', 'Borehole Tap Water Inlet 1', '2026-07-15', 'Borehole Well', 'North Orchard block B', 'M. Faraday',
                JSON.stringify(w1_data), 32.4, 'Excellent Water', new Date().toISOString()
            ]);

            const w2_data = {
                ph: 8.1, ec: 1850, tds: 1200, tss: 45, turbidity: 12.0, temperature: 24.5, colour: "Light Yellow", odour: "Earthy",
                do: 5.2, bod: 12.5, cod: 42.0, alkalinity: 320, hardness: 410, chloride: 280, sulphate: 190, fluoride: 1.2,
                nitrate: 22.0, nitrite: 0.8, ammonia: 2.4, total_nitrogen: 28.5, orthophosphate: 4.1, total_phosphorus: 5.6,
                oil_grease: 2.5, phenol: 0.02, cyanide: 0.01, total_coliform: 450, fecal_coliform: 120, e_coli: 48
            };
            await window.api.run(`
                INSERT INTO water_samples (id, project_id, sample_name, register_date, source, location, collected_by, data, wqi_score, wqi_class, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                'sample-02', 'proj-soil-02', 'Irrigation Feed Canal Outlet', '2026-07-16', 'Open Canal', 'Plot D Field Border', 'M. Faraday',
                JSON.stringify(w2_data), 142.8, 'Poor Water', new Date().toISOString()
            ]);
        }

        // 6. Ensure default Tasks exist
        const taskCheck = await window.api.query("SELECT COUNT(*) as count FROM tasks WHERE id = 'task-1'");
        if (taskCheck[0].count === 0) {
            await window.api.run(`
                INSERT INTO tasks (id, title, description, due_date, priority, status, related_project_id, related_experiment_id, checklist, comments, reminder, attachments, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                'task-1', 'Calibrate pH & EC Prods', 'Calibrate laboratory glass electrodes with standard pH 4.01, 7.00, and 10.01 buffers and check EC probe with 1413 uS/cm solution.',
                new Date().toISOString().split('T')[0], 'high', 'todo', 'proj-hydro-01', 'exp-butterhead-01', 
                JSON.stringify([{text: 'pH probe calibration', checked: false}, {text: 'EC probe calibration', checked: false}, {text: 'Log calibration records', checked: false}]),
                JSON.stringify([{user: 'Sarah', text: 'Please complete before logging today observations.', date: new Date().toLocaleDateString()}]),
                new Date().toISOString(), JSON.stringify([]), new Date().toISOString()
            ]);

            await window.api.run(`
                INSERT INTO tasks (id, title, description, due_date, priority, status, related_project_id, related_experiment_id, checklist, comments, reminder, attachments, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                'task-2', 'Soil Core Sampling Plot B', 'Extract soil core samples at depths of 15cm, 30cm, and 60cm from North Orchard.',
                new Date(Date.now() + 86400000).toISOString().split('T')[0], 'medium', 'in_progress', 'proj-soil-02', null,
                JSON.stringify([{text: 'Collect cores', checked: false}, {text: 'Dry in oven', checked: false}]),
                JSON.stringify([]), null, JSON.stringify([]), new Date().toISOString()
            ]);
        }

        // 7. Ensure Sticky Notes exist
        const stickyCheck = await window.api.query("SELECT COUNT(*) as count FROM sticky_notes WHERE id = 'sticky-1'");
        if (stickyCheck[0].count === 0) {
            await window.api.run("INSERT INTO sticky_notes (id, content, color, created_at) VALUES (?, ?, ?, ?)", [
                'sticky-1', 'Check water sample WQI scores: Borehole Tap is clean, canal is heavily contaminated. Filter system check required!', '#ffe066', new Date().toISOString()
            ]);
            await window.api.run("INSERT INTO sticky_notes (id, content, color, created_at) VALUES (?, ?, ?, ?)", [
                'sticky-2', 'Butterhead hydroponic lettuce reaches harvest day on August 1st. Plan fresh weight and dry weight processing.', '#a9e34b', new Date().toISOString()
            ]);
        }

        // 8. Ensure Templates exist
        const tplCheck = await window.api.query("SELECT COUNT(*) as count FROM templates WHERE id = 'tpl-1'");
        if (tplCheck[0].count === 0) {
            await window.api.run(`
                INSERT INTO templates (id, type, name, data, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [
                'tpl-1', 'hydroponics', 'Leafy Greens Nutrient Profile',
                JSON.stringify({ph: 6.0, ec: 1.8, tds: 900, temp: 22.0, light_intensity: 500}), new Date().toISOString()
            ]);
        }
        
        console.log("Demo database seeding and project alignment checked.");
    } catch (e) {
        console.error("Failed to seed/align database.", e);
    }
}


/* ==========================================
   ROUTING & LAYOUT REGISTRATION
   ========================================== */

function setupGlobalEventListeners() {
    // Sidebar items
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            switchView(view);
        });
    });

    // Toolbar buttons
    document.getElementById('btn-quick-new')?.addEventListener('click', () => triggerQuickCreateDialog());
    document.getElementById('btn-quick-save')?.addEventListener('click', () => triggerGlobalSaveNotification());
    document.getElementById('btn-quick-export')?.addEventListener('click', () => triggerGlobalExport());
    document.getElementById('btn-quick-backup')?.addEventListener('click', () => runBackupCommand());
    document.getElementById('btn-toggle-notifications')?.addEventListener('click', toggleNotificationDrawer);
    document.getElementById('close-notification-drawer')?.addEventListener('click', toggleNotificationDrawer);
    document.getElementById('btn-clear-notifications')?.addEventListener('click', clearNotifications);
    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('user-profile-trigger')?.addEventListener('click', () => switchView('settings'));

    // Global Search
    const searchInput = document.getElementById('global-search');
    searchInput?.addEventListener('input', (e) => {
        handleGlobalSearch(e.target.value);
    });
}

function switchView(viewName) {
    currentView = viewName;
    
    // Update active nav button
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
        if (btn.getAttribute('data-view') === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const viewport = document.getElementById('view-viewport');
    if (!viewport) return;

    // Reset viewport contents
    viewport.innerHTML = '';
    
    // Render specific view
    switch (viewName) {
        case 'dashboard':
            renderDashboard(viewport);
            break;
        case 'projects':
            renderProjects(viewport);
            break;
        case 'hydroponics':
            renderModuleView(viewport, 'hydroponics');
            break;
        case 'irrigation':
            renderModuleView(viewport, 'irrigation');
            break;
        case 'soil':
            renderModuleView(viewport, 'soil');
            break;
        case 'microgreens':
            renderModuleView(viewport, 'microgreens');
            break;
        case 'water_analysis':
            renderWaterAnalysis(viewport);
            break;
        case 'analytics':
            renderAnalytics(viewport);
            break;
        case 'reports':
            renderReports(viewport);
            break;
        case 'gallery':
            renderGallery(viewport);
            break;
        case 'templates':
            renderTemplates(viewport);
            break;
        case 'settings':
            renderSettings(viewport);
            break;
        default:
            viewport.innerHTML = `<h2>View ${viewName} coming soon!</h2>`;
    }
}

/* ==========================================
   MODULE 1: DASHBOARD VIEW
   ========================================== */

async function renderDashboard(container) {
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2 style="font-size: 1.6rem; font-weight: 700;">Welcome back, ${appSettings.user_name}</h2>
                    <p style="color: var(--text-dim); font-size: 0.9rem;">Here is a summary of your agricultural research facility today.</p>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">
                    ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <!-- Quick Stats -->
            <div class="card-grid" id="dashboard-stats-grid">
                <!-- Loaded dynamically -->
            </div>

            <!-- Dashboard Split -->
            <div style="display: grid; grid-template-columns: 2fr 1.1fr; gap: 24px; align-items: start;">
                <!-- Left side: Kanban and Tasks -->
                <div style="display: flex; flex-direction: column; gap: 24px;">
                    <div class="glass" style="border-radius: 12px; padding: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                                ${AG_ICONS.projects} Active Research Tasks
                            </h3>
                            <button class="btn btn-sm btn-primary" id="btn-add-task">+ Add Task</button>
                        </div>
                        <div class="kanban-board" id="kanban-board">
                            <!-- Columns: Todo, Progress, Waiting, Completed -->
                            <div class="kanban-column" data-status="todo">
                                <div class="kanban-header">
                                    <span class="kanban-title"><span style="color: var(--color-cyan);">●</span> To Do</span>
                                    <span class="kanban-badge" id="badge-todo">0</span>
                                </div>
                                <div class="kanban-cards" id="cards-todo"></div>
                            </div>
                            <div class="kanban-column" data-status="in_progress">
                                <div class="kanban-header">
                                    <span class="kanban-title"><span style="color: var(--color-yellow);">●</span> In Progress</span>
                                    <span class="kanban-badge" id="badge-progress">0</span>
                                </div>
                                <div class="kanban-cards" id="cards-progress"></div>
                            </div>
                            <div class="kanban-column" data-status="waiting">
                                <div class="kanban-header">
                                    <span class="kanban-title"><span style="color: var(--color-purple);">●</span> Waiting</span>
                                    <span class="kanban-badge" id="badge-waiting">0</span>
                                </div>
                                <div class="kanban-cards" id="cards-waiting"></div>
                            </div>
                            <div class="kanban-column" data-status="completed">
                                <div class="kanban-header">
                                    <span class="kanban-title"><span style="color: var(--color-emerald);">●</span> Completed</span>
                                    <span class="kanban-badge" id="badge-completed">0</span>
                                </div>
                                <div class="kanban-cards" id="cards-completed"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Sticky Notes Panel -->
                    <div class="glass" style="border-radius: 12px; padding: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                                Sticky Notes
                            </h3>
                            <button class="btn btn-sm btn-secondary" id="btn-add-sticky">+ Add Note</button>
                        </div>
                        <div class="sticky-container" id="sticky-container"></div>
                    </div>
                </div>

                <!-- Right side: Calendar & Upcoming observations -->
                <div style="display: flex; flex-direction: column; gap: 24px;">
                    <!-- Calendar Widget -->
                    <div class="glass calendar-widget" id="calendar-widget-container"></div>

                    <!-- Observation Schedule -->
                    <div class="glass" style="border-radius: 12px; padding: 20px;">
                        <h3 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                            ${AG_ICONS.bell} Upcoming Observations
                        </h3>
                        <div style="display: flex; flex-direction: column; gap: 10px;" id="upcoming-observations-list"></div>
                    </div>

                    <!-- Recent Activity -->
                    <div class="glass" style="border-radius: 12px; padding: 20px;">
                        <h3 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                            Recent Facility Logs
                        </h3>
                        <div class="timeline-list" id="timeline-list"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Load dynamic contents
    await refreshDashboardStats();
    await refreshKanbanBoard();
    await refreshStickyNotes();
    await renderCalendar();
    await loadUpcomingObservations();
    await loadRecentActivity();

    // Event listeners inside Dashboard
    document.getElementById('btn-add-task')?.addEventListener('click', () => openTaskDialog());
    document.getElementById('btn-add-sticky')?.addEventListener('click', () => createNewStickyNote());
}

async function refreshDashboardStats() {
    const statsGrid = document.getElementById('dashboard-stats-grid');
    if (!statsGrid) return;

    try {
        const pCount = await window.api.query("SELECT COUNT(*) as c FROM projects");
        const eCount = await window.api.query("SELECT COUNT(*) as c FROM experiments WHERE status='active'");
        const tCount = await window.api.query("SELECT COUNT(*) as c FROM tasks WHERE status!='completed'");
        const wCount = await window.api.query("SELECT COUNT(*) as c FROM water_samples");

        statsGrid.innerHTML = `
            <div class="card glass stat-card">
                <h4>Research Projects</h4>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.3rem; font-weight: 700; line-height: 1.2; color: var(--text-main);">${pCount[0].c}</span>
                    <span class="stat-icon-inline" style="color: var(--color-emerald);">${AG_ICONS.projects}</span>
                </div>
            </div>
            <div class="card glass stat-card">
                <h4>Active Experiments</h4>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.3rem; font-weight: 700; line-height: 1.2; color: var(--text-main);">${eCount[0].c}</span>
                    <span class="stat-icon-inline" style="color: var(--color-purple);">${AG_ICONS.hydroponics}</span>
                </div>
            </div>
            <div class="card glass stat-card">
                <h4>Pending Tasks</h4>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.3rem; font-weight: 700; line-height: 1.2; color: var(--text-main);">${tCount[0].c}</span>
                    <span class="stat-icon-inline" style="color: var(--color-yellow);">${AG_ICONS.calendar}</span>
                </div>
            </div>
            <div class="card glass stat-card">
                <h4>Water Analyses</h4>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.3rem; font-weight: 700; line-height: 1.2; color: var(--text-main);">${wCount[0].c}</span>
                    <span class="stat-icon-inline" style="color: var(--color-cyan);">${AG_ICONS.water_analysis}</span>
                </div>
            </div>
        `;
    } catch (e) {
        console.error(e);
    }
}

async function refreshKanbanBoard() {
    const columns = {
        todo: document.getElementById('cards-todo'),
        in_progress: document.getElementById('cards-progress'),
        waiting: document.getElementById('cards-waiting'),
        completed: document.getElementById('cards-completed')
    };

    const badges = {
        todo: document.getElementById('badge-todo'),
        in_progress: document.getElementById('badge-progress'),
        waiting: document.getElementById('badge-waiting'),
        completed: document.getElementById('badge-completed')
    };

    if (!columns.todo) return;

    // Reset columns
    Object.values(columns).forEach(col => col.innerHTML = '');

    try {
        const tasks = await window.api.query("SELECT t.*, p.name as project_name FROM tasks t LEFT JOIN projects p ON t.related_project_id = p.id ORDER BY t.due_date ASC");
        
        const counts = { todo: 0, in_progress: 0, waiting: 0, completed: 0 };

        tasks.forEach(t => {
            const col = columns[t.status];
            if (!col) return;
            
            counts[t.status]++;

            const card = document.createElement('div');
            card.className = `task-card priority-${t.priority}`;
            card.draggable = true;
            card.id = `task-card-${t.id}`;
            card.innerHTML = `
                <h5>${escapeHtml(t.title)}</h5>
                <p>${escapeHtml(t.description || 'No description')}</p>
                <div class="task-meta">
                    <span class="task-project-tag">${escapeHtml(t.project_name || 'Global')}</span>
                    <span class="task-date">${t.due_date ? t.due_date : 'No due date'}</span>
                </div>
            `;

            // Drag and drop event listeners
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', t.id);
                card.style.opacity = '0.5';
            });
            card.addEventListener('dragend', () => {
                card.style.opacity = '1';
            });

            // Double click to view details
            card.addEventListener('dblclick', () => openTaskDialog(t.id));

            col.appendChild(card);
        });

        // Update badges
        Object.keys(badges).forEach(status => {
            badges[status].textContent = counts[status];
        });

        // Set up drop zones
        document.querySelectorAll('.kanban-column').forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.style.background = 'rgba(255, 255, 255, 0.05)';
            });
            column.addEventListener('dragleave', () => {
                column.style.background = 'rgba(0,0,0,0.1)';
            });
            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                column.style.background = 'rgba(0,0,0,0.1)';
                const taskId = e.dataTransfer.getData('text/plain');
                const targetStatus = column.getAttribute('data-status');
                
                if (taskId && targetStatus) {
                    await window.api.run("UPDATE tasks SET status = ? WHERE id = ?", [targetStatus, taskId]);
                    await refreshKanbanBoard();
                    logFacilityActivity(`Task status updated: ${taskId} to ${targetStatus}`);
                }
            });
        });

    } catch (e) {
        console.error(e);
    }
}

async function refreshStickyNotes() {
    const container = document.getElementById('sticky-container');
    if (!container) return;

    container.innerHTML = '';

    try {
        const notes = await window.api.query("SELECT * FROM sticky_notes ORDER BY created_at DESC");
        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'sticky-note';
            card.style.backgroundColor = note.color || '#ffe066';
            card.innerHTML = `
                <textarea placeholder="Write something...">${escapeHtml(note.content || '')}</textarea>
                <button class="sticky-delete-btn" title="Delete Note">${AG_ICONS.trash}</button>
            `;

            const textarea = card.querySelector('textarea');
            
            // Auto-clear the default 'Write something...' placeholder when clicked/focused
            textarea.addEventListener('focus', () => {
                if (textarea.value.trim() === 'Write something...') {
                    textarea.value = '';
                }
            });

            // Restore the default placeholder text if blurred without typing any text
            textarea.addEventListener('blur', async () => {
                if (textarea.value.trim() === '') {
                    textarea.value = 'Write something...';
                    await window.api.run("UPDATE sticky_notes SET content = ? WHERE id = ?", ['Write something...', note.id]);
                }
            });

            textarea.addEventListener('input', debounce(async () => {
                await window.api.run("UPDATE sticky_notes SET content = ? WHERE id = ?", [textarea.value, note.id]);
            }, 500));

            card.querySelector('.sticky-delete-btn').addEventListener('click', async () => {
                await window.api.run("DELETE FROM sticky_notes WHERE id = ?", [note.id]);
                card.remove();
            });

            container.appendChild(card);
        });
    } catch (e) {
        console.error(e);
    }
}

async function createNewStickyNote() {
    const colors = ['#ffe066', '#a9e34b', '#ffc9c9', '#a5d8ff', '#ffd8a8', '#eebefa'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const noteId = `sticky-${Date.now()}`;
    
    try {
        await window.api.run("INSERT INTO sticky_notes (id, content, color, created_at) VALUES (?, ?, ?, ?)", [
            noteId, 'Write something...', randomColor, new Date().toISOString()
        ]);
        await refreshStickyNotes();
    } catch (e) {
        console.error(e);
    }
}

// Custom simple calendar rendering
async function renderCalendar() {
    const container = document.getElementById('calendar-widget-container');
    if (!container) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const todayDate = now.getDate();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    // Fetch events for this month (tasks due dates)
    let eventDays = new Set();
    try {
        const tasks = await window.api.query("SELECT due_date FROM tasks WHERE due_date LIKE ?", [`${year}-${String(month+1).padStart(2,'0')}%`]);
        tasks.forEach(t => {
            if (t.due_date) {
                const dayNum = parseInt(t.due_date.split('-')[2]);
                if (!isNaN(dayNum)) eventDays.add(dayNum);
            }
        });
    } catch(e) {}

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    let gridHtml = `
        <div class="calendar-header">
            <h4>${monthNames[month]} ${year}</h4>
            <div style="font-size: 0.75rem; font-weight:700; color: var(--primary);">TODAY</div>
        </div>
        <div class="calendar-grid">
            <div class="calendar-day-label">Su</div>
            <div class="calendar-day-label">Mo</div>
            <div class="calendar-day-label">Tu</div>
            <div class="calendar-day-label">We</div>
            <div class="calendar-day-label">Th</div>
            <div class="calendar-day-label">Fr</div>
            <div class="calendar-day-label">Sa</div>
    `;

    // Fill blank days
    for (let i = 0; i < firstDayIndex; i++) {
        gridHtml += `<div></div>`;
    }

    // Fill calendar days
    for (let day = 1; day <= lastDay; day++) {
        const isToday = day === todayDate;
        const hasEvent = eventDays.has(day);
        
        gridHtml += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasEvent ? 'has-events' : ''}" data-day="${day}">
                ${day}
            </div>
        `;
    }

    gridHtml += `</div>`;
    container.innerHTML = gridHtml;

    // Click calendar day to show tasks on that date
    container.querySelectorAll('.calendar-day').forEach(el => {
        el.addEventListener('click', () => {
            const d = el.getAttribute('data-day');
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            openTasksDateModal(dateStr);
        });
    });
}

async function openTasksDateModal(dateStr) {
    try {
        const tasks = await window.api.query("SELECT * FROM tasks WHERE due_date = ?", [dateStr]);
        let bodyHtml = `<p style="font-size: 0.9rem; color: var(--text-dim); margin-bottom: 12px;">Tasks scheduled for <strong>${dateStr}</strong>:</p>`;
        
        if (tasks.length === 0) {
            bodyHtml += `<div style="text-align:center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">No tasks due on this date.</div>`;
        } else {
            bodyHtml += `<div style="display:flex; flex-direction:column; gap:8px;">`;
            tasks.forEach(t => {
                bodyHtml += `
                    <div style="padding: 10px; border:1px solid var(--border-color); border-radius:6px; background: rgba(255,255,255,0.02);">
                        <span style="font-weight:600; font-size:0.85rem;">${escapeHtml(t.title)}</span>
                        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform:uppercase; margin-top:4px;">Priority: ${t.priority} | Status: ${t.status}</div>
                    </div>
                `;
            });
            bodyHtml += `</div>`;
        }
        
        showGlobalModal(`Tasks on ${dateStr}`, bodyHtml, `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`);
    } catch(e) {
        console.error(e);
    }
}

async function loadUpcomingObservations() {
    const list = document.getElementById('upcoming-observations-list');
    if (!list) return;

    list.innerHTML = '';

    try {
        // Fetch active experiments
        const exps = await window.api.query("SELECT e.*, p.name as project_name FROM experiments e JOIN projects p ON e.project_id=p.id WHERE e.status='active' LIMIT 3");
        
        if (exps.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding: 10px; color: var(--text-muted); font-size:0.8rem;">No active observation schedules.</div>`;
            return;
        }

        exps.forEach(e => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 10px 12px;
                border-radius: 8px;
                border: 1px solid var(--border-color);
                background: rgba(255,255,255,0.02);
                display: flex;
                flex-direction: column;
                gap: 4px;
                cursor: pointer;
            `;
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-size: 0.8rem; font-weight: 700; color: var(--primary);">
                    <span>${escapeHtml(e.name)}</span>
                    <span style="text-transform:uppercase; font-size: 0.65rem; padding: 1px 4px; background: rgba(16,185,129,0.1); border-radius:4px;">${e.type}</span>
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Project: ${escapeHtml(e.project_name)}</div>
            `;
            
            item.addEventListener('click', () => {
                activeProjectId = e.project_id;
                activeExperimentId = e.id;
                switchView(e.type);
            });
            
            list.appendChild(item);
        });
    } catch(err) {
        console.error(err);
    }
}

async function loadRecentActivity() {
    const list = document.getElementById('timeline-list');
    if (!list) return;

    // We can simulate facility logs from database settings or query settings/logs table if we keep logs
    // For now, we fetch from a custom log key in templates/settings, or show dynamic updates
    const mockActivities = [
        { text: "Water Sample registration added: Borehole block B", time: "1 hour ago" },
        { text: "Standard Leafy Greens template created", time: "Yesterday" },
        { text: "Database automatic backup completed", time: "2 days ago" }
    ];

    list.innerHTML = mockActivities.map(act => `
        <div class="timeline-item">
            <div class="timeline-bullet"></div>
            <div class="timeline-content">
                <span style="color: var(--text-dim);">${escapeHtml(act.text)}</span>
                <span class="timeline-time">${act.time}</span>
            </div>
        </div>
    `).join('');
}

async function logFacilityActivity(text) {
    console.log("[LOG]:", text);
    // Simple mock logging, could append to a global logs database table or list
}

/* ==========================================
   MODULE 2: PROJECTS MODULE
   ========================================== */

async function renderProjects(container) {
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="font-size: 1.4rem; font-weight: 700;">Research Projects</h2>
                    <p style="color: var(--text-dim); font-size: 0.85rem;">Manage research goals, observations, and experimental modules.</p>
                </div>
                <button class="btn btn-primary" id="btn-create-project">+ Create Project</button>
            </div>

            <!-- Projects Grid / List -->
            <div class="glass" style="border-radius:12px; padding:20px;">
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Project Name</th>
                                <th>Principal Investigator</th>
                                <th>Team Members</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Status</th>
                                <th style="text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="projects-list-tbody">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-create-project')?.addEventListener('click', () => openProjectDialog());
    await refreshProjectsList();
}

async function refreshProjectsList() {
    const tbody = document.getElementById('projects-list-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    try {
        const projects = await window.api.query("SELECT * FROM projects ORDER BY created_at DESC");
        
        if (projects.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
                        No projects created yet. Click "+ Create Project" to start.
                    </td>
                </tr>
            `;
            return;
        }

        projects.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600; cursor:pointer; color: var(--primary);" class="project-name-cell">${escapeHtml(p.name)}</td>
                <td>${escapeHtml(p.investigator || '')}</td>
                <td style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(p.team || '')}</td>
                <td>${p.start_date || 'N/A'}</td>
                <td>${p.end_date || 'N/A'}</td>
                <td><span style="font-size:0.75rem; text-transform:uppercase; padding: 2px 6px; border-radius:4px; font-weight:600; background:rgba(255,255,255,0.05); border: 1px solid var(--border-color);">${p.status}</span></td>
                <td style="text-align:right;">
                    <div style="display:flex; justify-content:flex-end; gap:6px;">
                        <button class="btn-icon-sm btn-open" title="Open Project Details">${AG_ICONS.arrowRight || '▶'}</button>
                        <button class="btn-icon-sm btn-edit" title="Edit Project">${AG_ICONS.edit}</button>
                        <button class="btn-icon-sm btn-delete" title="Delete Project">${AG_ICONS.trash}</button>
                    </div>
                </td>
            `;

            tr.querySelector('.project-name-cell').addEventListener('click', () => openProjectDetails(p.id));
            tr.querySelector('.btn-open').addEventListener('click', () => openProjectDetails(p.id));
            tr.querySelector('.btn-edit').addEventListener('click', () => openProjectDialog(p.id));
            tr.querySelector('.btn-delete').addEventListener('click', () => deleteProject(p.id));

            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
    }
}

async function deleteProject(projectId) {
    if (confirm("Are you sure you want to delete this project? All associated experiments and data records will be deleted.")) {
        try {
            await window.api.run("DELETE FROM projects WHERE id = ?", [projectId]);
            await window.api.run("DELETE FROM experiments WHERE project_id = ?", [projectId]);
            await refreshProjectsList();
            logFacilityActivity(`Project deleted: ${projectId}`);
        } catch (e) {
            alert("Error deleting project: " + e.message);
        }
    }
}

function openProjectDialog(projectId = null) {
    let isEdit = projectId !== null;
    let title = isEdit ? "Edit Research Project" : "New Research Project";
    
    // We fetch fields if Edit
    if (isEdit) {
        window.api.query("SELECT * FROM projects WHERE id = ?", [projectId]).then(rows => {
            if (rows && rows.length > 0) {
                const p = rows[0];
                showProjectForm(p);
            }
        });
    } else {
        showProjectForm();
    }

    function showProjectForm(data = null) {
        const formHtml = `
            <form id="project-form">
                <input type="hidden" id="p-id" value="${data ? data.id : 'proj-' + Date.now()}">
                <div class="form-group">
                    <label for="p-name">Project Name</label>
                    <input type="text" class="form-control" id="p-name" value="${data ? escapeHtml(data.name || '') : ''}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="p-investigator">Principal Investigator</label>
                        <input type="text" class="form-control" id="p-investigator" value="${data ? escapeHtml(data.investigator || '') : appSettings.user_name}">
                    </div>
                    <div class="form-group">
                        <label for="p-team">Team Members</label>
                        <input type="text" class="form-control" id="p-team" placeholder="Comma separated names" value="${data ? escapeHtml(data.team || '') : ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="p-start">Start Date</label>
                        <input type="date" class="form-control" id="p-start" value="${data ? data.start_date : ''}">
                    </div>
                    <div class="form-group">
                        <label for="p-end">End Date</label>
                        <input type="date" class="form-control" id="p-end" value="${data ? data.end_date : ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label for="p-status">Status</label>
                    <select class="form-control" id="p-status">
                        <option value="planning" ${data && data.status === 'planning' ? 'selected' : ''}>Planning</option>
                        <option value="active" ${!data || data.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="completed" ${data && data.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="suspended" ${data && data.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="p-objectives">Objectives</label>
                    <textarea class="form-control" id="p-objectives">${data ? escapeHtml(data.objectives || '') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="p-notes">Research Notes</label>
                    <textarea class="form-control" id="p-notes">${data ? escapeHtml(data.notes || '') : ''}</textarea>
                </div>
            </form>
        `;

        const footerHtml = `
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-project-form">Save Project</button>
        `;

        showGlobalModal(title, formHtml, footerHtml);

        // Prevent default form submit (prevents Enter key press from reloading the app)
        document.getElementById('project-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            document.getElementById('btn-save-project-form')?.click();
        });

        document.getElementById('btn-save-project-form')?.addEventListener('click', async () => {
            const id = document.getElementById('p-id').value;
            const name = document.getElementById('p-name').value;
            
            // Validate that project name is not empty
            if (!name.trim()) {
                alert("Project Name is required.");
                document.getElementById('p-name').focus();
                return;
            }
            const pi = document.getElementById('p-investigator').value;
            const team = document.getElementById('p-team').value;
            const start = document.getElementById('p-start').value;
            const end = document.getElementById('p-end').value;
            const status = document.getElementById('p-status').value;
            const objectives = document.getElementById('p-objectives').value;
            const notes = document.getElementById('p-notes').value;

            try {
                if (isEdit) {
                    await window.api.run(`
                        UPDATE projects SET name=?, investigator=?, team=?, start_date=?, end_date=?, objectives=?, status=?, notes=?
                        WHERE id=?
                    `, [name, pi, team, start, end, objectives, status, notes, id]);
                } else {
                    await window.api.run(`
                        INSERT INTO projects (id, name, investigator, team, start_date, end_date, objectives, status, notes, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [id, name, pi, team, start, end, objectives, status, notes, new Date().toISOString()]);
                }
                
                closeModal();
                if (currentView === 'projects') {
                    await refreshProjectsList();
                } else {
                    switchView('projects');
                }
                logFacilityActivity(`Project saved: ${name}`);
            } catch (err) {
                alert("Failed to save project: " + err.message);
            }
        });
    }
}

// Project detail page rendering with tabs
async function openProjectDetails(projectId) {
    activeProjectId = projectId;
    
    const viewport = document.getElementById('view-viewport');
    if (!viewport) return;

    try {
        const rows = await window.api.query("SELECT * FROM projects WHERE id = ?", [projectId]);
        if (rows.length === 0) return;
        const p = rows[0];

        viewport.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:20px;">
                <!-- Back Link -->
                <div style="margin-bottom: -10px;">
                    <a href="#" id="link-back-projects" style="font-size:0.85rem; font-weight:600; display:flex; align-items:center; gap:6px;">
                        ← Back to Projects
                    </a>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom:4px;">${escapeHtml(p.name)}</h2>
                        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform:uppercase; font-weight:700;">
                            PI: ${escapeHtml(p.investigator || 'N/A')} | Status: ${p.status}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-sm btn-secondary" id="btn-edit-active-proj">Edit Project</button>
                        <button class="btn btn-sm btn-primary" id="btn-add-exp-proj">+ Add Experiment</button>
                    </div>
                </div>

                <!-- Inner tabs: Summary, Experiments, Water Samples, Tasks, Documents -->
                <div class="tabs-container">
                    <div class="tabs-header">
                        <button class="tab-btn active" data-proj-tab="summary">Project Overview</button>
                        <button class="tab-btn" data-proj-tab="experiments">Experiments</button>
                        <button class="tab-btn" data-proj-tab="water">Water Samples</button>
                        <button class="tab-btn" data-proj-tab="tasks">Tasks</button>
                        <button class="tab-btn" data-proj-tab="files">Gallery & Files</button>
                    </div>

                    <!-- SUMMARY TAB -->
                    <div class="tab-content active" id="proj-tab-summary">
                        <div class="card-grid" style="grid-template-columns: 2fr 1fr;">
                            <div class="card glass" style="gap:16px;">
                                <div>
                                    <h4 style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Objectives</h4>
                                    <p style="font-size:0.9rem; line-height:1.5;">${escapeHtml(p.objectives || 'No objectives stated.')}</p>
                                </div>
                                <hr style="border:none; border-top:1px solid var(--border-color);">
                                <div>
                                    <h4 style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">General Research Notes</h4>
                                    <p style="font-size:0.9rem; line-height:1.5; white-space:pre-line;">${escapeHtml(p.notes || 'No project notes.')}</p>
                                </div>
                            </div>
                            
                            <div class="card glass" style="gap:14px;">
                                <div>
                                    <h4 style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:2px;">Team Members</h4>
                                    <p style="font-size:0.88rem; font-weight:500;">${escapeHtml(p.team || 'None')}</p>
                                </div>
                                <div>
                                    <h4 style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:2px;">Timeline</h4>
                                    <p style="font-size:0.88rem; font-weight:500;">${p.start_date || 'N/A'} to ${p.end_date || 'N/A'}</p>
                                </div>
                                <div>
                                    <h4 style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:2px;">Created At</h4>
                                    <p style="font-size:0.88rem; font-weight:500;">${p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- EXPERIMENTS TAB -->
                    <div class="tab-content" id="proj-tab-experiments">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Experiment Name</th>
                                        <th>Module Type</th>
                                        <th>Timeline</th>
                                        <th>Status</th>
                                        <th style="text-align:right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="proj-exps-tbody">
                                    <!-- Populated dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- WATER SAMPLES TAB -->
                    <div class="tab-content" id="proj-tab-water">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Sample ID / Name</th>
                                        <th>Registered Date</th>
                                        <th>Source</th>
                                        <th>Collected By</th>
                                        <th>WQI Score</th>
                                        <th>Safety Status</th>
                                        <th style="text-align:right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="proj-water-tbody">
                                    <!-- Populated dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- TASKS TAB -->
                    <div class="tab-content" id="proj-tab-tasks">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Task Description</th>
                                        <th>Due Date</th>
                                        <th>Priority</th>
                                        <th>Status</th>
                                        <th style="text-align:right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="proj-tasks-tbody">
                                    <!-- Populated dynamically -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- FILES / GALLERY TAB -->
                    <div class="tab-content" id="proj-tab-files">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                            <h4 style="font-weight:600; font-size:0.9rem;">Attached Laboratory Files & Images</h4>
                            <button class="btn btn-sm btn-secondary" id="btn-upload-file-proj">+ Upload Attachment</button>
                        </div>
                        <div class="gallery-grid" id="proj-gallery-grid"></div>
                    </div>
                </div>
            </div>
        `;

        // Event listeners for tabs
        document.getElementById('link-back-projects')?.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('projects');
        });

        document.getElementById('btn-edit-active-proj')?.addEventListener('click', () => openProjectDialog(p.id));
        document.getElementById('btn-add-exp-proj')?.addEventListener('click', () => openExperimentDialog(null, p.id));
        document.getElementById('btn-upload-file-proj')?.addEventListener('click', () => uploadGalleryFile(p.id));

        document.querySelectorAll('[data-proj-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-proj-tab');
                
                // Toggle tab button active classes
                document.querySelectorAll('[data-proj-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Toggle contents
                document.getElementById('proj-tab-summary').classList.remove('active');
                document.getElementById('proj-tab-experiments').classList.remove('active');
                document.getElementById('proj-tab-water').classList.remove('active');
                document.getElementById('proj-tab-tasks').classList.remove('active');
                document.getElementById('proj-tab-files').classList.remove('active');
                
                const activeEl = document.getElementById(`proj-tab-${targetTab}`);
                if (activeEl) activeEl.classList.add('active');

                // Load data for specific tab if active
                if (targetTab === 'experiments') loadProjExperiments(projectId);
                if (targetTab === 'water') loadProjWaterSamples(projectId);
                if (targetTab === 'tasks') loadProjTasks(projectId);
                if (targetTab === 'files') loadProjGallery(projectId);
            });
        });

    } catch (e) {
        console.error(e);
    }
}

// Inner tab loader functions
async function loadProjExperiments(projectId) {
    const tbody = document.getElementById('proj-exps-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    try {
        const exps = await window.api.query("SELECT * FROM experiments WHERE project_id = ? ORDER BY created_at DESC", [projectId]);
        if (exps.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No experiments registered. Click "+ Add Experiment" to begin.</td></tr>`;
            return;
        }

        exps.forEach(e => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600; cursor:pointer; color:var(--primary);" class="exp-name-cell">${escapeHtml(e.name)}</td>
                <td style="text-transform:capitalize;">${e.type}</td>
                <td>${e.start_date || 'N/A'} to ${e.end_date || 'N/A'}</td>
                <td><span style="font-size:0.75rem; text-transform:uppercase; padding: 2px 6px; border-radius:4px; font-weight:600; background:rgba(255,255,255,0.05); border: 1px solid var(--border-color);">${e.status}</span></td>
                <td style="text-align:right;">
                    <div style="display:flex; justify-content:flex-end; gap:6px;">
                        <button class="btn-icon-sm btn-open-exp" title="Open Experiment">${AG_ICONS.arrowRight || '▶'}</button>
                        <button class="btn-icon-sm btn-delete-exp" title="Delete Experiment">${AG_ICONS.trash}</button>
                    </div>
                </td>
            `;

            const triggerOpen = () => {
                activeProjectId = projectId;
                activeExperimentId = e.id;
                switchView(e.type); // Redirects to specific modules view
            };

            tr.querySelector('.exp-name-cell').addEventListener('click', triggerOpen);
            tr.querySelector('.btn-open-exp').addEventListener('click', triggerOpen);
            tr.querySelector('.btn-delete-exp').addEventListener('click', async () => {
                if (confirm("Delete this experiment and all logged observation history?")) {
                    await window.api.run("DELETE FROM experiments WHERE id = ?", [e.id]);
                    await window.api.run("DELETE FROM observations WHERE experiment_id = ?", [e.id]);
                    loadProjExperiments(projectId);
                }
            });
            tbody.appendChild(tr);
        });
    } catch(err) {
        console.error(err);
    }
}

async function loadProjWaterSamples(projectId) {
    const tbody = document.getElementById('proj-water-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    try {
        const samples = await window.api.query("SELECT * FROM water_samples WHERE project_id = ? ORDER BY register_date DESC", [projectId]);
        if (samples.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">No water samples recorded for this project.</td></tr>`;
            return;
        }

        samples.forEach(s => {
            let badgeClass = 'wqi-excellent';
            if (s.wqi_score >= 50 && s.wqi_score < 100) badgeClass = 'wqi-good';
            if (s.wqi_score >= 100 && s.wqi_score < 200) badgeClass = 'wqi-poor';
            if (s.wqi_score >= 200 && s.wqi_score < 300) badgeClass = 'wqi-very-poor';
            if (s.wqi_score >= 300) badgeClass = 'wqi-unsuitable';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600; cursor:pointer; color:var(--primary);" class="water-cell">${escapeHtml(s.sample_name)}</td>
                <td>${s.register_date || 'N/A'}</td>
                <td>${escapeHtml(s.source || '')}</td>
                <td>${escapeHtml(s.collected_by || '')}</td>
                <td style="font-weight:700;">${s.wqi_score !== null ? s.wqi_score.toFixed(1) : 'N/A'}</td>
                <td><span class="wqi-class-badge ${badgeClass}" style="font-size:0.7rem; padding: 2px 8px;">${s.wqi_class || 'Unknown'}</span></td>
                <td style="text-align:right;">
                    <div style="display:flex; justify-content:flex-end; gap:6px;">
                        <button class="btn-icon-sm btn-open-water" title="View Lab Analysis">${AG_ICONS.arrowRight || '▶'}</button>
                    </div>
                </td>
            `;

            const triggerOpen = () => {
                activeProjectId = projectId;
                switchView('water_analysis');
                // We'll write the logic in water_analysis view to highlight this sample
            };

            tr.querySelector('.water-cell').addEventListener('click', triggerOpen);
            tr.querySelector('.btn-open-water').addEventListener('click', triggerOpen);
            tbody.appendChild(tr);
        });
    } catch(e) {
        console.error(e);
    }
}

async function loadProjTasks(projectId) {
    const tbody = document.getElementById('proj-tasks-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    try {
        const tasks = await window.api.query("SELECT * FROM tasks WHERE related_project_id = ? ORDER BY due_date ASC", [projectId]);
        if (tasks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No tasks assigned to this project.</td></tr>`;
            return;
        }

        tasks.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600;">${escapeHtml(t.title)}</td>
                <td>${t.due_date || 'No due date'}</td>
                <td style="text-transform:capitalize;"><span style="color: ${t.priority === 'high' ? 'var(--color-red)' : t.priority === 'medium' ? 'var(--color-yellow)' : 'var(--color-cyan)'}; font-weight:700;">${t.priority}</span></td>
                <td style="text-transform:capitalize;">${t.status.replace('_', ' ')}</td>
                <td style="text-align:right;">
                    <button class="btn-icon-sm btn-edit-task" title="View Task Detail">${AG_ICONS.edit}</button>
                </td>
            `;
            tr.querySelector('.btn-edit-task').addEventListener('click', () => openTaskDialog(t.id));
            tbody.appendChild(tr);
        });
    } catch(err) {
        console.error(err);
    }
}

async function loadProjGallery(projectId) {
    const grid = document.getElementById('proj-gallery-grid');
    if (!grid) return;
    grid.innerHTML = '';

    try {
        const items = await window.api.query("SELECT * FROM gallery WHERE project_id = ? ORDER BY created_at DESC", [projectId]);
        if (items.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">No files attached to this project.</div>`;
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'gallery-item';
            
            let bgStyle = '';
            let fileIcon = AG_ICONS.reports;
            if (item.file_type === 'image') {
                // Since this runs inside Electron, we can load file:/// protocol if we expose it, 
                // but since Windows paths require proper escaping:
                const pathEscaped = item.file_path.replace(/\\/g, '/');
                bgStyle = `background-image: url('file:///${pathEscaped}');`;
                fileIcon = '';
            }

            card.innerHTML = `
                <div class="gallery-thumbnail" style="${bgStyle}">
                    ${fileIcon}
                </div>
                <div class="gallery-info">
                    <span class="gallery-title" title="${escapeHtml(item.file_name)}">${escapeHtml(item.file_name)}</span>
                    <span class="gallery-meta">${(item.file_size / 1024).toFixed(1)} KB | ${item.file_type}</span>
                </div>
            `;
            
            card.addEventListener('click', () => {
                // Open file natively or show simple view dialog
                showGlobalModal(item.file_name, `
                    <div style="text-align:center;">
                        ${item.file_type === 'image' ? `<img src="file:///${item.file_path.replace(/\\/g, '/')}" style="max-width:100%; max-height:400px; border-radius:8px;">` : `<div style="padding:40px 0; color:var(--text-muted);">${AG_ICONS.reports} PDF / Excel Document</div>`}
                        <p style="margin-top:16px; font-size:0.9rem; color:var(--text-dim);">${escapeHtml(item.description || 'No description')}</p>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">Location: ${escapeHtml(item.file_path)}</div>
                    </div>
                `, `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`);
            });

            grid.appendChild(card);
        });
    } catch(e) {
        console.error(e);
    }
}

async function uploadGalleryFile(projectId, experimentId = null) {
    try {
        const fileObj = await window.api.saveFile();
        if (!fileObj) return;

        showGlobalModal("Save Attachment Details", `
            <div class="form-group">
                <label for="att-desc">File Description / Note</label>
                <input type="text" class="form-control" id="att-desc" placeholder="e.g., Lettuce root growth snapshot day 15">
            </div>
            <div style="font-size:0.8rem; color:var(--text-muted);">
                File saved: ${escapeHtml(fileObj.originalName)}<br>
                Size: ${(fileObj.size / 1024).toFixed(1)} KB
            </div>
        `, `
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" id="btn-save-attachment-meta">Save Attachment</button>
        `);

        document.getElementById('btn-save-attachment-meta')?.addEventListener('click', async () => {
            const desc = document.getElementById('att-desc').value;
            const newId = `att-${Date.now()}`;
            
            await window.api.run(`
                INSERT INTO gallery (id, project_id, experiment_id, file_path, file_name, file_type, file_size, description, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [newId, projectId, experimentId, fileObj.path, fileObj.originalName, fileObj.type, fileObj.size, desc, new Date().toISOString()]);
            
            closeModal();
            // Refresh whichever tab/view triggered it
            if (experimentId) {
                // If inside an experiment, refresh experiment media
                refreshExperimentMediaTab(experimentId);
            } else {
                loadProjGallery(projectId);
            }
        });
    } catch (e) {
        alert("Failed to upload file: " + e.message);
    }
}

// Dialog for spawning new experiments
async function openExperimentDialog(experimentId = null, defaultProjectId = null) {
    const isEdit = experimentId !== null;
    const title = isEdit ? "Edit Experiment Details" : "Create New Experiment";
    
    // Load projects list for dropdown selection
    const projects = await window.api.query("SELECT id, name FROM projects");
    if (projects.length === 0) {
        alert("Please create a Project first before adding an experiment.");
        return;
    }

    let expData = null;
    if (isEdit) {
        const rows = await window.api.query("SELECT * FROM experiments WHERE id = ?", [experimentId]);
        if (rows.length > 0) expData = rows[0];
    }

    const formHtml = `
        <form id="exp-form">
            <input type="hidden" id="e-id" value="${expData ? expData.id : 'exp-' + Date.now()}">
            <div class="form-group">
                <label for="e-project">Related Project</label>
                <select class="form-control" id="e-project">
                    ${projects.map(p => `<option value="${p.id}" ${(expData && expData.project_id === p.id) || (!expData && defaultProjectId === p.id) ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="e-name">Experiment Name</label>
                <input type="text" class="form-control" id="e-name" value="${expData ? escapeHtml(expData.name) : ''}">
            </div>
            <div class="form-group">
                <label for="e-type">Experimental Module Type</label>
                <select class="form-control" id="e-type" ${isEdit ? 'disabled' : ''}>
                    <option value="hydroponics" ${expData && expData.type === 'hydroponics' ? 'selected' : ''}>Hydroponics</option>
                    <option value="irrigation" ${expData && expData.type === 'irrigation' ? 'selected' : ''}>Irrigation Studies</option>
                    <option value="soil" ${expData && expData.type === 'soil' ? 'selected' : ''}>Soil Quality Assessment</option>
                    <option value="microgreens" ${expData && expData.type === 'microgreens' ? 'selected' : ''}>Microgreens Cultivation</option>
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="e-start">Start Date</label>
                    <input type="date" class="form-control" id="e-start" value="${expData ? expData.start_date : ''}">
                </div>
                <div class="form-group">
                    <label for="e-end">End Date</label>
                    <input type="date" class="form-control" id="e-end" value="${expData ? expData.end_date : ''}">
                </div>
            </div>
            <div class="form-group">
                <label for="e-status">Status</label>
                <select class="form-control" id="e-status">
                    <option value="planning" ${expData && expData.status === 'planning' ? 'selected' : ''}>Planning</option>
                    <option value="active" ${!expData || expData.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="completed" ${expData && expData.status === 'completed' ? 'selected' : ''}>Completed</option>
                </select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="e-control-notes">Control Group Setup Notes</label>
                    <textarea class="form-control" id="e-control-notes">${expData ? escapeHtml(expData.control_notes || '') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="e-treatment-notes">Treatment Group Setup Notes</label>
                    <textarea class="form-control" id="e-treatment-notes">${expData ? escapeHtml(expData.treatment_notes || '') : ''}</textarea>
                </div>
            </div>
            <div class="form-group">
                <label for="e-notes">Objectives & General Notes</label>
                <textarea class="form-control" id="e-notes">${expData ? escapeHtml(expData.notes || '') : ''}</textarea>
            </div>
        </form>
    `;

    const footerHtml = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-exp-form">Save Experiment</button>
    `;

    showGlobalModal(title, formHtml, footerHtml);

    document.getElementById('btn-save-exp-form')?.addEventListener('click', async () => {
        const id = document.getElementById('e-id').value;
        const projectId = document.getElementById('e-project').value;
        const name = document.getElementById('e-name').value;
        const type = document.getElementById('e-type').value;
        const start = document.getElementById('e-start').value;
        const end = document.getElementById('e-end').value;
        const status = document.getElementById('e-status').value;
        const ctrlNotes = document.getElementById('e-control-notes').value;
        const treatNotes = document.getElementById('e-treatment-notes').value;
        const notes = document.getElementById('e-notes').value;

        try {
            if (isEdit) {
                await window.api.run(`
                    UPDATE experiments SET project_id=?, name=?, start_date=?, end_date=?, status=?, control_notes=?, treatment_notes=?, notes=?
                    WHERE id=?
                `, [projectId, name, start, end, status, ctrlNotes, treatNotes, notes, id]);
            } else {
                await window.api.run(`
                    INSERT INTO experiments (id, project_id, type, name, status, start_date, end_date, notes, control_notes, treatment_notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [id, projectId, type, name, status, start, end, notes, ctrlNotes, treatNotes, new Date().toISOString()]);
            }

            closeModal();
            
            // Refresh view
            if (currentView === 'projects' && activeProjectId === projectId) {
                openProjectDetails(projectId);
            } else {
                // Open newly created experiment's module page directly!
                activeProjectId = projectId;
                activeExperimentId = id;
                switchView(type);
            }
            logFacilityActivity(`Experiment saved: ${name}`);
        } catch (err) {
            alert("Failed to save experiment: " + err.message);
        }
    });
}

/* ==========================================
   MODULE 3, 4, 5, 6: CORES FOR EXPERIMENTS (HYDRO, IRRI, SOIL, MICRO)
   ========================================== */

async function renderModuleView(container, moduleType) {
    let moduleTitle = '';
    if (moduleType === 'hydroponics') moduleTitle = 'Hydroponics Lab Research';
    if (moduleType === 'irrigation') moduleTitle = 'Irrigation & Hydration Studies';
    if (moduleType === 'soil') moduleTitle = 'Soil Quality & Macronutrients';
    if (moduleType === 'microgreens') moduleTitle = 'Microgreens Cultivation Logs';

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px; height: 100%;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="font-size: 1.4rem; font-weight:700;">${moduleTitle}</h2>
                    <p style="color:var(--text-dim); font-size:0.85rem;" id="module-subtext">Record control and treatment group observations.</p>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <label for="active-exp-selector" style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Selected Experiment:</label>
                    <select class="form-control" id="active-exp-selector" style="width:280px;"></select>
                    <button class="btn btn-sm btn-primary" id="btn-add-observation-module">+ Log Data</button>
                </div>
            </div>

            <!-- Experiment Layout Content -->
            <div id="module-experiment-workspace" style="display:flex; flex-direction:column; gap:20px;">
                <!-- Filled dynamically based on selection -->
            </div>
        </div>
    `;

    // Fetch experiments of this module type
    try {
        const exps = await window.api.query("SELECT e.*, p.name as project_name FROM experiments e JOIN projects p ON e.project_id=p.id WHERE e.type = ? ORDER BY e.created_at DESC", [moduleType]);
        const selector = document.getElementById('active-exp-selector');
        
        if (exps.length === 0) {
            selector.innerHTML = `<option value="">-- No Experiments Available --</option>`;
            document.getElementById('btn-add-observation-module').disabled = true;
            document.getElementById('module-experiment-workspace').innerHTML = `
                <div class="glass" style="padding:40px; text-align:center; border-radius:12px; color:var(--text-muted);">
                    No experiments found in this module. 
                    Go to <a href="#" onclick="switchView('projects')">Projects</a> to create a project and add a ${moduleType} experiment.
                </div>
            `;
            return;
        }

        // Populate dropdown
        selector.innerHTML = exps.map(e => `<option value="${e.id}" ${activeExperimentId === e.id ? 'selected' : ''}>${escapeHtml(e.name)} (${escapeHtml(e.project_name)})</option>`).join('');
        
        // Trigger load
        const loadSelectedExp = () => {
            const expId = selector.value;
            activeExperimentId = expId;
            const expObj = exps.find(x => x.id === expId);
            if (expObj) {
                activeProjectId = expObj.project_id;
                loadExperimentWorkspace(expObj);
            }
        };

        selector.addEventListener('change', loadSelectedExp);
        
        // Load initial selected
        if (!activeExperimentId || !exps.some(x => x.id === activeExperimentId)) {
            activeExperimentId = exps[0].id;
        }
        selector.value = activeExperimentId;
        loadSelectedExp();

        document.getElementById('btn-add-observation-module')?.addEventListener('click', () => {
            openObservationFormDialog(moduleType, activeExperimentId);
        });

    } catch (e) {
        console.error(e);
    }
}

async function loadExperimentWorkspace(experiment) {
    const workspace = document.getElementById('module-experiment-workspace');
    if (!workspace) return;

    workspace.innerHTML = `
        <!-- Project Context Bar -->
        <div class="glass" style="padding: 12px 20px; border-radius: 8px; display:flex; justify-content:space-between; align-items:center; font-size:0.82rem; color:var(--text-dim);">
            <div><strong>Objectives:</strong> ${escapeHtml(experiment.notes || 'No notes.')}</div>
            <div><strong>Timeline:</strong> ${experiment.start_date || 'N/A'} to ${experiment.end_date || 'N/A'}</div>
        </div>

        <!-- Control vs Treatment split grid -->
        <div class="split-experiment-layout">
            <!-- Control Group Summary -->
            <div class="card glass experiment-panel">
                <h3 class="panel-header-control">Control Group</h3>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px; margin-top:-8px;">
                    <strong>Setup:</strong> ${escapeHtml(experiment.control_notes || 'Standard protocol')}
                </p>
                <div id="latest-control-metrics">
                    <!-- Dynamic latest parameters -->
                </div>
            </div>

            <!-- Treatment Group Summary -->
            <div class="card glass experiment-panel">
                <h3 class="panel-header-treatment">Treatment Group</h3>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px; margin-top:-8px;">
                    <strong>Setup:</strong> ${escapeHtml(experiment.treatment_notes || 'Test Protocol')}
                </p>
                <div id="latest-treatment-metrics">
                    <!-- Dynamic latest parameters -->
                </div>
            </div>
        </div>

        <!-- Inner tabs for charts, timeline observations table, and media gallery -->
        <div class="tabs-container">
            <div class="tabs-header">
                <button class="tab-btn active" data-exp-tab="trends">Trend Analysis</button>
                <button class="tab-btn" data-exp-tab="timeline">Daily Observation Logs</button>
                <button class="tab-btn" data-exp-tab="gallery">Linked Media</button>
            </div>

            <!-- TRENDS CHART TAB -->
            <div class="tab-content active" id="exp-tab-trends">
                <div class="card glass" style="padding:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap: wrap; gap: 12px;">
                        <h4 style="font-weight:600; font-size:0.9rem;">Comparative Metrics Trend</h4>
                        <div style="display:flex; align-items:center; gap:12px;">
                            <!-- Date Period Selectors -->
                            <div style="display:flex; align-items:center; gap:6px; font-size:0.75rem;">
                                <label for="chart-start-date" style="color:var(--text-muted);">From:</label>
                                <input type="date" id="chart-start-date" class="form-control" style="width:115px; height:28px; font-size:0.72rem; padding:2px 6px;">
                                <label for="chart-end-date" style="color:var(--text-muted);">To:</label>
                                <input type="date" id="chart-end-date" class="form-control" style="width:115px; height:28px; font-size:0.72rem; padding:2px 6px;">
                            </div>
                            
                            <select class="form-control" id="chart-variable-selector" style="width:160px; height:28px; font-size:0.75rem;"></select>
                            
                            <button class="btn btn-sm btn-secondary" id="btn-download-exp-chart" style="height:28px; font-size:0.72rem; padding:2px 8px; display:inline-flex; align-items:center; gap:6px;">
                                <span style="display:inline-block; transform:rotate(90deg); margin-right:2px;">➔</span> Download Graph
                            </button>
                        </div>
                    </div>
                    <div id="experiment-svg-chart-container" style="position:relative;"></div>
                </div>
            </div>

            <!-- TIMELINE LIST TAB -->
            <div class="tab-content" id="exp-tab-timeline">
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr id="timeline-table-headers">
                                <!-- Loaded dynamically -->
                            </tr>
                        </thead>
                        <tbody id="timeline-table-tbody">
                            <!-- Loaded dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- LINKED MEDIA TAB -->
            <div class="tab-content" id="exp-tab-gallery">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h4 style="font-weight:600; font-size:0.9rem;">Experimental Snapshots</h4>
                    <button class="btn btn-sm btn-secondary" id="btn-upload-file-exp">+ Attach Snapshot</button>
                </div>
                <div class="gallery-grid" id="exp-gallery-grid"></div>
            </div>
        </div>
    `;

    // Event listeners
    document.getElementById('btn-upload-file-exp')?.addEventListener('click', () => uploadGalleryFile(experiment.project_id, experiment.id));

    document.querySelectorAll('[data-exp-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-exp-tab');
            document.querySelectorAll('[data-exp-tab]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.getElementById('exp-tab-trends').classList.remove('active');
            document.getElementById('exp-tab-timeline').classList.remove('active');
            document.getElementById('exp-tab-gallery').classList.remove('active');

            document.getElementById(`exp-tab-${targetTab}`).classList.add('active');

            if (targetTab === 'trends') renderExperimentTrendsTab(experiment.id, experiment.type);
            if (targetTab === 'timeline') renderExperimentTimelineTab(experiment.id, experiment.type);
            if (targetTab === 'gallery') refreshExperimentMediaTab(experiment.id);
        });
    });

    // Load initial sub-content
    await refreshLatestGroupMetrics(experiment.id);
    await renderExperimentTrendsTab(experiment.id, experiment.type);
}

// Populate latest observations in Control/Treatment cards
async function refreshLatestGroupMetrics(experimentId) {
    const ctrlContainer = document.getElementById('latest-control-metrics');
    const treatContainer = document.getElementById('latest-treatment-metrics');
    if (!ctrlContainer || !treatContainer) return;

    try {
        const latestCtrl = await window.api.query("SELECT * FROM observations WHERE experiment_id = ? AND group_type = 'control' ORDER BY observation_date DESC LIMIT 1", [experimentId]);
        const latestTreat = await window.api.query("SELECT * FROM observations WHERE experiment_id = ? AND group_type = 'treatment' ORDER BY observation_date DESC LIMIT 1", [experimentId]);

        const renderParamsList = (obsRow) => {
            if (!obsRow) return `<div style="padding:15px 0; color:var(--text-muted); font-size:0.8rem; text-align:center;">No observation logs entered yet.</div>`;
            const dataObj = JSON.parse(obsRow.data);
            
            return `
                <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; margin-bottom:8px;">LATEST LOG: ${obsRow.observation_date}</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                    ${Object.entries(dataObj)
                        .filter(([k, v]) => v !== '' && v !== null)
                        .map(([k, v]) => {
                            const readableKey = k.replace('_', ' ').toUpperCase();
                            return `<div style="font-size:0.8rem; display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
                                <span style="color:var(--text-muted);">${readableKey}:</span>
                                <span style="font-weight:600;">${v}</span>
                            </div>`;
                        }).join('')}
                </div>
            `;
        };

        ctrlContainer.innerHTML = renderParamsList(latestCtrl[0]);
        treatContainer.innerHTML = renderParamsList(latestTreat[0]);

    } catch (e) {
        console.error(e);
    }
}

// Trend calculations & SVG drawing
async function renderExperimentTrendsTab(experimentId, moduleType) {
    const chartContainer = document.getElementById('experiment-svg-chart-container');
    const varSelector = document.getElementById('chart-variable-selector');
    const startDateInput = document.getElementById('chart-start-date');
    const endDateInput = document.getElementById('chart-end-date');
    if (!chartContainer || !varSelector) return;

    try {
        // Fetch observations
        const logs = await window.api.query("SELECT * FROM observations WHERE experiment_id = ? ORDER BY observation_date ASC", [experimentId]);
        
        // Populate default date values if they aren't initialized yet
        if (logs.length > 0) {
            const minDate = logs[0].observation_date;
            const maxDate = logs[logs.length - 1].observation_date;
            
            if (startDateInput && !startDateInput.value) startDateInput.value = minDate;
            if (endDateInput && !endDateInput.value) endDateInput.value = maxDate;
        }

        // Define selectable parameters based on module type
        let variables = [];
        if (moduleType === 'hydroponics') {
            variables = [
                { id: 'ph', name: 'Water pH' },
                { id: 'ec', name: 'EC (mS/cm)' },
                { id: 'tds', name: 'TDS (ppm)' },
                { id: 'plant_height', name: 'Plant Height (cm)' },
                { id: 'leaf_count', name: 'Leaf Count' },
                { id: 'chlorophyll', name: 'Chlorophyll' }
            ];
        } else if (moduleType === 'irrigation') {
            variables = [
                { id: 'ph', name: 'pH Level' },
                { id: 'ec', name: 'EC (dS/m)' },
                { id: 'tds', name: 'TDS (mg/L)' },
                { id: 'sar', name: 'Sodium Adsorption Ratio (SAR)' },
                { id: 'rsc', name: 'Residual Sodium Carbonate (RSC)' }
            ];
        } else if (moduleType === 'soil') {
            variables = [
                { id: 'moisture', name: 'Soil Moisture %' },
                { id: 'ph', name: 'Soil pH' },
                { id: 'n', name: 'Nitrogen (N) mg/kg' },
                { id: 'p', name: 'Phosphorus (P) mg/kg' },
                { id: 'k', name: 'Potassium (K) mg/kg' }
            ];
        } else if (moduleType === 'microgreens') {
            variables = [
                { id: 'plant_height', name: 'Height (cm)' },
                { id: 'yield', name: 'Harvest Yield (g)' },
                { id: 'temp', name: 'Air Temp (°C)' },
                { id: 'humidity', name: 'Humidity %' }
            ];
        }

        // Fill selector
        const curSel = varSelector.value;
        varSelector.innerHTML = variables.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
        if (curSel && variables.some(x => x.id === curSel)) varSelector.value = curSel;

        const variableId = varSelector.value;

        // Apply Date period filter if inputs have values
        const filterStart = startDateInput?.value;
        const filterEnd = endDateInput?.value;
        
        let filteredLogs = logs;
        if (filterStart) {
            filteredLogs = filteredLogs.filter(log => log.observation_date >= filterStart);
        }
        if (filterEnd) {
            filteredLogs = filteredLogs.filter(log => log.observation_date <= filterEnd);
        }

        // Group observations by date
        const dateGroups = {};
        filteredLogs.forEach(log => {
            const date = log.observation_date;
            if (!dateGroups[date]) dateGroups[date] = { control: null, treatment: null };
            
            try {
                const dataObj = JSON.parse(log.data);
                // Calculate SAR and RSC if irrigation
                if (moduleType === 'irrigation') {
                    const calculated = calculateIrrigationValues(dataObj);
                    dataObj.sar = calculated.sar;
                    dataObj.rsc = calculated.rsc;
                }
                const val = parseFloat(dataObj[variableId]);
                if (!isNaN(val)) {
                    dateGroups[date][log.group_type] = val;
                }
            } catch(e) {}
        });

        // Convert to array of points
        const points = Object.entries(dateGroups).map(([date, vals]) => ({
            date,
            control: vals.control,
            treatment: vals.treatment
        })).sort((a,b) => a.date.localeCompare(b.date));

        // Draw the SVG
        drawSvgLineGraph(chartContainer, points, variables.find(x => x.id === variableId)?.name || 'Value');

        // Wire event listeners for selector and date filters
        varSelector.onchange = () => renderExperimentTrendsTab(experimentId, moduleType);
        if (startDateInput) startDateInput.onchange = () => renderExperimentTrendsTab(experimentId, moduleType);
        if (endDateInput) endDateInput.onchange = () => renderExperimentTrendsTab(experimentId, moduleType);

        // Wire download button click
        const downloadBtn = document.getElementById('btn-download-exp-chart');
        if (downloadBtn) {
            downloadBtn.onclick = () => {
                const svg = chartContainer.querySelector('svg');
                if (svg) {
                    window.downloadChartAsImage(svg, `${variables.find(x => x.id === variableId)?.name || 'Chart'}.png`);
                }
            };
        }

    } catch (e) {
        console.error(e);
    }
}

// Calculate SAR and RSC values based on lab numbers
function calculateIrrigationValues(data) {
    const ca = parseFloat(data.calcium || data.Ca || 0); // in mg/L
    const mg = parseFloat(data.magnesium || data.Mg || 0); // in mg/L
    const na = parseFloat(data.sodium || data.Na || 0); // in mg/L
    const co3 = parseFloat(data.carbonate || data.CO3 || 0); // in mg/L
    const hco3 = parseFloat(data.bicarbonate || data.HCO3 || 0); // in mg/L

    // Equivalent weights: Ca: 20.04, Mg: 12.16, Na: 23, CO3: 30, HCO3: 61.02
    const caMeq = ca / 20.04;
    const mgMeq = mg / 12.16;
    const naMeq = na / 23.00;
    const co3Meq = co3 / 30.00;
    const hco3Meq = hco3 / 61.02;

    let sar = 0;
    const denominator = Math.sqrt((caMeq + mgMeq) / 2);
    if (denominator > 0) {
        sar = naMeq / denominator;
    }

    const rsc = (co3Meq + hco3Meq) - (caMeq + mgMeq);

    return {
        sar: isNaN(sar) ? 0 : parseFloat(sar.toFixed(2)),
        rsc: isNaN(rsc) ? 0 : parseFloat(rsc.toFixed(2))
    };
}

// Draw line graph using Vanilla SVG code
function drawSvgLineGraph(container, points, variableName) {
    if (points.length === 0) {
        container.innerHTML = `<div style="padding:50px; text-align:center; color:var(--text-muted); font-size:0.85rem;">Insufficient data to plot trend line.</div>`;
        return;
    }

    const width = 600;
    const height = 260;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;

    // Find min and max values to scale
    let allVals = [];
    points.forEach(p => {
        if (p.control !== null) allVals.push(p.control);
        if (p.treatment !== null) allVals.push(p.treatment);
    });

    if (allVals.length === 0) {
        container.innerHTML = `<div style="padding:50px; text-align:center; color:var(--text-muted); font-size:0.85rem;">No numeric points found.</div>`;
        return;
    }

    let minVal = Math.min(...allVals);
    let maxVal = Math.max(...allVals);

    // Padding for min/max
    if (minVal === maxVal) {
        minVal -= 1;
        maxVal += 1;
    } else {
        const range = maxVal - minVal;
        minVal = Math.max(0, minVal - range * 0.1);
        maxVal = maxVal + range * 0.1;
    }

    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    // Map function
    const getX = (index) => paddingLeft + (index / (points.length - 1 || 1)) * graphWidth;
    const getY = (val) => paddingTop + graphHeight - ((val - minVal) / (maxVal - minVal)) * graphHeight;

    // Build grid and labels
    let gridLines = '';
    let yLabels = '';
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
        const val = minVal + (i / yTicks) * (maxVal - minVal);
        const y = getY(val);
        gridLines += `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" class="chart-grid-line" />`;
        yLabels += `<text x="${paddingLeft - 10}" y="${y + 3}" text-anchor="end" class="chart-label">${val.toFixed(1)}</text>`;
    }

    // Build x labels
    let xLabels = '';
    const xTickStep = Math.max(1, Math.floor(points.length / 5));
    points.forEach((p, idx) => {
        if (idx % xTickStep === 0 || idx === points.length - 1) {
            const x = getX(idx);
            xLabels += `<text x="${x}" y="${height - paddingBottom + 16}" text-anchor="middle" class="chart-label">${p.date.split('-')[1] || ''}/${p.date.split('-')[2] || ''}</text>`;
        }
    });

    // Build paths
    let controlPath = '';
    let treatmentPath = '';
    let controlDots = '';
    let treatmentDots = '';

    points.forEach((p, idx) => {
        const x = getX(idx);
        if (p.control !== null) {
            const y = getY(p.control);
            controlPath += (controlPath === '' ? 'M' : 'L') + `${x},${y}`;
            controlDots += `<circle cx="${x}" cy="${y}" r="4" fill="var(--color-emerald)" stroke="var(--bg-surface)" stroke-width="1.5" />`;
        }
        if (p.treatment !== null) {
            const y = getY(p.treatment);
            treatmentPath += (treatmentPath === '' ? 'M' : 'L') + `${x},${y}`;
            treatmentDots += `<circle cx="${x}" cy="${y}" r="4" fill="var(--color-purple)" stroke="var(--bg-surface)" stroke-width="1.5" />`;
        }
    });

    const svgContent = `
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:100%; overflow:visible;">
            <!-- Grid Lines -->
            ${gridLines}
            
            <!-- Axes -->
            <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" stroke="var(--border-color)" />
            <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="var(--border-color)" />

            <!-- Y Labels -->
            ${yLabels}

            <!-- X Labels -->
            ${xLabels}

            <!-- Trend Lines -->
            ${controlPath ? `<path d="${controlPath}" class="chart-line-control" />` : ''}
            ${treatmentPath ? `<path d="${treatmentPath}" class="chart-line-treatment" />` : ''}

            <!-- Points -->
            ${controlDots}
            ${treatmentDots}

            <!-- Chart Legend inside SVG -->
            <circle cx="485" cy="14" r="4" fill="var(--color-emerald)" />
            <text x="495" y="17.5" fill="var(--text-muted)" font-size="9px" font-family="sans-serif">Control Group</text>
            
            <circle cx="485" cy="26" r="4" fill="var(--color-purple)" />
            <text x="495" y="29.5" fill="var(--text-muted)" font-size="9px" font-family="sans-serif">Treatment Group</text>
        </svg>
    `;

    container.innerHTML = svgContent;
}

// Generate the Observation logs list table
async function renderExperimentTimelineTab(experimentId, moduleType) {
    const headersTr = document.getElementById('timeline-table-headers');
    const tbody = document.getElementById('timeline-table-tbody');
    if (!headersTr || !tbody) return;

    // Define table parameters
    let params = [];
    if (moduleType === 'hydroponics') {
        params = [
            { id: 'ph', label: 'pH' },
            { id: 'ec', label: 'EC' },
            { id: 'tds', label: 'TDS' },
            { id: 'do', label: 'DO' },
            { id: 'temperature', label: 'Temp' },
            { id: 'plant_height', label: 'Height (cm)' },
            { id: 'leaf_count', label: 'Leaves' }
        ];
    } else if (moduleType === 'irrigation') {
        params = [
            { id: 'ph', label: 'pH' },
            { id: 'ec', label: 'EC' },
            { id: 'tds', label: 'TDS' },
            { id: 'do', label: 'DO' },
            { id: 'sar', label: 'SAR (calc)' },
            { id: 'rsc', label: 'RSC (calc)' }
        ];
    } else if (moduleType === 'soil') {
        params = [
            { id: 'moisture', label: 'Moist %' },
            { id: 'ph', label: 'pH' },
            { id: 'n', label: 'N' },
            { id: 'p', label: 'P' },
            { id: 'k', label: 'K' }
        ];
    } else if (moduleType === 'microgreens') {
        params = [
            { id: 'plant_height', label: 'Height (cm)' },
            { id: 'yield', label: 'Yield' },
            { id: 'ph', label: 'pH' },
            { id: 'ec', label: 'EC' }
        ];
    }

    // Set headers
    headersTr.innerHTML = `
        <th>Date</th>
        <th>Group</th>
        ${params.map(p => `<th>${escapeHtml(p.label)}</th>`).join('')}
        <th style="text-align:right;">Actions</th>
    `;

    tbody.innerHTML = '';

    try {
        const rows = await window.api.query("SELECT * FROM observations WHERE experiment_id = ? ORDER BY observation_date DESC, group_type ASC", [experimentId]);
        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${params.length + 3}" style="text-align:center; padding:20px; color:var(--text-muted);">No logs recorded yet.</td></tr>`;
            return;
        }

        rows.forEach(row => {
            const dataObj = JSON.parse(row.data);
            if (moduleType === 'irrigation') {
                const calculated = calculateIrrigationValues(dataObj);
                dataObj.sar = calculated.sar;
                dataObj.rsc = calculated.rsc;
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.observation_date}</strong></td>
                <td><span style="font-weight:600; text-transform:uppercase; font-size:0.7rem; color: ${row.group_type === 'control' ? 'var(--color-emerald)' : 'var(--color-purple)'};">${row.group_type}</span></td>
                ${params.map(p => `<td>${dataObj[p.id] !== undefined && dataObj[p.id] !== '' ? dataObj[p.id] : '—'}</td>`).join('')}
                <td style="text-align:right;">
                    <button class="btn-icon-sm btn-del-obs" title="Delete Log">${AG_ICONS.trash}</button>
                </td>
            `;

            tr.querySelector('.btn-del-obs').addEventListener('click', async () => {
                if (confirm("Delete this observation log entry?")) {
                    await window.api.run("DELETE FROM observations WHERE id = ?", [row.id]);
                    renderExperimentTimelineTab(experimentId, moduleType);
                    refreshLatestGroupMetrics(experimentId);
                }
            });

            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
    }
}

async function refreshExperimentMediaTab(experimentId) {
    const grid = document.getElementById('exp-gallery-grid');
    if (!grid) return;
    grid.innerHTML = '';

    try {
        const items = await window.api.query("SELECT * FROM gallery WHERE experiment_id = ? ORDER BY created_at DESC", [experimentId]);
        if (items.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">No snapshots uploaded.</div>`;
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'gallery-item';
            
            let bgStyle = '';
            if (item.file_type === 'image') {
                bgStyle = `background-image: url('file:///${item.file_path.replace(/\\/g, '/')}');`;
            }

            card.innerHTML = `
                <div class="gallery-thumbnail" style="${bgStyle}">
                    ${item.file_type !== 'image' ? AG_ICONS.reports : ''}
                </div>
                <div class="gallery-info">
                    <span class="gallery-title" title="${escapeHtml(item.file_name)}">${escapeHtml(item.file_name)}</span>
                    <span class="gallery-meta">${(item.file_size / 1024).toFixed(1)} KB</span>
                </div>
            `;
            
            card.addEventListener('click', () => {
                showGlobalModal(item.file_name, `
                    <div style="text-align:center;">
                        ${item.file_type === 'image' ? `<img src="file:///${item.file_path.replace(/\\/g, '/')}" style="max-width:100%; max-height:400px; border-radius:8px;">` : `<div style="padding:40px 0; color:var(--text-muted);">${AG_ICONS.reports} Document</div>`}
                        <p style="margin-top:16px; font-size:0.9rem; color:var(--text-dim);">${escapeHtml(item.description || 'No description')}</p>
                    </div>
                `, `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`);
            });

            grid.appendChild(card);
        });
    } catch(e) {
        console.error(e);
    }
}

// Dialog form for logging data
function getFieldsHtmlForModule(moduleType, prefix) {
    if (moduleType === 'hydroponics') {
        return `
            <div style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--primary); border-bottom:1px solid var(--border-color); padding-bottom:2px; margin-bottom:8px;">Water Parameters</div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-ph">pH</label><input type="number" step="any" class="form-control" id="${prefix}-ph"></div>
                <div class="form-group"><label for="${prefix}-ec">EC (mS/cm)</label><input type="number" step="any" class="form-control" id="${prefix}-ec"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-tds">TDS (ppm)</label><input type="number" step="any" class="form-control" id="${prefix}-tds"></div>
                <div class="form-group"><label for="${prefix}-do">DO (mg/L)</label><input type="number" step="any" class="form-control" id="${prefix}-do"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-temperature">Temperature (°C)</label><input type="number" step="any" class="form-control" id="${prefix}-temperature"></div>
                <div class="form-group"><label for="${prefix}-orp">ORP (mV)</label><input type="number" step="any" class="form-control" id="${prefix}-orp"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-salinity">Salinity (ppt)</label><input type="number" step="any" class="form-control" id="${prefix}-salinity"></div>
                <div class="form-group"><label for="${prefix}-specific_gravity">Specific Gravity</label><input type="number" step="any" class="form-control" id="${prefix}-specific_gravity"></div>
            </div>

            <div style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--color-teal); border-bottom:1px solid var(--border-color); padding-bottom:2px; margin-top:10px; margin-bottom:8px;">Environmental Conditions</div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-air_temp">Air Temp (°C)</label><input type="number" step="any" class="form-control" id="${prefix}-air_temp"></div>
                <div class="form-group"><label for="${prefix}-humidity">Humidity %</label><input type="number" step="any" class="form-control" id="${prefix}-humidity"></div>
            </div>
            <div class="form-group"><label for="${prefix}-light_intensity">Light Intensity (Lux)</label><input type="number" step="any" class="form-control" id="${prefix}-light_intensity"></div>

            <div style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--color-purple); border-bottom:1px solid var(--border-color); padding-bottom:2px; margin-top:10px; margin-bottom:8px;">Plant Growth Markers</div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-plant_height">Plant Height (cm)</label><input type="number" step="any" class="form-control" id="${prefix}-plant_height"></div>
                <div class="form-group"><label for="${prefix}-root_length">Root Length (cm)</label><input type="number" step="any" class="form-control" id="${prefix}-root_length"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-leaf_count">Leaf Count</label><input type="number" step="any" class="form-control" id="${prefix}-leaf_count"></div>
                <div class="form-group"><label for="${prefix}-fresh_weight">Fresh Weight (g)</label><input type="number" step="any" class="form-control" id="${prefix}-fresh_weight"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-dry_weight">Dry Weight (g)</label><input type="number" step="any" class="form-control" id="${prefix}-dry_weight"></div>
                <div class="form-group"><label for="${prefix}-chlorophyll">Chlorophyll Index</label><input type="number" step="any" class="form-control" id="${prefix}-chlorophyll"></div>
            </div>
            <div class="form-group"><label for="${prefix}-health_score">Health Score (1-100)</label><input type="number" step="any" class="form-control" id="${prefix}-health_score"></div>
        `;
    } else if (moduleType === 'irrigation') {
        return `
            <div style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--primary); border-bottom:1px solid var(--border-color); padding-bottom:2px; margin-bottom:8px;">General Properties</div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-ph">pH</label><input type="number" step="any" class="form-control" id="${prefix}-ph"></div>
                <div class="form-group"><label for="${prefix}-ec">EC (dS/m)</label><input type="number" step="any" class="form-control" id="${prefix}-ec"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-tds">TDS (mg/L)</label><input type="number" step="any" class="form-control" id="${prefix}-tds"></div>
                <div class="form-group"><label for="${prefix}-do">DO (mg/L)</label><input type="number" step="any" class="form-control" id="${prefix}-do"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-temperature">Temperature (°C)</label><input type="number" step="any" class="form-control" id="${prefix}-temperature"></div>
                <div class="form-group"><label for="${prefix}-bod">BOD (mg/L)</label><input type="number" step="any" class="form-control" id="${prefix}-bod"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-cod">COD (mg/L)</label><input type="number" step="any" class="form-control" id="${prefix}-cod"></div>
                <div class="form-group"><label for="${prefix}-salinity">Salinity (ppt)</label><input type="number" step="any" class="form-control" id="${prefix}-salinity"></div>
            </div>
            
            <div style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--primary); border-bottom:1px solid var(--border-color); padding-bottom:2px; margin-top:10px; margin-bottom:8px;">Sodicity Inputs (meq/L)</div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-sodium">Sodium (Na+)</label><input type="number" step="any" class="form-control" id="${prefix}-sodium"></div>
                <div class="form-group"><label for="${prefix}-calcium">Calcium (Ca2+)</label><input type="number" step="any" class="form-control" id="${prefix}-calcium"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-magnesium">Magnesium (Mg2+)</label><input type="number" step="any" class="form-control" id="${prefix}-magnesium"></div>
                <div class="form-group"><label for="${prefix}-carbonate">Carbonate (CO32-)</label><input type="number" step="any" class="form-control" id="${prefix}-carbonate"></div>
            </div>
            <div class="form-group"><label for="${prefix}-bicarbonate">Bicarbonate (HCO3-)</label><input type="number" step="any" class="form-control" id="${prefix}-bicarbonate"></div>

            <div style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--color-teal); border-bottom:1px solid var(--border-color); padding-bottom:2px; margin-top:10px; margin-bottom:8px;">Anions & Cations (mg/L)</div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-alkalinity">Alkalinity</label><input type="number" step="any" class="form-control" id="${prefix}-alkalinity"></div>
                <div class="form-group"><label for="${prefix}-hardness">Hardness</label><input type="number" step="any" class="form-control" id="${prefix}-hardness"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-chloride">Chloride</label><input type="number" step="any" class="form-control" id="${prefix}-chloride"></div>
                <div class="form-group"><label for="${prefix}-sulphate">Sulphate</label><input type="number" step="any" class="form-control" id="${prefix}-sulphate"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-nitrate">Nitrate</label><input type="number" step="any" class="form-control" id="${prefix}-nitrate"></div>
                <div class="form-group"><label for="${prefix}-nitrite">Nitrite</label><input type="number" step="any" class="form-control" id="${prefix}-nitrite"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-phosphate">Phosphate</label><input type="number" step="any" class="form-control" id="${prefix}-phosphate"></div>
                <div class="form-group"><label for="${prefix}-ammonia">Ammonia</label><input type="number" step="any" class="form-control" id="${prefix}-ammonia"></div>
            </div>
        `;
    } else if (moduleType === 'soil') {
        return `
            <div style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--primary); border-bottom:1px solid var(--border-color); padding-bottom:2px; margin-bottom:8px;">Physical Properties</div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-moisture">Moisture %</label><input type="number" step="any" class="form-control" id="${prefix}-moisture"></div>
                <div class="form-group"><label for="${prefix}-texture">Soil Texture</label><input type="text" class="form-control" id="${prefix}-texture" placeholder="e.g. Sandy Loam"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-bulk_density">Bulk Density (g/cm³)</label><input type="number" step="any" class="form-control" id="${prefix}-bulk_density"></div>
                <div class="form-group"><label for="${prefix}-water_holding_capacity">Water Holding Cap %</label><input type="number" step="any" class="form-control" id="${prefix}-water_holding_capacity"></div>
            </div>

            <div style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--color-teal); border-bottom:1px solid var(--border-color); padding-bottom:2px; margin-top:10px; margin-bottom:8px;">Chemical Properties</div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-ph">pH Level</label><input type="number" step="any" class="form-control" id="${prefix}-ph"></div>
                <div class="form-group"><label for="${prefix}-ec">EC (dS/m)</label><input type="number" step="any" class="form-control" id="${prefix}-ec"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-organic_carbon">Organic Carbon %</label><input type="number" step="any" class="form-control" id="${prefix}-organic_carbon"></div>
                <div class="form-group"><label for="${prefix}-organic_matter">Organic Matter %</label><input type="number" step="any" class="form-control" id="${prefix}-organic_matter"></div>
            </div>

            <div style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--color-purple); border-bottom:1px solid var(--border-color); padding-bottom:2px; margin-top:10px; margin-bottom:8px;">Macronutrients (mg/kg)</div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-n">Nitrogen (N)</label><input type="number" step="any" class="form-control" id="${prefix}-n"></div>
                <div class="form-group"><label for="${prefix}-p">Phosphorus (P)</label><input type="number" step="any" class="form-control" id="${prefix}-p"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-k">Potassium (K)</label><input type="number" step="any" class="form-control" id="${prefix}-k"></div>
                <div class="form-group"><label for="${prefix}-ca">Calcium (Ca)</label><input type="number" step="any" class="form-control" id="${prefix}-ca"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-mg">Magnesium (Mg)</label><input type="number" step="any" class="form-control" id="${prefix}-mg"></div>
                <div class="form-group"><label for="${prefix}-s">Sulphur (S)</label><input type="number" step="any" class="form-control" id="${prefix}-s"></div>
            </div>

            <div style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--color-yellow); border-bottom:1px solid var(--border-color); padding-bottom:2px; margin-top:10px; margin-bottom:8px;">Micronutrients (mg/kg)</div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-zn">Zinc (Zn)</label><input type="number" step="any" class="form-control" id="${prefix}-zn"></div>
                <div class="form-group"><label for="${prefix}-fe">Iron (Fe)</label><input type="number" step="any" class="form-control" id="${prefix}-fe"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-mn">Manganese (Mn)</label><input type="number" step="any" class="form-control" id="${prefix}-mn"></div>
                <div class="form-group"><label for="${prefix}-cu">Copper (Cu)</label><input type="number" step="any" class="form-control" id="${prefix}-cu"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-b">Boron (B)</label><input type="number" step="any" class="form-control" id="${prefix}-b"></div>
                <div class="form-group"><label for="${prefix}-mo">Molybdenum (Mo)</label><input type="number" step="any" class="form-control" id="${prefix}-mo"></div>
            </div>
        `;
    } else if (moduleType === 'microgreens') {
        return `
            <div style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--primary); border-bottom:1px solid var(--border-color); padding-bottom:2px; margin-bottom:8px;">Tray & Crop Info</div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-tray_info">Tray ID</label><input type="text" class="form-control" id="${prefix}-tray_info" placeholder="e.g. Tray B-4"></div>
                <div class="form-group"><label for="${prefix}-crop_info">Crop Variety</label><input type="text" class="form-control" id="${prefix}-crop_info" placeholder="e.g. Radish"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-germination">Germination %</label><input type="number" step="any" class="form-control" id="${prefix}-germination"></div>
                <div class="form-group"><label for="${prefix}-plant_height">Plant Height (cm)</label><input type="number" step="any" class="form-control" id="${prefix}-plant_height"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-yield">Harvest Yield (g)</label><input type="number" step="any" class="form-control" id="${prefix}-yield"></div>
                <div class="form-group"><label for="${prefix}-fresh_weight">Fresh Weight (g)</label><input type="number" step="any" class="form-control" id="${prefix}-fresh_weight"></div>
            </div>
            <div class="form-group"><label for="${prefix}-dry_weight">Dry Weight (g)</label><input type="number" step="any" class="form-control" id="${prefix}-dry_weight"></div>

            <div style="font-weight:600; font-size:0.75rem; text-transform:uppercase; color:var(--color-teal); border-bottom:1px solid var(--border-color); padding-bottom:2px; margin-top:10px; margin-bottom:8px;">Water & Environmental Parameters</div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-ph">pH Level</label><input type="number" step="any" class="form-control" id="${prefix}-ph"></div>
                <div class="form-group"><label for="${prefix}-ec">EC (mS/cm)</label><input type="number" step="any" class="form-control" id="${prefix}-ec"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-tds">TDS (ppm)</label><input type="number" step="any" class="form-control" id="${prefix}-tds"></div>
                <div class="form-group"><label for="${prefix}-temperature">Temperature (°C)</label><input type="number" step="any" class="form-control" id="${prefix}-temperature"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="${prefix}-humidity">Humidity %</label><input type="number" step="any" class="form-control" id="${prefix}-humidity"></div>
                <div class="form-group"><label for="${prefix}-light">Light (Lux)</label><input type="number" step="any" class="form-control" id="${prefix}-light"></div>
            </div>
        `;
    }
    return '';
}

// Dialog form for logging data (Side-by-Side Control and Treatment columns)
async function openObservationFormDialog(moduleType, experimentId) {
    const title = "Add Side-by-Side Experimental Observation";

    const formHtml = `
        <form id="obs-form">
            <div class="form-row" style="grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px; align-items:flex-end;">
                <div class="form-group">
                    <label for="obs-date" style="font-weight:700;">Observation Date</label>
                    <input type="date" class="form-control" id="obs-date" value="${new Date().toISOString().split('T')[0]}" style="text-align:center;">
                </div>
                <div class="form-group">
                    <label for="obs-template" style="font-weight:700; color:var(--primary);">Apply Target Template</label>
                    <select class="form-control" id="obs-template">
                        <option value="">-- Loading templates... --</option>
                    </select>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px; max-height: 380px; overflow-y: auto; padding-right:8px;">
                <!-- Control Group Column (Left) -->
                <div style="border-right: 1px solid var(--border-color); padding-right:16px;">
                    <h4 style="font-size:0.85rem; font-weight:700; color:var(--color-emerald); text-transform:uppercase; margin-bottom:12px; border-bottom:2px solid var(--color-emerald); padding-bottom:4px;">Control Group Data</h4>
                    ${getFieldsHtmlForModule(moduleType, 'ctrl')}
                </div>
                
                <!-- Treatment Group Column (Right) -->
                <div style="padding-left:8px;">
                    <h4 style="font-size:0.85rem; font-weight:700; color:var(--color-purple); text-transform:uppercase; margin-bottom:12px; border-bottom:2px solid var(--color-purple); padding-bottom:4px;">Treatment Group Data</h4>
                    ${getFieldsHtmlForModule(moduleType, 'treat')}
                </div>
            </div>
        </form>
    `;

    const footerHtml = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-obs">Save Side-by-Side Logs</button>
    `;

    showGlobalModal(title, formHtml, footerHtml);

    // Expand the modal width to fit the split columns
    const modal = document.getElementById('global-modal');
    const win = modal?.querySelector('.modal-window');
    if (win) {
        win.style.width = '850px';
    }

    // Load templates in dropdown
    const templateSelect = document.getElementById('obs-template');
    try {
        const templates = await window.api.query("SELECT * FROM templates WHERE type = ? ORDER BY name ASC", [moduleType]);
        if (templates.length === 0) {
            templateSelect.innerHTML = `<option value="">-- No templates defined --</option>`;
        } else {
            templateSelect.innerHTML = `
                <option value="">-- Select a template to apply targets --</option>
                ${templates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
            `;
        }

        // Live validation when template selection changes
        templateSelect?.addEventListener('change', () => {
            const selectedTplId = templateSelect.value;
            const selectedTpl = templates.find(t => t.id === selectedTplId);

            // Clear previous target labels and borders
            document.querySelectorAll('.tpl-target-label').forEach(el => el.remove());
            document.querySelectorAll('#obs-form .form-control').forEach(el => {
                if (el.id !== 'obs-date' && el.id !== 'obs-template') {
                    el.style.borderColor = '';
                    el.placeholder = '';
                }
            });

            if (!selectedTpl) return;

            const targets = JSON.parse(selectedTpl.data);

            Object.entries(targets).forEach(([key, targetValue]) => {
                const inputs = [
                    document.getElementById(`ctrl-${key}`),
                    document.getElementById(`treat-${key}`)
                ];

                inputs.forEach(input => {
                    if (!input) return;

                    // Set field placeholder to the template standard target value
                    input.placeholder = `Target: ${targetValue}`;

                    // Append small target indicator text below input
                    const labelDiv = document.createElement('div');
                    labelDiv.className = 'tpl-target-label';
                    labelDiv.style.cssText = 'font-size:0.65rem; color:var(--text-muted); font-weight:600; margin-top:2px;';
                    labelDiv.textContent = `Target standard: ${targetValue}`;
                    input.parentNode.appendChild(labelDiv);

                    // Add dynamic border and label styling on value changes
                    const validateValue = () => {
                        const val = parseFloat(input.value);
                        if (isNaN(val)) {
                            input.style.borderColor = '';
                            labelDiv.style.color = 'var(--text-muted)';
                            labelDiv.textContent = `Target standard: ${targetValue}`;
                            return;
                        }

                        const targetNum = parseFloat(targetValue);
                        const diff = Math.abs(val - targetNum);

                        let isDrifted = false;
                        if (key === 'ph' && diff > 0.5) isDrifted = true;
                        else if (key === 'ec' && diff > 0.3) isDrifted = true;
                        else if (key === 'tds' && diff > 150) isDrifted = true;
                        else if (key === 'temp' && diff > 3.0) isDrifted = true;
                        else if (key === 'temperature' && diff > 3.0) isDrifted = true;

                        if (isDrifted) {
                            input.style.borderColor = 'var(--color-yellow)';
                            labelDiv.style.color = 'var(--color-yellow)';
                            labelDiv.textContent = `⚠️ Drift Alert: Target is ${targetValue} (Diff: ${diff.toFixed(1)})`;
                        } else {
                            input.style.borderColor = 'var(--color-emerald)';
                            labelDiv.style.color = 'var(--color-emerald)';
                            labelDiv.textContent = `✓ Optimal: matches Target (${targetValue})`;
                        }
                    };

                    input.addEventListener('input', validateValue);
                });
            });
        });

    } catch (e) {
        console.error("Failed to load templates for selector", e);
    }

    document.getElementById('btn-save-obs')?.addEventListener('click', async () => {
        const date = document.getElementById('obs-date').value;

        // Scrape Control inputs
        const controlData = {};
        const controlInputs = document.getElementById('obs-form').querySelectorAll('input[id^="ctrl-"], select[id^="ctrl-"]');
        controlInputs.forEach(input => {
            const key = input.id.replace('ctrl-', '');
            controlData[key] = input.value;
        });

        // Scrape Treatment inputs
        const treatmentData = {};
        const treatmentInputs = document.getElementById('obs-form').querySelectorAll('input[id^="treat-"], select[id^="treat-"]');
        treatmentInputs.forEach(input => {
            const key = input.id.replace('treat-', '');
            treatmentData[key] = input.value;
        });

        const controlObsId = `obs-c-${Date.now()}`;
        const treatmentObsId = `obs-t-${Date.now()}`;

        try {
            // Save Control Log
            await window.api.run(`
                INSERT INTO observations (id, experiment_id, group_type, observation_date, data, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [controlObsId, experimentId, 'control', date, JSON.stringify(controlData), new Date().toISOString()]);

            // Save Treatment Log
            await window.api.run(`
                INSERT INTO observations (id, experiment_id, group_type, observation_date, data, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [treatmentObsId, experimentId, 'treatment', date, JSON.stringify(treatmentData), new Date().toISOString()]);

            closeModal();
            
            // Reload workspaces
            const selector = document.getElementById('active-exp-selector');
            if (selector) {
                selector.dispatchEvent(new Event('change'));
            }
            logFacilityActivity(`Side-by-side observations logged for: ${date}`);
        } catch (err) {
            alert("Failed to save observation: " + err.message);
        }
    });
}

/* ==========================================
   MODULE 7: WATER ANALYSIS (WQI CALC & LOGS)
   ========================================== */

async function renderWaterAnalysis(container) {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="font-size: 1.4rem; font-weight:700;">Water Chemical Quality Analysis</h2>
                    <p style="color:var(--text-dim); font-size:0.85rem;">Laboratory results analysis, safety reports, and Water Quality Index (WQI) evaluation.</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-primary" id="btn-register-water-sample">+ Register Sample</button>
                </div>
            </div>

            <!-- Main Layout Split -->
            <div style="display:grid; grid-template-columns: 1fr 2fr; gap:20px; align-items:start;">
                <!-- Left: Registered Samples List -->
                <div class="card glass" style="padding:16px; max-height: 550px; overflow-y:auto; gap:10px;">
                    <h3 style="font-size:0.95rem; font-weight:700; border-bottom:1px solid var(--border-color); padding-bottom:8px;">Sample Register</h3>
                    <div style="display:flex; flex-direction:column; gap:8px;" id="water-samples-register-list">
                        <!-- Loaded dynamically -->
                    </div>
                </div>

                <!-- Right: Selected Sample Details & WQI Breakdown -->
                <div id="water-sample-dashboard-panel">
                    <div class="glass" style="padding:40px; text-align:center; border-radius:12px; color:var(--text-muted);">
                        Select a sample from the register to view chemical analytics and WQI metrics.
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-register-water-sample')?.addEventListener('click', () => openWaterSampleDialog());
    await refreshWaterSamplesList();
}

async function refreshWaterSamplesList() {
    const listContainer = document.getElementById('water-samples-register-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    try {
        const samples = await window.api.query("SELECT * FROM water_samples ORDER BY register_date DESC");
        
        if (samples.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.8rem;">No samples registered.</div>`;
            return;
        }

        samples.forEach(s => {
            const card = document.createElement('div');
            card.style.cssText = `
                padding: 10px 12px;
                border-radius: 8px;
                border: 1px solid var(--border-color);
                background: rgba(255,255,255,0.02);
                cursor: pointer;
                display: flex;
                flex-direction: column;
                gap: 4px;
            `;
            
            let statusDot = '●';
            let dotColor = 'var(--color-emerald)';
            if (s.wqi_score >= 100) dotColor = 'var(--color-yellow)';
            if (s.wqi_score >= 200) dotColor = 'var(--color-red)';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:600; font-size:0.85rem; color:var(--text-main);">${escapeHtml(s.sample_name)}</span>
                    <span style="color:${dotColor}; font-size:0.8rem;">${statusDot}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-muted);">
                    <span>${s.register_date}</span>
                    <span>WQI: ${s.wqi_score !== null ? s.wqi_score.toFixed(1) : 'N/A'}</span>
                </div>
            `;

            card.addEventListener('click', () => {
                // Remove selected states
                listContainer.querySelectorAll('div').forEach(el => el.style.borderColor = 'var(--border-color)');
                card.style.borderColor = 'var(--primary)';
                loadWaterSampleDashboard(s.id);
            });

            listContainer.appendChild(card);
        });

    } catch (e) {
        console.error(e);
    }
}

async function loadWaterSampleDashboard(sampleId) {
    const panel = document.getElementById('water-sample-dashboard-panel');
    if (!panel) return;

    try {
        const rows = await window.api.query("SELECT * FROM water_samples WHERE id = ?", [sampleId]);
        if (rows.length === 0) return;
        const sample = rows[0];
        const dataObj = JSON.parse(sample.data);

        let badgeClass = 'wqi-excellent';
        let safetyText = 'Safe for agricultural and municipal supply';
        const score = sample.wqi_score;
        if (score >= 50 && score < 100) { badgeClass = 'wqi-good'; safetyText = 'Good quality water'; }
        if (score >= 100 && score < 200) { badgeClass = 'wqi-poor'; safetyText = 'Poor quality - treatment advised'; }
        if (score >= 200 && score < 300) { badgeClass = 'wqi-very-poor'; safetyText = 'Very poor quality - irrigation restriction'; }
        if (score >= 300) { badgeClass = 'wqi-unsuitable'; safetyText = 'UNSUITABLE/HAZARDOUS FOR USE'; }

        panel.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:20px;">
                <!-- WQI Card -->
                <div class="card glass wqi-card">
                    <div class="wqi-gauge">
                        <span class="wqi-gauge-value">${sample.wqi_score !== null ? sample.wqi_score.toFixed(1) : '—'}</span>
                        <span class="wqi-gauge-label">WQI score</span>
                    </div>
                    <div class="wqi-details">
                        <span class="wqi-class-badge ${badgeClass}">${sample.wqi_class || 'Unknown'}</span>
                        <h3 style="margin-top:8px;">${escapeHtml(sample.sample_name)}</h3>
                        <p style="font-size:0.85rem; color:var(--text-dim);">${safetyText}</p>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
                            Registered: ${sample.register_date} | Source: ${escapeHtml(sample.source || 'N/A')} | Collected By: ${escapeHtml(sample.collected_by || 'N/A')}
                        </div>
                    </div>
                </div>

                <!-- Laboratory Results Values -->
                <div class="card glass" style="padding:20px; gap:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
                        <h4 style="font-weight:700; font-size:0.95rem;">Detailed Laboratory Assay</h4>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <button class="btn btn-sm btn-secondary" id="btn-print-active-sample">Print Report</button>
                            <button class="btn btn-sm btn-secondary" id="btn-edit-active-sample">Edit Sample</button>
                            <button class="btn btn-sm btn-danger" id="btn-delete-active-sample">Delete Sample</button>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px;">
                        ${Object.entries(dataObj).map(([k, v]) => {
                            if (v === '' || v === null) return '';
                            const readableKey = k.replace('_', ' ').toUpperCase();
                            return `
                                <div style="padding:8px; border-radius:6px; background:rgba(0,0,0,0.1); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">${readableKey}</span>
                                    <span style="font-size:0.85rem; font-weight:700; color:var(--text-main);">${v}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-delete-active-sample')?.addEventListener('click', async () => {
            if (confirm("Delete this water sample and WQI scores?")) {
                await window.api.run("DELETE FROM water_samples WHERE id = ?", [sample.id]);
                panel.innerHTML = `
                    <div class="glass" style="padding:40px; text-align:center; border-radius:12px; color:var(--text-muted);">
                        Select a sample from the register to view chemical analytics and WQI metrics.
                    </div>
                `;
                await refreshWaterSamplesList();
            }
        });

        document.getElementById('btn-edit-active-sample')?.addEventListener('click', () => {
            openWaterSampleDialog(sample.id);
        });

        document.getElementById('btn-print-active-sample')?.addEventListener('click', () => {
            window.printSingleWaterSample(sample, dataObj, { score: sample.wqi_score, rating: sample.wqi_class }, badgeClass, safetyText);
        });

    } catch (e) {
        console.error(e);
    }
}

// Calculate WQI (Water Quality Index)
function calculateWqi(data) {
    // Parameters standard thresholds (S_i) and weights (w_i)
    // Based on agricultural/drinking water standards
    const standards = {
        ph: { s: 8.5, w: 4 },
        ec: { s: 1000, w: 3 }, // in uS/cm
        tds: { s: 500, w: 4 }, // in mg/L
        do: { s: 5.0, w: 5 }, // in mg/L
        bod: { s: 5.0, w: 5 }, // in mg/L
        cod: { s: 10.0, w: 4 }, // in mg/L
        nitrate: { s: 45.0, w: 5 }, // in mg/L
        fluoride: { s: 1.5, w: 5 }, // in mg/L
        chloride: { s: 250.0, w: 3 }, // in mg/L
        sulphate: { s: 250.0, w: 3 }, // in mg/L
        e_coli: { s: 1.0, w: 5 } // MPN/100ml
    };

    let totalWeight = 0;
    Object.keys(standards).forEach(key => {
        const val = parseFloat(data[key]);
        if (!isNaN(val)) {
            totalWeight += standards[key].w;
        }
    });

    if (totalWeight === 0) return { score: 0, rating: 'Undefined' };

    let wqiSum = 0;
    Object.keys(standards).forEach(key => {
        const val = parseFloat(data[key]);
        if (!isNaN(val)) {
            const std = standards[key].s;
            const w = standards[key].w;
            const relativeWeight = w / totalWeight;
            
            let q = 0;
            if (key === 'ph') {
                q = ((val - 7.0) / (std - 7.0)) * 100;
            } else if (key === 'do') {
                q = ((14.6 - val) / (14.6 - std)) * 100;
            } else {
                q = (val / std) * 100;
            }
            
            q = Math.max(0, q); // Keep positive
            wqiSum += relativeWeight * q;
        }
    });

    const score = wqiSum;
    let rating = 'Excellent Water';
    if (score >= 50 && score < 100) rating = 'Good Water';
    if (score >= 100 && score < 200) rating = 'Poor Water';
    if (score >= 200 && score < 300) rating = 'Very Poor Water';
    if (score >= 300) rating = 'Unsuitable for Drinking';

    return {
        score: parseFloat(score.toFixed(1)),
        rating
    };
}

// Print utility to print a single water sample's laboratory metrics natively (optimized for single-page layout)
window.printSingleWaterSample = function(sample, dataObj, wqiResult, badgeClass, safetyText) {
    const printDiv = document.createElement('div');
    printDiv.id = 'single-sample-print-area';
    printDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: white;
        color: #1a1a24;
        z-index: 99999;
        padding: 30px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        overflow-y: auto;
    `;
    
    // Filter active parameters and divide them side-by-side (2 columns) to fit A4 single-page
    const activeParams = Object.entries(dataObj).filter(([k, v]) => v !== '' && v !== null);
    const halfLength = Math.ceil(activeParams.length / 2);
    const leftColumnParams = activeParams.slice(0, halfLength);
    const rightColumnParams = activeParams.slice(halfLength);
    
    let rowsHtml = '';
    for (let i = 0; i < halfLength; i++) {
        const left = leftColumnParams[i];
        const right = rightColumnParams[i];
        
        const leftKey = left ? left[0].replace(/_/g, ' ').toUpperCase() : '';
        const leftVal = left ? left[1] : '';
        const rightKey = right ? right[0].replace(/_/g, ' ').toUpperCase() : '';
        const rightVal = right ? right[1] : '';
        
        rowsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px 8px; font-weight: 600; color: #4a5568; font-size: 0.75rem; border-right: 1px solid #e2e8f0; width: 35%;">${leftKey}</td>
                <td style="padding: 6px 8px; font-weight: 700; color: #1a202c; font-size: 0.78rem; border-right: 2px solid #cbd5e0; width: 15%;">${leftVal}</td>
                <td style="padding: 6px 8px; font-weight: 600; color: #4a5568; font-size: 0.75rem; border-right: 1px solid #e2e8f0; width: 35%;">${rightKey}</td>
                <td style="padding: 6px 8px; font-weight: 700; color: #1a202c; font-size: 0.78rem; width: 15%;">${rightVal}</td>
            </tr>
        `;
    }

    printDiv.innerHTML = `
        <div style="text-align: center; border-bottom: 3px solid #10b981; padding-bottom: 12px; margin-bottom: 16px;">
            <h1 style="margin: 0; color: #10b981; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">AGRITECH LABORATORY ASSAY REPORT</h1>
            <p style="margin: 4px 0 0 0; color: #718096; font-size: 12px;">Water Chemical Quality & Safety Evaluation (LIMS)</p>
        </div>
        
        <div style="margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background-color: #f7fafc;">
            <h2 style="margin: 0 0 8px 0; font-size: 13px; color: #2d3748; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-weight: 700;">Sample Metadata</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <tr>
                    <td style="padding: 4px 0; font-weight: 700; color: #718096; width: 120px;">Sample Identifier:</td>
                    <td style="padding: 4px 0; color: #1a202c; font-weight: 600;">${escapeHtml(sample.sample_name)}</td>
                    <td style="padding: 4px 0; font-weight: 700; color: #718096; width: 120px;">Collection Date:</td>
                    <td style="padding: 4px 0; color: #1a202c;">${sample.register_date}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 700; color: #718096;">Water Source:</td>
                    <td style="padding: 4px 0; color: #1a202c;">${escapeHtml(sample.source || 'N/A')}</td>
                    <td style="padding: 4px 0; font-weight: 700; color: #718096;">Sampling Location:</td>
                    <td style="padding: 4px 0; color: #1a202c;">${escapeHtml(sample.location || 'N/A')}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 700; color: #718096;">Collected By:</td>
                    <td style="padding: 4px 0; color: #1a202c;">${escapeHtml(sample.collected_by || 'N/A')}</td>
                    <td style="padding: 4px 0; font-weight: 700; color: #718096;">WQI Evaluation:</td>
                    <td style="padding: 4px 0; font-weight: 700; color: #10b981;">${wqiResult.score !== null ? wqiResult.score.toFixed(1) : 'N/A'} (${wqiResult.rating || 'Unknown'})</td>
                </tr>
            </table>
        </div>

        <div style="margin-bottom: 16px; padding: 10px 14px; border: 1px solid #cbd5e0; border-radius: 8px; background: #fffaf0; font-size: 12px; color: #744210; border-left: 4px solid #dd6b20;">
            <strong style="color: #9c4221;">Safety Status Index:</strong> ${safetyText}
        </div>

        <div>
            <h2 style="margin: 0 0 8px 0; font-size: 13px; color: #2d3748; padding-bottom: 4px; font-weight: 700;">Detailed Chemical Assays</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; border: 1px solid #cbd5e0;">
                <thead>
                    <tr style="background: #edf2f7; border-bottom: 2px solid #cbd5e0;">
                        <th style="padding: 6px 8px; color: #4a5568; font-weight: 700; border-right: 1px solid #cbd5e0;">PARAMETER</th>
                        <th style="padding: 6px 8px; color: #4a5568; font-weight: 700; border-right: 2px solid #cbd5e0;">VALUE</th>
                        <th style="padding: 6px 8px; color: #4a5568; font-weight: 700; border-right: 1px solid #cbd5e0;">PARAMETER</th>
                        <th style="padding: 6px 8px; color: #4a5568; font-weight: 700;">VALUE</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
        
        <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #a0aec0; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            Generated automatically by Agritech Research & Lab System. All metrics retrieved from local secure sqlite db.
        </div>
    `;

    document.body.appendChild(printDiv);
    
    // Hide main UI container to isolate printable canvas
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.style.display = 'none';

    window.print();

    // Restore UI container
    if (appContainer) appContainer.style.display = '';
    document.body.removeChild(printDiv);
};

// Global high-fidelity SVG chart export to PNG utility (2x scale for crisp lines, dynamically scaled to display bounds)
window.downloadChartAsImage = function(svgElement, filename = 'chart.png') {
    if (!svgElement) return;
    try {
        const clone = svgElement.cloneNode(true);
        
        // Grab browser-rendered size of the element to avoid cropping overflows
        const rect = svgElement.getBoundingClientRect();
        const width = rect.width || svgElement.viewBox.baseVal.width || 600;
        const height = rect.height || svgElement.viewBox.baseVal.height || 260;
        
        // Apply explicit dimensions to clone to prevent sizing collapse inside Blob loader
        clone.setAttribute('width', width);
        clone.setAttribute('height', height);

        let svgString = new XMLSerializer().serializeToString(clone);
        
        // Inline core theme colors for canvas rendering
        svgString = svgString
            .replace(/var\(--color-emerald\)/g, '#10b981')
            .replace(/var\(--color-purple\)/g, '#8b5cf6')
            .replace(/var\(--border-color\)/g, 'rgba(255,255,255,0.08)')
            .replace(/var\(--bg-surface\)/g, '#1b1e2a')
            .replace(/var\(--text-muted\)/g, '#8e9aa8')
            .replace(/var\(--text-main\)/g, '#f1f5f9');
            
        // Embed crisp stroke styles for canvas engine
        svgString = svgString
            .replace(/class="chart-line-control"/g, 'class="chart-line-control" stroke="#10b981" stroke-width="3" fill="none"')
            .replace(/class="chart-line-treatment"/g, 'class="chart-line-treatment" stroke="#8b5cf6" stroke-width="3" fill="none"')
            .replace(/class="chart-grid-line"/g, 'class="chart-grid-line" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="3,3"')
            .replace(/class="chart-label"/g, 'class="chart-label" fill="#8e9aa8" font-size="10px" font-family="sans-serif"');

        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(svgBlob);
        const image = new Image();
        
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 2;
            canvas.height = height * 2;
            
            const context = canvas.getContext('2d');
            context.scale(2, 2);
            
            // Slate dark background
            context.fillStyle = '#141620';
            context.fillRect(0, 0, width, height);
            
            context.drawImage(image, 0, 0, width, height);
            
            const png = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = png;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(blobURL);
        };
        image.src = blobURL;
    } catch (e) {
        console.error("Failed to export chart:", e);
        alert("Failed to export chart image.");
    }
};

// Dialog to Register/Edit Water Sample
async function openWaterSampleDialog(editSampleId = null) {
    const isEdit = editSampleId !== null;
    const sampleId = isEdit ? editSampleId : `sample-${Date.now()}`;
    const title = isEdit ? "Edit Water Sample & Lab Analysis" : "Register Water Sample & Lab Analysis";

    const projects = await window.api.query("SELECT id, name FROM projects");
    
    let sample = null;
    let dataObj = {};
    if (isEdit) {
        const rows = await window.api.query("SELECT * FROM water_samples WHERE id = ?", [editSampleId]);
        if (rows.length > 0) {
            sample = rows[0];
            try { dataObj = JSON.parse(sample.data); } catch(e) {}
        }
    }

    const formHtml = `
        <form id="water-form">
            <div class="form-row">
                <div class="form-group">
                    <label for="w-name">Sample Name / Identifier</label>
                    <input type="text" class="form-control" id="w-name" placeholder="e.g. Borehole Tap inlet 1" value="${sample ? escapeHtml(sample.sample_name) : ''}">
                </div>
                <div class="form-group">
                    <label for="w-project">Related Project</label>
                    <select class="form-control" id="w-project">
                        <option value="">-- No Project (Global) --</option>
                        ${projects.map(p => `<option value="${p.id}" ${(sample ? sample.project_id : activeProjectId) === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="w-date">Collection Date</label>
                    <input type="date" class="form-control" id="w-date" value="${sample ? sample.register_date : new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label for="w-source">Water Source</label>
                    <input type="text" class="form-control" id="w-source" placeholder="e.g. Well, River, Recycled Feed" value="${sample ? escapeHtml(sample.source) : ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="w-location">Sampling Location</label>
                    <input type="text" class="form-control" id="w-location" placeholder="e.g. Block C row 4" value="${sample ? escapeHtml(sample.location) : ''}">
                </div>
                <div class="form-group">
                    <label for="w-collected">Collected By</label>
                    <input type="text" class="form-control" id="w-collected" value="${sample ? escapeHtml(sample.collected_by) : appSettings.user_name}">
                </div>
            </div>

            <div style="font-weight:600; font-size:0.8rem; text-transform:uppercase; color:var(--primary); border-bottom:1px solid var(--border-color); padding-bottom:4px; margin-top:16px; margin-bottom:12px;">Laboratory Metrics</div>
            <div id="wqi-preview-badge" style="margin-bottom:12px; padding:10px; border-radius:8px; text-align:center; font-weight:700; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); font-size:0.85rem; transition: all var(--transition-fast);">
                WQI Rating: <span style="color:var(--text-muted);">— (Enter parameters)</span>
            </div>
            <div style="max-height: 250px; overflow-y: auto; padding-right:6px;">
                <div class="form-row">
                    <div class="form-group"><label for="w-ph">pH Level</label><input type="number" step="any" class="form-control" id="w-ph" value="${sample && dataObj.ph !== undefined ? dataObj.ph : ''}"></div>
                    <div class="form-group"><label for="w-ec">Electrical Cond (uS/cm)</label><input type="number" step="any" class="form-control" id="w-ec" value="${sample && dataObj.ec !== undefined ? dataObj.ec : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-tds">Total Dissolved Solids (mg/L)</label><input type="number" step="any" class="form-control" id="w-tds" value="${sample && dataObj.tds !== undefined ? dataObj.tds : ''}"></div>
                    <div class="form-group"><label for="w-tss">Total Suspended Solids (mg/L)</label><input type="number" step="any" class="form-control" id="w-tss" value="${sample && dataObj.tss !== undefined ? dataObj.tss : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-turbidity">Turbidity (NTU)</label><input type="number" step="any" class="form-control" id="w-turbidity" value="${sample && dataObj.turbidity !== undefined ? dataObj.turbidity : ''}"></div>
                    <div class="form-group"><label for="w-temperature">Temperature (°C)</label><input type="number" step="any" class="form-control" id="w-temperature" value="${sample && dataObj.temperature !== undefined ? dataObj.temperature : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-colour">Colour</label><input type="text" class="form-control" id="w-colour" placeholder="e.g. Clear, Turbid" value="${sample ? escapeHtml(dataObj.colour || '') : ''}"></div>
                    <div class="form-group"><label for="w-odour">Odour</label><input type="text" class="form-control" id="w-odour" placeholder="e.g. None, Earthy" value="${sample ? escapeHtml(dataObj.odour || '') : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-do">Dissolved Oxygen (mg/L)</label><input type="number" step="any" class="form-control" id="w-do" value="${sample && dataObj.do !== undefined ? dataObj.do : ''}"></div>
                    <div class="form-group"><label for="w-bod">BOD (mg/L)</label><input type="number" step="any" class="form-control" id="w-bod" value="${sample && dataObj.bod !== undefined ? dataObj.bod : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-cod">COD (mg/L)</label><input type="number" step="any" class="form-control" id="w-cod" value="${sample && dataObj.cod !== undefined ? dataObj.cod : ''}"></div>
                    <div class="form-group"><label for="w-alkalinity">Alkalinity (mg/L)</label><input type="number" step="any" class="form-control" id="w-alkalinity" value="${sample && dataObj.alkalinity !== undefined ? dataObj.alkalinity : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-hardness">Hardness (mg/L)</label><input type="number" step="any" class="form-control" id="w-hardness" value="${sample && dataObj.hardness !== undefined ? dataObj.hardness : ''}"></div>
                    <div class="form-group"><label for="w-chloride">Chloride (mg/L)</label><input type="number" step="any" class="form-control" id="w-chloride" value="${sample && dataObj.chloride !== undefined ? dataObj.chloride : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-sulphate">Sulphate (mg/L)</label><input type="number" step="any" class="form-control" id="w-sulphate" value="${sample && dataObj.sulphate !== undefined ? dataObj.sulphate : ''}"></div>
                    <div class="form-group"><label for="w-fluoride">Fluoride (mg/L)</label><input type="number" step="any" class="form-control" id="w-fluoride" value="${sample && dataObj.fluoride !== undefined ? dataObj.fluoride : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-nitrate">Nitrate (mg/L)</label><input type="number" step="any" class="form-control" id="w-nitrate" value="${sample && dataObj.nitrate !== undefined ? dataObj.nitrate : ''}"></div>
                    <div class="form-group"><label for="w-nitrite">Nitrite (mg/L)</label><input type="number" step="any" class="form-control" id="w-nitrite" value="${sample && dataObj.nitrite !== undefined ? dataObj.nitrite : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-ammonia">Ammonia (mg/L)</label><input type="number" step="any" class="form-control" id="w-ammonia" value="${sample && dataObj.ammonia !== undefined ? dataObj.ammonia : ''}"></div>
                    <div class="form-group"><label for="w-total_nitrogen">Total Nitrogen (mg/L)</label><input type="number" step="any" class="form-control" id="w-total_nitrogen" value="${sample && dataObj.total_nitrogen !== undefined ? dataObj.total_nitrogen : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-orthophosphate">Orthophosphate (mg/L)</label><input type="number" step="any" class="form-control" id="w-orthophosphate" value="${sample && dataObj.orthophosphate !== undefined ? dataObj.orthophosphate : ''}"></div>
                    <div class="form-group"><label for="w-total_phosphorus">Total Phosphorus (mg/L)</label><input type="number" step="any" class="form-control" id="w-total_phosphorus" value="${sample && dataObj.total_phosphorus !== undefined ? dataObj.total_phosphorus : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-oil_grease">Oil & Grease (mg/L)</label><input type="number" step="any" class="form-control" id="w-oil_grease" value="${sample && dataObj.oil_grease !== undefined ? dataObj.oil_grease : ''}"></div>
                    <div class="form-group"><label for="w-phenol">Phenol (mg/L)</label><input type="number" step="any" class="form-control" id="w-phenol" value="${sample && dataObj.phenol !== undefined ? dataObj.phenol : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-cyanide">Cyanide (mg/L)</label><input type="number" step="any" class="form-control" id="w-cyanide" value="${sample && dataObj.cyanide !== undefined ? dataObj.cyanide : ''}"></div>
                    <div class="form-group"><label for="w-total_coliform">Total Coliform (MPN/100ml)</label><input type="number" step="any" class="form-control" id="w-total_coliform" value="${sample && dataObj.total_coliform !== undefined ? dataObj.total_coliform : ''}"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label for="w-fecal_coliform">Fecal Coliform (MPN/100ml)</label><input type="number" step="any" class="form-control" id="w-fecal_coliform" value="${sample && dataObj.fecal_coliform !== undefined ? dataObj.fecal_coliform : ''}"></div>
                    <div class="form-group"><label for="w-e_coli">E. Coli (MPN/100ml)</label><input type="number" step="any" class="form-control" id="w-e_coli" value="${sample && dataObj.e_coli !== undefined ? dataObj.e_coli : ''}"></div>
                </div>
            </div>
        </form>
    `;

    const footerHtml = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-water">${isEdit ? 'Save Changes' : 'Register Sample'}</button>
    `;

    showGlobalModal(title, formHtml, footerHtml);

    // Live WQI calculation listener
    const updateLiveWqiPreview = () => {
        const dObj = {};
        const inputs = document.getElementById('water-form').querySelectorAll('input');
        inputs.forEach(input => {
            if (input.id.startsWith('w-') && 
                input.id !== 'w-name' && 
                input.id !== 'w-date' && 
                input.id !== 'w-source' && 
                input.id !== 'w-location' && 
                input.id !== 'w-collected') {
                const cleanKey = input.id.replace('w-', '');
                dObj[cleanKey] = input.value;
            }
        });
        const wqi = calculateWqi(dObj);
        const preview = document.getElementById('wqi-preview-badge');
        if (preview) {
            if (wqi.rating === 'Undefined') {
                preview.innerHTML = `WQI Rating: <span style="color:var(--text-muted);">— (Enter parameters)</span>`;
                preview.style.borderColor = 'var(--border-color)';
                preview.style.background = 'rgba(255,255,255,0.02)';
            } else {
                let color = 'var(--color-emerald)';
                if (wqi.score >= 50) color = 'var(--color-teal)';
                if (wqi.score >= 100) color = 'var(--color-yellow)';
                if (wqi.score >= 200) color = 'hsl(20, 90%, 55%)';
                if (wqi.score >= 300) color = 'var(--color-red)';
                preview.innerHTML = `Live WQI Score: <strong style="color:${color}; font-size:1rem;">${wqi.score.toFixed(1)}</strong> | Status: <span class="wqi-class-badge" style="background:${color}20; color:${color}; border:1px solid ${color}40; padding:2px 8px; font-size:0.75rem; border-radius:10px;">${wqi.rating}</span>`;
                preview.style.borderColor = color;
                preview.style.background = `${color}05`;
            }
        }
    };

    document.getElementById('water-form')?.addEventListener('input', updateLiveWqiPreview);
    
    // Trigger preview calculations initially if editing
    if (isEdit) {
        updateLiveWqiPreview();
    }

    document.getElementById('btn-save-water')?.addEventListener('click', async () => {
        const name = document.getElementById('w-name').value;
        const project = document.getElementById('w-project').value || null;
        const date = document.getElementById('w-date').value;
        const source = document.getElementById('w-source').value;
        const location = document.getElementById('w-location').value;
        const collected = document.getElementById('w-collected').value;

        // Scrape lab inputs
        const dObj = {};
        const inputs = document.getElementById('water-form').querySelectorAll('input');
        inputs.forEach(input => {
            if (input.id.startsWith('w-') && 
                input.id !== 'w-name' && 
                input.id !== 'w-date' && 
                input.id !== 'w-source' && 
                input.id !== 'w-location' && 
                input.id !== 'w-collected') {
                const cleanKey = input.id.replace('w-', '');
                dObj[cleanKey] = input.value;
            }
        });

        // Run calculations
        const wqiResult = calculateWqi(dObj);

        try {
            if (isEdit) {
                await window.api.run(`
                    UPDATE water_samples 
                    SET project_id=?, sample_name=?, register_date=?, source=?, location=?, collected_by=?, data=?, wqi_score=?, wqi_class=?
                    WHERE id=?
                `, [project, name, date, source, location, collected, JSON.stringify(dObj), wqiResult.score, wqiResult.rating, sampleId]);
            } else {
                await window.api.run(`
                    INSERT INTO water_samples (id, project_id, sample_name, register_date, source, location, collected_by, data, wqi_score, wqi_class, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [sampleId, project, name, date, source, location, collected, JSON.stringify(dObj), wqiResult.score, wqiResult.rating, new Date().toISOString()]);
            }

            closeModal();
            
            // Reload water register
            if (currentView === 'water_analysis') {
                await refreshWaterSamplesList();
                if (isEdit) {
                    await loadWaterSampleDashboard(sampleId);
                }
            } else {
                switchView('water_analysis');
            }
            logFacilityActivity(`Water sample ${isEdit ? 'updated' : 'registered'}: ${name}`);
        } catch (err) {
            alert("Failed to save sample: " + err.message);
        }
    });
}

/* ==========================================
   MODULE 8: ANALYTICS VIEW
   ========================================== */

async function renderAnalytics(container) {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <div>
                <h2 style="font-size:1.4rem; font-weight:700;">Agritech Cross-Module Analytics</h2>
                <p style="color:var(--text-dim); font-size:0.85rem;">Correlate data points across Soil quality, Hydroponics parameters, and Microgreen yields.</p>
            </div>

            <div class="analytics-dashboard">
                <!-- Left: Big correlation plot -->
                <div class="card glass" style="padding:20px; min-height: 380px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <h4 style="font-weight:700; font-size:0.95rem;">Cross-Parameter Correlation (Scatter Plot)</h4>
                        <div style="display:flex; gap:10px;">
                            <select class="form-control" id="scatter-x-select" style="width:130px; height:30px; font-size:0.75rem;"></select>
                            <select class="form-control" id="scatter-y-select" style="width:130px; height:30px; font-size:0.75rem;"></select>
                        </div>
                    </div>
                    <div id="analytics-scatter-container" style="flex:1;"></div>
                </div>

                <!-- Right: Module distribution and summaries -->
                <div style="display:flex; flex-direction:column; gap:20px;">
                    <div class="card glass" style="padding:16px; gap:12px;">
                        <h4 style="font-weight:700; font-size:0.90rem;">Activity Distribution</h4>
                        <div id="analytics-pie-container" style="height:180px;"></div>
                    </div>
                    <div class="card glass" style="padding:16px;">
                        <h4 style="font-weight:700; font-size:0.90rem; margin-bottom:10px;">Analytical Summaries</h4>
                        <div style="font-size:0.8rem; display:flex; flex-direction:column; gap:8px;" id="analytics-summary-stats">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    await loadAnalyticsData();
}

async function loadAnalyticsData() {
    const xSelector = document.getElementById('scatter-x-select');
    const ySelector = document.getElementById('scatter-y-select');
    const scatterContainer = document.getElementById('analytics-scatter-container');
    const pieContainer = document.getElementById('analytics-pie-container');
    const summaryContainer = document.getElementById('analytics-summary-stats');

    if (!xSelector || !ySelector || !scatterContainer) return;

    // We populate cross-variable choices
    const variables = [
        { id: 'ph', name: 'pH level' },
        { id: 'ec', name: 'EC value' },
        { id: 'tds', name: 'TDS value' },
        { id: 'temp', name: 'Temperature' },
        { id: 'plant_height', name: 'Plant Height' }
    ];

    xSelector.innerHTML = variables.map(v => `<option value="${v.id}" ${v.id==='ec'?'selected':''}>X: ${v.name}</option>`).join('');
    ySelector.innerHTML = variables.map(v => `<option value="${v.id}" ${v.id==='plant_height'?'selected':''}>Y: ${v.name}</option>`).join('');

    const renderScatter = async () => {
        const xVar = xSelector.value;
        const yVar = ySelector.value;

        try {
            const logs = await window.api.query("SELECT * FROM observations");
            const points = [];

            logs.forEach(log => {
                try {
                    const data = JSON.parse(log.data);
                    // Match variables in observations
                    const xVal = parseFloat(data[xVar] || data.ec || data.N || 0);
                    const yVal = parseFloat(data[yVar] || data.plant_height || data.yield || 0);
                    if (!isNaN(xVal) && !isNaN(yVal)) {
                        points.push({ x: xVal, y: yVal, type: log.group_type });
                    }
                } catch(e) {}
            });

            drawSvgScatterPlot(scatterContainer, points, xVar.toUpperCase(), yVar.toUpperCase());

        } catch (e) {
            console.error(e);
        }
    };

    xSelector.onchange = renderScatter;
    ySelector.onchange = renderScatter;
    await renderScatter();

    // Render Pie Chart for experiment type distributions
    try {
        const counts = await window.api.query("SELECT type, COUNT(*) as count FROM experiments GROUP BY type");
        drawSvgPieChart(pieContainer, counts);

        // Summaries
        const totalObs = await window.api.query("SELECT COUNT(*) as c FROM observations");
        const totalWater = await window.api.query("SELECT COUNT(*) as c FROM water_samples");
        const projects = await window.api.query("SELECT COUNT(*) as c FROM projects");

        summaryContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <span>Total Projects:</span><strong>${projects[0].c}</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
                <span>Total Observation logs:</span><strong>${totalObs[0].c}</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
                <span>Water Sample Tests:</span><strong>${totalWater[0].c}</strong>
            </div>
        `;
    } catch(err) {
        console.error(err);
    }
}

function drawSvgScatterPlot(container, points, labelX, labelY) {
    if (points.length === 0) {
        container.innerHTML = `<div style="padding:40px; color:var(--text-muted); font-size:0.85rem; text-align:center;">No matching data parameters found.</div>`;
        return;
    }

    const width = 450;
    const height = 240;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;

    const xVals = points.map(p => p.x);
    const yVals = points.map(p => p.y);

    let minX = Math.min(...xVals), maxX = Math.max(...xVals);
    let minY = Math.min(...yVals), maxY = Math.max(...yVals);

    if (minX === maxX) { minX -= 1; maxX += 1; }
    if (minY === maxY) { minY -= 1; maxY += 1; }

    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    const getX = (val) => paddingLeft + ((val - minX) / (maxX - minX)) * graphWidth;
    const getY = (val) => paddingTop + graphHeight - ((val - minY) / (maxY - minY)) * graphHeight;

    let pointsHtml = '';
    points.forEach(p => {
        const cx = getX(p.x);
        const cy = getY(p.y);
        const color = p.type === 'control' ? 'var(--color-emerald)' : 'var(--color-purple)';
        pointsHtml += `<circle cx="${cx}" cy="${cy}" r="5" fill="${color}" opacity="0.8" stroke="var(--bg-surface)" stroke-width="1" />`;
    });

    container.innerHTML = `
        <div style="position:relative; width:100%; height:100%;">
            <button class="btn btn-sm btn-secondary" onclick="window.downloadChartAsImage(this.closest('div').querySelector('svg'), 'Correlation_${escapeHtml(labelX)}_vs_${escapeHtml(labelY)}.png')" style="position:absolute; top:-38px; left:0; z-index:10; display:inline-flex; align-items:center; gap:6px; height:26px; font-size:0.72rem; padding:2px 8px;">
                <span style="display:inline-block; transform:rotate(90deg); margin-right:2px;">➔</span> Download Graph
            </button>
            <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:100%;">
                <!-- Axis lines -->
                <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" stroke="var(--border-color)" />
                <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="var(--border-color)" />
                
                <!-- Axes Labels -->
                <text x="${width/2 + 20}" y="${height - 8}" text-anchor="middle" class="chart-label" style="font-weight:700;">${escapeHtml(labelX)}</text>
                <text x="10" y="${height/2 - 10}" text-anchor="middle" class="chart-label" transform="rotate(-90 10 ${height/2 - 10})" style="font-weight:700;">${escapeHtml(labelY)}</text>

                <!-- Grid values -->
                <text x="${paddingLeft}" y="${height - paddingBottom + 16}" text-anchor="middle" class="chart-label">${minX.toFixed(1)}</text>
                <text x="${width - paddingRight}" y="${height - paddingBottom + 16}" text-anchor="middle" class="chart-label">${maxX.toFixed(1)}</text>
                <text x="${paddingLeft - 8}" y="${height - paddingBottom}" text-anchor="end" class="chart-label">${minY.toFixed(1)}</text>
                <text x="${paddingLeft - 8}" y="${paddingTop + 8}" text-anchor="end" class="chart-label">${maxY.toFixed(1)}</text>

                ${pointsHtml}
            </svg>
        </div>
    `;
}

function drawSvgPieChart(container, categories) {
    if (categories.length === 0) {
        container.innerHTML = `<div style="padding:20px; color:var(--text-muted); font-size:0.8rem; text-align:center;">No projects classified.</div>`;
        return;
    }

    const total = categories.reduce((sum, item) => sum + item.count, 0);
    const colors = ['var(--color-emerald)', 'var(--color-purple)', 'var(--color-yellow)', 'var(--color-cyan)'];
    
    let accumulatedAngle = 0;
    let paths = '';
    let legendSvg = '';

    categories.forEach((cat, idx) => {
        const percentage = (cat.count / total) * 100;
        const angle = (cat.count / total) * 360;
        const color = colors[idx % colors.length];

        // Draw SVG pie slice path
        const radStart = (accumulatedAngle - 90) * Math.PI / 180;
        const radEnd = (accumulatedAngle + angle - 90) * Math.PI / 180;

        const x1 = 50 + 40 * Math.cos(radStart);
        const y1 = 50 + 40 * Math.sin(radStart);
        const x2 = 50 + 40 * Math.cos(radEnd);
        const y2 = 50 + 40 * Math.sin(radEnd);

        const largeArc = angle > 180 ? 1 : 0;

        paths += `<path d="M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" stroke="var(--bg-surface)" stroke-width="1.5" />`;
        
        const yPos = 20 + idx * 18;
        legendSvg += `
            <circle cx="120" cy="${yPos}" r="4" fill="${color}" />
            <text x="132" y="${yPos + 3}" fill="var(--text-muted)" font-size="8px" font-family="sans-serif" style="text-transform:capitalize;">
                ${escapeHtml(cat.type)}: ${cat.count} (${percentage.toFixed(0)}%)
            </text>
        `;

        accumulatedAngle += angle;
    });

    container.innerHTML = `
        <div style="position:relative; display:flex; align-items:center; height:100%; width:100%;">
            <button class="btn btn-sm btn-secondary" onclick="window.downloadChartAsImage(this.closest('div').querySelector('svg'), 'Activity_Distribution.png')" style="position:absolute; top:-32px; right:0; z-index:10; display:inline-flex; align-items:center; gap:6px; height:26px; font-size:0.72rem; padding:2px 8px;">
                <span style="display:inline-block; transform:rotate(90deg); margin-right:2px;">➔</span> Download Graph
            </button>
            <svg viewBox="0 0 240 100" style="width:100%; height:120px; overflow:visible;">
                ${paths}
                <circle cx="50" cy="50" r="20" fill="var(--bg-surface)" /> <!-- Donut hole -->
                ${legendSvg}
            </svg>
        </div>
    `;
}

/* ==========================================
   MODULE 9: REPORTS VIEW
   ========================================== */

async function renderReports(container) {
    // Load projects list
    const projects = await window.api.query("SELECT id, name FROM projects");

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <div>
                <h2 style="font-size:1.4rem; font-weight:700;">Report Generation Desk</h2>
                <p style="color:var(--text-dim); font-size:0.85rem;">Compile observations, chemical scores, and export files to CSV/Excel formats.</p>
            </div>

            <div class="card glass" style="padding:24px; gap:20px;">
                <div class="form-row">
                    <div class="form-group">
                        <label for="rpt-project">Select Project</label>
                        <select class="form-control" id="rpt-project">
                            <option value="">-- All Projects --</option>
                            ${projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="rpt-type">Data Module</label>
                        <select class="form-control" id="rpt-type">
                            <option value="experiments">All Experimental Logs (Hydro/Soil/Irri/Micro)</option>
                            <option value="water">Water Quality Chemical Logs</option>
                            <option value="tasks">Project Tasks Summary</option>
                        </select>
                    </div>
                </div>

                <div style="display:flex; gap:12px; margin-top:8px;">
                    <button class="btn btn-primary" id="btn-gen-csv">Export CSV</button>
                    <button class="btn btn-secondary" id="btn-gen-print">Open Print / PDF Preview</button>
                </div>
            </div>

            <!-- Print Preview Container (Hidden by default, shown inside preview modal) -->
            <div id="print-report-layout" style="display:none; padding: 40px; color:#1a1a24; background:white; font-family:sans-serif;">
                <!-- Generated dynamically -->
            </div>
        </div>
    `;

    document.getElementById('btn-gen-csv')?.addEventListener('click', generateCsvReport);
    document.getElementById('btn-gen-print')?.addEventListener('click', generatePrintPreviewReport);
}

async function generateCsvReport() {
    const projId = document.getElementById('rpt-project').value;
    const rptType = document.getElementById('rpt-type').value;

    let sql = "";
    let params = [];

    try {
        let csvContent = "";
        
        if (rptType === 'experiments') {
            sql = `
                SELECT e.name as experiment_name, e.type as module_type, o.group_type, o.observation_date, o.data 
                FROM observations o 
                JOIN experiments e ON o.experiment_id = e.id
                ${projId ? "WHERE e.project_id = ?" : ""}
                ORDER BY o.observation_date DESC
            `;
            if (projId) params.push(projId);
            const rows = await window.api.query(sql, params);
            
            if (rows.length === 0) {
                alert("No experimental logs found for this criteria.");
                return;
            }

            // Generate dynamic CSV headers based on first rows data keys
            const sampleData = JSON.parse(rows[0].data);
            const dataKeys = Object.keys(sampleData);

            csvContent = "Experiment Name,Module Type,Group Type,Observation Date," + dataKeys.map(k => k.toUpperCase()).join(",") + "\n";
            rows.forEach(r => {
                const dataObj = JSON.parse(r.data);
                const values = dataKeys.map(k => `"${dataObj[k] || ''}"`);
                csvContent += `"${r.experiment_name}","${r.module_type}","${r.group_type}","${r.observation_date}",` + values.join(",") + "\n";
            });

        } else if (rptType === 'water') {
            sql = `
                SELECT ws.sample_name, ws.register_date, ws.source, ws.location, ws.wqi_score, ws.wqi_class, ws.data
                FROM water_samples ws
                ${projId ? "WHERE ws.project_id = ?" : ""}
                ORDER BY ws.register_date DESC
            `;
            if (projId) params.push(projId);
            const rows = await window.api.query(sql, params);

            if (rows.length === 0) {
                alert("No water samples found.");
                return;
            }

            const sampleData = JSON.parse(rows[0].data);
            const dataKeys = Object.keys(sampleData);

            csvContent = "Sample Name,Register Date,Source,Location,WQI Score,WQI Rating," + dataKeys.map(k => k.toUpperCase()).join(",") + "\n";
            rows.forEach(r => {
                const dataObj = JSON.parse(r.data);
                const values = dataKeys.map(k => `"${dataObj[k] || ''}"`);
                csvContent += `"${r.sample_name}","${r.register_date}","${r.source}","${r.location}",${r.wqi_score},"${r.wqi_class}",` + values.join(",") + "\n";
            });

        } else if (rptType === 'tasks') {
            sql = `
                SELECT t.title, t.description, t.due_date, t.priority, t.status, p.name as project_name 
                FROM tasks t 
                LEFT JOIN projects p ON t.related_project_id = p.id
                ${projId ? "WHERE t.related_project_id = ?" : ""}
                ORDER BY t.due_date ASC
            `;
            if (projId) params.push(projId);
            const rows = await window.api.query(sql, params);

            if (rows.length === 0) {
                alert("No tasks found.");
                return;
            }

            csvContent = "Task Title,Description,Due Date,Priority,Status,Project Name\n";
            rows.forEach(r => {
                csvContent += `"${r.title}","${r.description || ''}","${r.due_date || 'N/A'}","${r.priority}","${r.status}","${r.project_name || 'Global'}"\n`;
            });
        }

        // Trigger CSV download/save on client
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `agritech_report_${rptType}_${Date.now()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e) {
        alert("Failed to export CSV: " + e.message);
    }
}

// Generate Print Page Preview layout
async function generatePrintPreviewReport() {
    const projId = document.getElementById('rpt-project').value;
    const rptType = document.getElementById('rpt-type').value;

    let projName = "All Facility Projects";
    if (projId) {
        const rows = await window.api.query("SELECT name FROM projects WHERE id = ?", [projId]);
        if (rows.length > 0) projName = rows[0].name;
    }

    let reportTitle = "";
    let dataHtml = "";

    try {
        if (rptType === 'experiments') {
            reportTitle = "Experimental Observations Report";
            const rows = await window.api.query(`
                SELECT e.name as exp_name, e.type, o.group_type, o.observation_date, o.data 
                FROM observations o 
                JOIN experiments e ON o.experiment_id = e.id
                ${projId ? "WHERE e.project_id = ?" : ""}
                ORDER BY o.observation_date DESC, e.name ASC
            `, projId ? [projId] : []);

            dataHtml = `
                <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:12px;">
                    <thead>
                        <tr style="background:#eaeaea; border-bottom:2px solid #333;">
                            <th style="padding:8px; text-align:left;">Experiment</th>
                            <th style="padding:8px; text-align:left;">Group</th>
                            <th style="padding:8px; text-align:left;">Date</th>
                            <th style="padding:8px; text-align:left;">Parameters logged</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => {
                            const dataObj = JSON.parse(r.data);
                            const paramsText = Object.entries(dataObj)
                                .filter(([k,v]) => v !== '')
                                .map(([k,v]) => `${k}: ${v}`).join(', ');
                            return `
                                <tr style="border-bottom:1px solid #ddd;">
                                    <td style="padding:8px;"><strong>${escapeHtml(r.exp_name)}</strong> (${r.type})</td>
                                    <td style="padding:8px; text-transform:uppercase;">${r.group_type}</td>
                                    <td style="padding:8px;">${r.observation_date}</td>
                                    <td style="padding:8px; color:#555;">${escapeHtml(paramsText)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;

        } else if (rptType === 'water') {
            reportTitle = "Water Quality Chemical Assay Summary";
            const rows = await window.api.query(`
                SELECT * FROM water_samples
                ${projId ? "WHERE project_id = ?" : ""}
                ORDER BY register_date DESC
            `, projId ? [projId] : []);

            dataHtml = `
                <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:12px;">
                    <thead>
                        <tr style="background:#eaeaea; border-bottom:2px solid #333;">
                            <th style="padding:8px; text-align:left;">Sample Name</th>
                            <th style="padding:8px; text-align:left;">Source</th>
                            <th style="padding:8px; text-align:left;">Date</th>
                            <th style="padding:8px; text-align:left;">WQI Score</th>
                            <th style="padding:8px; text-align:left;">Class</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => `
                            <tr style="border-bottom:1px solid #ddd;">
                                <td style="padding:8px;"><strong>${escapeHtml(r.sample_name)}</strong></td>
                                <td style="padding:8px;">${escapeHtml(r.source)} (${escapeHtml(r.location)})</td>
                                <td style="padding:8px;">${r.register_date}</td>
                                <td style="padding:8px; font-weight:700;">${r.wqi_score.toFixed(1)}</td>
                                <td style="padding:8px;">${r.wqi_class}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (rptType === 'tasks') {
            reportTitle = "Project Operations Tasks Summary";
            const rows = await window.api.query(`
                SELECT t.*, p.name as proj_name FROM tasks t LEFT JOIN projects p ON t.related_project_id = p.id
                ${projId ? "WHERE t.related_project_id = ?" : ""}
                ORDER BY t.due_date ASC
            `, projId ? [projId] : []);

            dataHtml = `
                <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:12px;">
                    <thead>
                        <tr style="background:#eaeaea; border-bottom:2px solid #333;">
                            <th style="padding:8px; text-align:left;">Task Title</th>
                            <th style="padding:8px; text-align:left;">Due Date</th>
                            <th style="padding:8px; text-align:left;">Priority</th>
                            <th style="padding:8px; text-align:left;">Status</th>
                            <th style="padding:8px; text-align:left;">Project</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => `
                            <tr style="border-bottom:1px solid #ddd;">
                                <td style="padding:8px;"><strong>${escapeHtml(r.title)}</strong><br><span style="font-size:10px; color:#666;">${escapeHtml(r.description || '')}</span></td>
                                <td style="padding:8px;">${r.due_date || 'N/A'}</td>
                                <td style="padding:8px; text-transform:uppercase;">${r.priority}</td>
                                <td style="padding:8px; text-transform:uppercase;">${r.status}</td>
                                <td style="padding:8px;">${escapeHtml(r.proj_name || 'Global')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        const reportTemplate = `
            <div style="border-bottom:3px solid #333; padding-bottom:12px; display:flex; justify-content:space-between; align-items:flex-end;">
                <div>
                    <h1 style="font-size:24px; font-weight:bold; margin:0;">AGRITECH RESEARCH DESKTOP SUITE</h1>
                    <p style="font-size:10px; color:#555; margin:2px 0 0 0;">OFFLINE LABORATORY INFORMATION MANAGEMENT SYSTEM</p>
                </div>
                <div style="text-align:right; font-size:11px;">
                    Date Generated: ${new Date().toLocaleDateString()}<br>
                    Operator: ${escapeHtml(appSettings.user_name)}
                </div>
            </div>

            <div style="margin-top:20px;">
                <h2 style="font-size:18px; margin:0;">${reportTitle}</h2>
                <h3 style="font-size:13px; font-weight:normal; margin:4px 0 0 0; color:#555;">Project Focus: <strong>${escapeHtml(projName)}</strong></h3>
            </div>

            ${dataHtml}

            <div style="margin-top:40px; border-top:1px solid #ccc; padding-top:10px; font-size:10px; text-align:center; color:#777;">
                This document is a computer-generated summary exported from Agritech v1.0 local SQLite database.
            </div>
        `;

        // Render to hidden print frame
        const printWindow = window.open("", "_blank");
        printWindow.document.write(`
            <html>
                <head>
                    <title>Agritech LIMS Report</title>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; line-height: 1.4; color: #333; }
                        @media print {
                            body { padding: 0; }
                            button { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    <div style="margin-bottom:20px; text-align:right;">
                        <button onclick="window.print()" style="padding:10px 20px; font-weight:bold; background:#10b981; color:white; border:none; border-radius:4px; cursor:pointer;">Print to PDF</button>
                    </div>
                    ${reportTemplate}
                </body>
            </html>
        `);
        printWindow.document.close();

    } catch (e) {
        alert("Failed to render print preview: " + e.message);
    }
}

/* ==========================================
   MODULE 10: GALLERY
   ========================================== */

async function renderGallery(container) {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="font-size:1.4rem; font-weight:700;">Global Laboratory File Gallery</h2>
                    <p style="color:var(--text-dim); font-size:0.85rem;">View and manage photographs, laboratory readings, charts, and attached study reports.</p>
                </div>
            </div>

            <div class="glass" style="border-radius:12px; padding:20px;">
                <div class="gallery-grid" id="global-gallery-grid"></div>
            </div>
        </div>
    `;

    await loadGlobalGallery();
}

async function loadGlobalGallery() {
    const grid = document.getElementById('global-gallery-grid');
    if (!grid) return;
    grid.innerHTML = '';

    try {
        const files = await window.api.query("SELECT * FROM gallery ORDER BY created_at DESC");
        
        if (files.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">No images or files attached in the facility.</div>`;
            return;
        }

        files.forEach(f => {
            const card = document.createElement('div');
            card.className = 'gallery-item';
            
            let bgStyle = '';
            if (f.file_type === 'image') {
                bgStyle = `background-image: url('file:///${f.file_path.replace(/\\/g, '/')}');`;
            }

            card.innerHTML = `
                <div class="gallery-thumbnail" style="${bgStyle}">
                    ${f.file_type !== 'image' ? AG_ICONS.reports : ''}
                </div>
                <div class="gallery-info">
                    <span class="gallery-title" title="${escapeHtml(f.file_name)}">${escapeHtml(f.file_name)}</span>
                    <span class="gallery-meta">${f.file_type} | ${(f.file_size / 1024).toFixed(1)} KB</span>
                </div>
            `;

            card.addEventListener('click', () => {
                showGlobalModal(f.file_name, `
                    <div style="text-align:center;">
                        ${f.file_type === 'image' ? `<img src="file:///${f.file_path.replace(/\\/g, '/')}" style="max-width:100%; max-height:400px; border-radius:8px;">` : `<div style="padding:40px 0; color:var(--text-muted);">${AG_ICONS.reports} Document</div>`}
                        <p style="margin-top:16px; font-size:0.9rem; color:var(--text-dim);">${escapeHtml(f.description || 'No description')}</p>
                    </div>
                `, `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`);
            });

            grid.appendChild(card);
        });

    } catch (e) {
        console.error(e);
    }
}

/* ==========================================
   MODULE 11: TEMPLATES
   ========================================== */

async function renderTemplates(container) {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="font-size:1.4rem; font-weight:700;">Experiment Configuration Templates</h2>
                    <p style="color:var(--text-dim); font-size:0.85rem;">Pre-populate thresholds and settings to launch new experiments quickly.</p>
                </div>
                <button class="btn btn-primary" id="btn-create-template">+ Add Template</button>
            </div>

            <div class="glass" style="border-radius:12px; padding:20px;">
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Template Name</th>
                                <th>Module Type</th>
                                <th>Pre-Set Values</th>
                                <th style="text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="templates-list-tbody">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-create-template')?.addEventListener('click', () => openTemplateDialog());
    await refreshTemplatesList();
}

async function refreshTemplatesList() {
    const tbody = document.getElementById('templates-list-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    try {
        const rows = await window.api.query("SELECT * FROM templates ORDER BY name ASC");
        
        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No configuration templates defined.</td></tr>`;
            return;
        }

        rows.forEach(t => {
            const dataObj = JSON.parse(t.data);
            const presets = Object.entries(dataObj).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join(', ');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600; color:var(--primary);">${escapeHtml(t.name)}</td>
                <td style="text-transform:capitalize;">${t.type}</td>
                <td style="max-width:350px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-muted); font-size:0.8rem;">${escapeHtml(presets)}</td>
                <td style="text-align:right;">
                    <div style="display:flex; justify-content:flex-end; gap:6px;">
                        <button class="btn-icon-sm btn-del-tpl" title="Delete Template">${AG_ICONS.trash}</button>
                    </div>
                </td>
            `;

            tr.querySelector('.btn-del-tpl').addEventListener('click', async () => {
                if (confirm("Delete this template?")) {
                    await window.api.run("DELETE FROM templates WHERE id = ?", [t.id]);
                    await refreshTemplatesList();
                }
            });

            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
    }
}

function openTemplateDialog() {
    const tplId = `tpl-${Date.now()}`;
    
    const formHtml = `
        <form id="tpl-form">
            <div class="form-group">
                <label for="t-name">Template Name</label>
                <input type="text" class="form-control" id="t-name" placeholder="e.g. Standard Strawberry Run">
            </div>
            <div class="form-group">
                <label for="t-type">Module Type</label>
                <select class="form-control" id="t-type">
                    <option value="hydroponics">Hydroponics</option>
                    <option value="soil">Soil Quality</option>
                    <option value="irrigation">Irrigation</option>
                    <option value="microgreens">Microgreens</option>
                </select>
            </div>
            
            <div style="font-weight:600; font-size:0.8rem; text-transform:uppercase; color:var(--primary); border-bottom:1px solid var(--border-color); padding-bottom:4px; margin-top:16px; margin-bottom:12px;">Preset Parameters</div>
            <div class="form-row">
                <div class="form-group"><label for="tp-ph">pH target</label><input type="number" step="0.1" class="form-control" id="tp-ph"></div>
                <div class="form-group"><label for="tp-ec">EC target</label><input type="number" step="0.1" class="form-control" id="tp-ec"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label for="tp-tds">TDS target</label><input type="number" class="form-control" id="tp-tds"></div>
                <div class="form-group"><label for="tp-temp">Temp target (°C)</label><input type="number" step="0.5" class="form-control" id="tp-temp"></div>
            </div>
        </form>
    `;

    showGlobalModal("Create New Template", formHtml, `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-tpl">Save Template</button>
    `);

    document.getElementById('btn-save-tpl')?.addEventListener('click', async () => {
        const name = document.getElementById('t-name').value;
        const type = document.getElementById('t-type').value;

        // Scrape presets
        const dataObj = {};
        const inputs = document.getElementById('tpl-form').querySelectorAll('input');
        inputs.forEach(input => {
            if (input.id.startsWith('tp-')) {
                const k = input.id.replace('tp-', '');
                if (input.value !== '') dataObj[k] = input.value;
            }
        });

        try {
            await window.api.run("INSERT INTO templates (id, type, name, data, created_at) VALUES (?, ?, ?, ?, ?)", [
                tplId, type, name, JSON.stringify(dataObj), new Date().toISOString()
            ]);
            closeModal();
            await refreshTemplatesList();
        } catch (e) {
            alert("Failed to save template: " + e.message);
        }
    });
}

/* ==========================================
   MODULE 12: SETTINGS
   ========================================== */

async function renderSettings(container) {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <div>
                <h2 style="font-size:1.4rem; font-weight:700;">System Settings</h2>
                <p style="color:var(--text-dim); font-size:0.85rem;">Configure research identity, database backups, measurement units, and theme preferences.</p>
            </div>

            <!-- Profile Settings -->
            <div class="settings-section">
                <h3>Researcher Profile</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label for="set-user-name">Full Name</label>
                        <input type="text" class="form-control" id="set-user-name" value="${appSettings.user_name}">
                    </div>
                    <div class="form-group">
                        <label for="set-user-role">Title / Role</label>
                        <input type="text" class="form-control" id="set-user-role" value="${appSettings.user_role}">
                    </div>
                </div>
                <button class="btn btn-sm btn-primary" id="btn-save-profile">Save Profile</button>
            </div>

            <!-- Global Preferences -->
            <div class="settings-section">
                <h3>System Preferences</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label for="set-theme">App Color Theme</label>
                        <select class="form-control" id="set-theme">
                            <option value="dark" ${appSettings.theme === 'dark' ? 'selected' : ''}>Midnight Dark Mode</option>
                            <option value="light" ${appSettings.theme === 'light' ? 'selected' : ''}>Arctic Light Mode</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="set-units">Measurement Units</label>
                        <select class="form-control" id="set-units">
                            <option value="metric" ${appSettings.units === 'metric' ? 'selected' : ''}>Metric (cm, g, kg, °C)</option>
                            <option value="imperial" ${appSettings.units === 'imperial' ? 'selected' : ''}>Imperial (inch, oz, lb, °F)</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Database & Auto Backup / Restore Section -->
            <div class="settings-section">
                <h3>Database Maintenance & Backups</h3>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:16px;">
                    Agritech automatically saves database backups to the local backups folder when starting and closing the application. Only the last 5 backups are kept to save disk space.
                </p>
                
                <div style="display:flex; gap:10px; margin-bottom:20px;">
                    <button class="btn btn-sm btn-primary" id="btn-create-manual-backup">Trigger Backup Now</button>
                </div>

                <h4 style="font-size:0.85rem; font-weight:700; color:var(--text-dim); margin-bottom:10px; text-transform:uppercase;">Available Backups for Restore</h4>
                <div class="table-container">
                    <table class="data-table" style="font-size:0.8rem;">
                        <thead>
                            <tr>
                                <th>Backup File</th>
                                <th>Date Created</th>
                                <th>Size</th>
                                <th style="text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="backups-list-tbody">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Factory Reset Section (Danger Zone) -->
            <div class="settings-section" style="border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.01);">
                <h3 style="color: var(--color-red); border-bottom-color: rgba(239, 68, 68, 0.15);">Danger Zone</h3>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:16px;">
                    Resetting the application will permanently erase all projects, experiments, observations, water samples, tasks, templates, gallery files, and settings. This operation is irreversible.
                </p>
                <button class="btn btn-sm btn-danger" id="btn-factory-reset">Erase All Application Data</button>
            </div>
        </div>
    `;

    // Event listeners
    document.getElementById('btn-save-profile')?.addEventListener('click', saveProfileSettings);
    document.getElementById('btn-factory-reset')?.addEventListener('click', handleFactoryReset);
    
    const themeSelector = document.getElementById('set-theme');
    themeSelector?.addEventListener('change', () => {
        const th = themeSelector.value;
        applyTheme(th);
        window.api.run("UPDATE settings SET value = ? WHERE key = 'theme'", [th]);
    });

    const unitSelector = document.getElementById('set-units');
    unitSelector?.addEventListener('change', () => {
        const un = unitSelector.value;
        appSettings.units = un;
        window.api.run("UPDATE settings SET value = ? WHERE key = 'units'", [un]);
    });

    document.getElementById('btn-create-manual-backup')?.addEventListener('click', runBackupCommand);

    await loadBackupsList();
}

async function saveProfileSettings() {
    const name = document.getElementById('set-user-name').value;
    const role = document.getElementById('set-set-role')?.value || document.getElementById('set-user-role').value;

    try {
        await window.api.run("UPDATE settings SET value = ? WHERE key = 'user_name'", [name]);
        await window.api.run("UPDATE settings SET value = ? WHERE key = 'user_role'", [role]);
        
        appSettings.user_name = name;
        appSettings.user_role = role;
        
        // Update header UI
        const headerAvatar = document.getElementById('header-user-avatar');
        const headerName = document.getElementById('header-user-name');
        if (headerAvatar) headerAvatar.textContent = name.charAt(0).toUpperCase();
        if (headerName) headerName.textContent = name;

        alert("Profile saved successfully!");
        logFacilityActivity(`User profile updated to: ${name}`);
    } catch(err) {
        alert("Failed to save settings: " + err.message);
    }
}

async function loadBackupsList() {
    const tbody = document.getElementById('backups-list-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    try {
        const backups = await window.api.backupList();
        
        if (backups.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:15px; color:var(--text-muted);">No backups found. Click "Trigger Backup Now" to create one.</td></tr>`;
            return;
        }

        backups.forEach(b => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(b.filename)}</strong></td>
                <td>${b.date}</td>
                <td>${(b.size / 1024).toFixed(1)} KB</td>
                <td style="text-align:right;">
                    <button class="btn btn-sm btn-secondary btn-restore-db" style="padding:4px 10px; font-size:0.75rem;">Restore</button>
                </td>
            `;

            tr.querySelector('.btn-restore-db').addEventListener('click', async () => {
                if (confirm(`Restore the database to backup: ${b.filename}? Current unsaved data since this backup will be lost. The app will reload.`)) {
                    const result = await window.api.backupRestore(b.filename);
                    if (result.success) {
                        alert(result.message);
                        location.reload();
                    } else {
                        alert("Restore failed: " + result.error);
                    }
                }
            });

            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
    }
}

async function runBackupCommand() {
    const btn = document.getElementById('btn-create-manual-backup');
    if (btn) btn.disabled = true;

    try {
        const result = await window.api.backupCreate();
        if (result.success) {
            alert(result.message);
            if (currentView === 'settings') {
                await loadBackupsList();
            }
        } else {
            alert("Backup failed: " + result.error);
        }
    } catch(e) {
        alert("Backup error: " + e.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

function handleFactoryReset() {
    const formHtml = `
        <div style="display:flex; flex-direction:column; gap:12px; padding:10px 0;">
            <p style="font-size:0.85rem; color:var(--text-dim);">
                WARNING: This will permanently delete all projects, experiments, observations, water samples, tasks, templates, and gallery files from the database.
            </p>
            <div class="form-group">
                <label for="reset-confirm-password">Enter Confirmation Password</label>
                <input type="password" class="form-control" id="reset-confirm-password" placeholder="Enter passcode to confirm erase">
            </div>
            <div id="reset-error-msg" style="color:var(--color-red); font-size:0.8rem; font-weight:600; display:none;">
                Incorrect password! Please try again.
            </div>
        </div>
    `;

    showGlobalModal("Confirm Application Reset", formHtml, `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-danger" id="btn-submit-reset">Confirm WIPE</button>
    `);

    document.getElementById('btn-submit-reset')?.addEventListener('click', async () => {
        const passwordInput = document.getElementById('reset-confirm-password');
        const errorMsg = document.getElementById('reset-error-msg');
        
        if (!passwordInput) return;
        
        if (passwordInput.value !== '9927') {
            if (errorMsg) errorMsg.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
            return;
        }

        if (!confirm("Are you absolutely sure you want to erase all data? This cannot be undone.")) {
            closeModal();
            return;
        }

        try {
            closeModal();
            
            // Clear all database tables
            await window.api.run("DELETE FROM projects");
            await window.api.run("DELETE FROM experiments");
            await window.api.run("DELETE FROM observations");
            await window.api.run("DELETE FROM water_samples");
            await window.api.run("DELETE FROM tasks");
            await window.api.run("DELETE FROM sticky_notes");
            await window.api.run("DELETE FROM templates");
            await window.api.run("DELETE FROM gallery");
            await window.api.run("DELETE FROM settings");

            // Set flag to skip demo data seeding on reload
            await window.api.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('skip_demo_seeding', 'true')");

            alert("Application database successfully wiped clean! The application will now reload.");
            location.reload();
        } catch (err) {
            alert("Erase failed: " + err.message);
        }
    });
}

/* ==========================================
   GLOBAL SEARCH DESK
   ========================================== */

async function handleGlobalSearch(queryText) {
    const viewport = document.getElementById('view-viewport');
    if (!viewport || !queryText.trim()) {
        if (!queryText.trim() && currentView === 'search-results') {
            switchView('dashboard');
        }
        return;
    }

    currentView = 'search-results';

    viewport.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <div>
                <h2 style="font-size:1.3rem; font-weight:700;">Global Search Results</h2>
                <p style="color:var(--text-muted); font-size:0.85rem;">Matches for "${escapeHtml(queryText)}"</p>
            </div>
            <div id="search-matches-results" style="display:flex; flex-direction:column; gap:16px;">
                <div style="text-align:center; padding:30px; color:var(--text-muted);">Searching database files...</div>
            </div>
        </div>
    `;

    try {
        const q = `%${queryText}%`;
        const projects = await window.api.query("SELECT id, name, investigator FROM projects WHERE name LIKE ? OR investigator LIKE ? OR objectives LIKE ?", [q, q, q]);
        const exps = await window.api.query("SELECT e.*, p.name as proj_name FROM experiments e JOIN projects p ON e.project_id=p.id WHERE e.name LIKE ? OR e.notes LIKE ?", [q, q]);
        const tasks = await window.api.query("SELECT * FROM tasks WHERE title LIKE ? OR description LIKE ?", [q, q]);

        const resultsContainer = document.getElementById('search-matches-results');
        if (!resultsContainer) return;

        let resultsHtml = '';

        if (projects.length > 0) {
            resultsHtml += `<div><h4 style="font-size:0.85rem; color:var(--primary); text-transform:uppercase; margin-bottom:8px;">Projects (${projects.length})</h4>`;
            projects.forEach(p => {
                resultsHtml += `
                    <div class="card glass" style="padding:12px; margin-bottom:8px; cursor:pointer;" onclick="openProjectDetails('${p.id}')">
                        <span style="font-weight:600; font-size:0.9rem;">${escapeHtml(p.name)}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">PI: ${escapeHtml(p.investigator)}</span>
                    </div>
                `;
            });
            resultsHtml += `</div>`;
        }

        if (exps.length > 0) {
            resultsHtml += `<div><h4 style="font-size:0.85rem; color:var(--color-purple); text-transform:uppercase; margin-bottom:8px;">Experiments (${exps.length})</h4>`;
            exps.forEach(e => {
                resultsHtml += `
                    <div class="card glass" style="padding:12px; margin-bottom:8px; cursor:pointer;" onclick="activeProjectId='${e.project_id}'; activeExperimentId='${e.id}'; switchView('${e.type}')">
                        <span style="font-weight:600; font-size:0.9rem;">${escapeHtml(e.name)}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">Project: ${escapeHtml(e.proj_name)} | Module: ${e.type}</span>
                    </div>
                `;
            });
            resultsHtml += `</div>`;
        }

        if (tasks.length > 0) {
            resultsHtml += `<div><h4 style="font-size:0.85rem; color:var(--color-yellow); text-transform:uppercase; margin-bottom:8px;">Active Tasks (${tasks.length})</h4>`;
            tasks.forEach(t => {
                resultsHtml += `
                    <div class="card glass" style="padding:12px; margin-bottom:8px; cursor:pointer;" onclick="openTaskDialog('${t.id}')">
                        <span style="font-weight:600; font-size:0.9rem;">${escapeHtml(t.title)}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">Due: ${t.due_date || 'N/A'} | Status: ${t.status}</span>
                    </div>
                `;
            });
            resultsHtml += `</div>`;
        }

        if (resultsHtml === '') {
            resultsContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">No records match your query. Try searching project names or experiment parameters.</div>`;
        } else {
            resultsContainer.innerHTML = resultsHtml;
        }

    } catch (e) {
        console.error(e);
    }
}

/* ==========================================
   GLOBAL NOTIFICATION SYSTEM
   ========================================== */

let notificationsList = [
    { id: 'notif-1', title: 'Calibration Required', body: 'The pH and EC lab probes have not been calibrated in 30 days.', type: 'warning', time: '10:00 AM' },
    { id: 'notif-2', title: 'Low Stock Alert', body: 'Nitrile Gloves (Medium) are low in stock (15 boxes remaining).', type: 'info', time: 'Yesterday' }
];

function updateNotificationCount() {
    const badge = document.getElementById('notification-count');
    if (!badge) return;

    if (notificationsList.length > 0) {
        badge.textContent = notificationsList.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function toggleNotificationDrawer() {
    const drawer = document.getElementById('notification-drawer');
    if (!drawer) return;

    drawer.classList.toggle('hidden');
    if (!drawer.classList.contains('hidden')) {
        renderNotificationsList();
    }
}

function renderNotificationsList() {
    const body = document.getElementById('notification-drawer-body');
    if (!body) return;

    body.innerHTML = '';

    if (notificationsList.length === 0) {
        body.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:0.8rem;">No active notifications.</div>`;
        return;
    }

    notificationsList.forEach(n => {
        const item = document.createElement('div');
        item.className = `notification-item ${n.type}`;
        item.innerHTML = `
            <div style="font-weight:700; color:var(--text-main); font-size:0.82rem;">${escapeHtml(n.title)}</div>
            <div style="color:var(--text-dim); line-height:1.3; font-size:0.75rem;">${escapeHtml(n.body)}</div>
            <div class="notification-item-time">${n.time}</div>
        `;
        body.appendChild(item);
    });
}

function clearNotifications() {
    notificationsList = [];
    updateNotificationCount();
    renderNotificationsList();
}

/* ==========================================
   GLOBAL TASK CREATOR / DETAIL DIALOG
   ========================================== */

async function openTaskDialog(taskId = null) {
    const isEdit = taskId !== null;
    const title = isEdit ? "Task Details & Checklist" : "Create New Facility Task";

    const projects = await window.api.query("SELECT id, name FROM projects");
    let task = null;

    if (isEdit) {
        const rows = await window.api.query("SELECT * FROM tasks WHERE id = ?", [taskId]);
        if (rows.length > 0) task = rows[0];
    }

    let checklistItems = [];
    if (task && task.checklist) {
        try { checklistItems = JSON.parse(task.checklist); } catch(e) {}
    }

    const formHtml = `
        <form id="task-dialog-form">
            <input type="hidden" id="tk-id" value="${task ? task.id : 'task-' + Date.now()}">
            <div class="form-group">
                <label for="tk-title">Task Title</label>
                <input type="text" class="form-control" id="tk-title" value="${task ? escapeHtml(task.title) : ''}">
            </div>
            <div class="form-group">
                <label for="tk-desc">Description</label>
                <textarea class="form-control" id="tk-desc">${task ? escapeHtml(task.description || '') : ''}</textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="tk-date">Due Date</label>
                    <input type="date" class="form-control" id="tk-date" value="${task ? task.due_date : ''}">
                </div>
                <div class="form-group">
                    <label for="tk-priority">Priority</label>
                    <select class="form-control" id="tk-priority">
                        <option value="low" ${task && task.priority === 'low' ? 'selected' : ''}>Low</option>
                        <option value="medium" ${!task || task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="high" ${task && task.priority === 'high' ? 'selected' : ''}>High</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="tk-status">Status</label>
                    <select class="form-control" id="tk-status">
                        <option value="todo" ${task && task.status === 'todo' ? 'selected' : ''}>To Do</option>
                        <option value="in_progress" ${task && task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="waiting" ${task && task.status === 'waiting' ? 'selected' : ''}>Waiting</option>
                        <option value="completed" ${task && task.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="tk-project">Related Project</label>
                    <select class="form-control" id="tk-project">
                        <option value="">-- Global / No Project --</option>
                        ${projects.map(p => `<option value="${p.id}" ${task && task.related_project_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Task Checklist Section -->
            <div style="margin-top:16px;">
                <label style="font-size:0.75rem; font-weight:700; color:var(--text-dim); text-transform:uppercase; display:block; margin-bottom:8px;">Sub-Task Checklist</label>
                <div id="task-checklist-builder" style="display:flex; flex-direction:column; gap:6px;">
                    <!-- checklist elements -->
                </div>
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <input type="text" class="form-control" id="tk-new-chk-text" placeholder="Add checklist item..." style="height:32px; font-size:0.8rem;">
                    <button type="button" class="btn btn-sm btn-secondary" id="btn-add-chk-item">Add</button>
                </div>
            </div>
        </form>
    `;

    const footerHtml = `
        ${isEdit ? `<button class="btn btn-danger" id="btn-delete-task-dialog" style="margin-right:auto;">Delete Task</button>` : ''}
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-task-dialog">Save Task</button>
    `;

    showGlobalModal(title, formHtml, footerHtml);

    // Render checklists
    const renderChecklist = () => {
        const box = document.getElementById('task-checklist-builder');
        if (!box) return;
        box.innerHTML = '';

        if (checklistItems.length === 0) {
            box.innerHTML = `<div style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">No sub-tasks.</div>`;
            return;
        }

        checklistItems.forEach((item, idx) => {
            const div = document.createElement('div');
            div.style.cssText = `display:flex; align-items:center; justify-content:space-between; padding:4px 8px; border-radius:4px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color);`;
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" ${item.checked ? 'checked' : ''} class="checklist-check">
                    <span style="font-size:0.8rem; ${item.checked ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${escapeHtml(item.text)}</span>
                </div>
                <button type="button" class="btn-icon-sm btn-del-chk" style="padding:2px;">${AG_ICONS.close}</button>
            `;

            div.querySelector('.checklist-check').addEventListener('change', (e) => {
                checklistItems[idx].checked = e.target.checked;
                renderChecklist();
            });

            div.querySelector('.btn-del-chk').addEventListener('click', () => {
                checklistItems.splice(idx, 1);
                renderChecklist();
            });

            box.appendChild(div);
        });
    };

    renderChecklist();

    document.getElementById('btn-add-chk-item')?.addEventListener('click', () => {
        const input = document.getElementById('tk-new-chk-text');
        if (input && input.value.trim() !== '') {
            checklistItems.push({ text: input.value.trim(), checked: false });
            input.value = '';
            renderChecklist();
        }
    });

    document.getElementById('btn-save-task-dialog')?.addEventListener('click', async () => {
        const id = document.getElementById('tk-id').value;
        const titleText = document.getElementById('tk-title').value;
        const desc = document.getElementById('tk-desc').value;
        const date = document.getElementById('tk-date').value;
        const priority = document.getElementById('tk-priority').value;
        const status = document.getElementById('tk-status').value;
        const project = document.getElementById('tk-project').value || null;

        try {
            if (isEdit) {
                await window.api.run(`
                    UPDATE tasks SET title=?, description=?, due_date=?, priority=?, status=?, related_project_id=?, checklist=?
                    WHERE id=?
                `, [titleText, desc, date, priority, status, project, JSON.stringify(checklistItems), id]);
            } else {
                await window.api.run(`
                    INSERT INTO tasks (id, title, description, due_date, priority, status, related_project_id, checklist, comments, reminder, attachments, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [id, titleText, desc, date, priority, status, project, JSON.stringify(checklistItems), JSON.stringify([]), null, JSON.stringify([]), new Date().toISOString()]);
            }

            closeModal();
            
            // Refresh parent view
            if (currentView === 'dashboard') {
                await refreshKanbanBoard();
                await renderCalendar();
            } else if (currentView === 'projects' && activeProjectId) {
                openProjectDetails(activeProjectId);
            }
            logFacilityActivity(`Task saved: ${titleText}`);
        } catch (err) {
            alert("Failed to save task: " + err.message);
        }
    });

    document.getElementById('btn-delete-task-dialog')?.addEventListener('click', async () => {
        if (confirm("Delete this task?")) {
            await window.api.run("DELETE FROM tasks WHERE id = ?", [taskId]);
            closeModal();
            if (currentView === 'dashboard') {
                await refreshKanbanBoard();
                await renderCalendar();
            } else if (currentView === 'projects' && activeProjectId) {
                openProjectDetails(activeProjectId);
            }
        }
    });
}

function triggerQuickCreateDialog() {
    showGlobalModal("Quick Add Desk", `
        <div style="display:flex; flex-direction:column; gap:12px; padding:10px 0;">
            <button class="btn btn-secondary w-100" style="justify-content:flex-start;" onclick="closeModal(); openProjectDialog();">+ Create Project</button>
            <button class="btn btn-secondary w-100" style="justify-content:flex-start;" onclick="closeModal(); openExperimentDialog();">+ Create Experiment</button>
            <button class="btn btn-secondary w-100" style="justify-content:flex-start;" onclick="closeModal(); openTaskDialog();">+ Create Task</button>
            <button class="btn btn-secondary w-100" style="justify-content:flex-start;" onclick="closeModal(); openWaterSampleDialog();">+ Register Water Sample</button>
        </div>
    `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>`);
}

function triggerGlobalSaveNotification() {
    window.api.showNotification("Agritech Research LIMS", "All changes written to local SQLite database successfully.");
}

function triggerGlobalExport() {
    if (currentView === 'reports') {
        generateCsvReport();
    } else {
        alert("To export facility files, please go to the Reports desk.");
    }
}

/* ==========================================
   HELPER UTILITIES
   ========================================== */

function showGlobalModal(title, bodyHtml, footerHtml) {
    const modal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body-content');
    const modalFooter = document.getElementById('modal-footer-actions');

    if (!modal || !modalTitle || !modalBody || !modalFooter) return;

    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalFooter.innerHTML = footerHtml;

    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('global-modal');
    if (modal) {
        modal.classList.add('hidden');
        const win = modal.querySelector('.modal-window');
        if (win) {
            win.style.width = ''; // Reset back to default CSS width
        }
    }
}

window.closeModal = closeModal; // Bind to window so inline onclick works

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
