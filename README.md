# 🌿 Agritech - Agricultural Research & Lab LIMS

Agritech is a premium desktop Laboratory Information Management System (LIMS) and Single-Page Application (SPA) designed for agricultural research facilities, lab tracking, and crop cultivation analytics. Monitor hydroponics, irrigation, soil quality, and microgreens experiments in a single unified dashboard.

---

## 🚀 Key Features

* **Multi-Module Workspaces**: Dedicated control desks for **Hydroponics**, **Irrigation**, **Soil Assessment**, and **Microgreens**.
* **Side-by-Side Data Logging**: Log environmental observations for both **Control** and **Treatment** groups simultaneously inside side-by-side columns.
* **Target Templates & Live Alerts**: Apply standard target baselines (e.g. *Leafy Greens Nutrient Profile*). The application features live boundary validation, alerting you with real-time **Drift Warnings** when parameters exceed optimal thresholds.
* **Water Quality Index (WQI) Calculator**: Log 25+ chemical parameters and auto-calculate **Residual Sodium Carbonate (RSC)**, **Sodium Adsorption Ratio (SAR)**, and the overall **Water Quality Index (WQI)**.
* **Integrated Task Board & Calendar**: Manage research tasks with a drag-and-drop Kanban desk and integrated Calendar planner.
* **Premium Desktop Aesthetics**: Features custom green-gradient layered branding, a modern dark/light theme toggle, and an animated startup splash screen.

---

## 🛠️ Technology Stack

* **Frontend**: HTML5, Vanilla JavaScript, CSS3 (harmonies, tilt cards, custom grid corkboard).
* **App Wrapper**: Electron (packaged via `electron-builder`).
* **Database**: Local SQLite (leveraging Node's native `node:sqlite` sync module).
* **Background Micro-server**: Node.js HTTP server spawned dynamically by the Electron main process to handle database queries.

---

## 📦 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v22.x or higher) installed on your system.

### Development Mode
1. Clone the repository:
   ```bash
   git clone https://github.com/punitsharma16042003/AGRITECH.git
   cd AGRITECH
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch the application:
   ```bash
   npm start
   ```

### Compile Desktop Executable (.exe)
To package the app into a standalone Windows installer (`dist/Agritech Setup 1.0.0.exe`):
```bash
npm run build
```

---

## 🛡️ Database Maintenance & Safety
* **Auto-Backups**: Agritech saves database snapshots to the `data/backups/` directory upon app startup and shutdown.
* **Safe Wipes**: The settings panel includes a password-protected (**`9927`**) Factory Reset command in the **Danger Zone** to wipe the SQLite database clean.
