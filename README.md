# IfcLCA

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
![Next.js](https://img.shields.io/badge/Next.js-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-blue?logo=react)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-06B6D4?logo=tailwindcss&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

## Overview
IfcLCA leverages **openBIM** and **Open Data Standards** to analyze environmental impact of construction projects through IFC files using Swiss **KBOB** data from [lcadata.ch](https://lcadata.ch).

## ✨ Features
- 🏗️ **Project Dashboard** — manage multiple building projects and track their progress.
- ⚙️ **IFC Processing** — upload, parse and inspect IFC files with a built‑in 3D viewer.
- 📚 **Materials Library** — centralize materials data across projects.
- 📈 **LCA Reports** — calculate environmental impacts and export professional reports.
- 🌗 **Dark Mode** — comfortable viewing in light or dark themes.
- 🔐 **Secure Login** — authenticate safely with Clerk.

## 🚀 Typical Workflow
1. **Export your Model**
   - IFC version: preferably IFC4 (2x3 works too)
   - Include all *Ifc Base Quantities* (NetVolume or GrossVolume)
   - Include assembly layers (prefer `IfcMaterialLayerSet`, `IfcMaterialConstituentSet` also supported)
2. **Upload**
   - Drop your IFC file in the upload area or click to browse
   - Files are processed locally and never stored on our servers
3. **Map Materials**
   - Search the full KBOB database
   - Combine your materials with environmental impact data
4. **Analyze Results**
   - View impact metrics: GWP, PEnr, UBP and material breakdown
   - Use interactive charts and material hotspots to identify issues
   - Comparative analysis and report export *(coming soon)*

## 🛠 Tech Stack
- **Next.js** & **React** for the frontend
- **Three.js** for 3D visualization
- **Tailwind CSS** for styling
- **Clerk** for authentication
- **MongoDB / Neon** for databases
- **TypeScript** throughout the codebase

## 👤 Creator
Built by **Louis Trümpler**, combining construction expertise with digital innovation to create sustainable solutions and make environmental impact assessment accessible to everyone.

## 🌍 Open Source
IfcLCA is and will always be Open Source. Sustainability is a team effort and requires trust and transparency. The project is released under the **AGPL-3.0** license.

## ❓ Need Help?
### Common Issues
- Missing quantities in IFC files
- Unmatched materials
- Large file processing
- Incorrect export settings

### Get Support
Join our community, report issues or ask for help if things go wrong: **Community Forum**.
