[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
![IfcOpenShell](https://img.shields.io/badge/IfcOpenShell-darkgreen?logo=ifcopenshell&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-blue?logo=react)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-06B6D4?logo=tailwindcss&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

## Overview
IfcLCA leverages **openBIM** and **Open Data Standards** to analyze the environmental impact of construction projects through IFC files using Swiss **KBOB** environmental impact data from [lcadata.ch](https://lcadata.ch).

## ✨ Features
- 🏗️ **Project Dashboard** - manage multiple building projects and track their progress.
- ⚙️ **IFC Processing** - upload and parse IFC files; inspect elements and materials.
- 📚 **Materials Library** - centralize materials data across projects.
- 📈 **LCA Charts** - visualize environmental impacts; export IFC with LCA results and get nice charts.

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
   - Use charts to identify key contributors
   - Comparative analysis and report export *(coming soon)*

## 🛠 Tech Stack
- **IfcOpenShell WASM** for Ifc parsing
- **Next.js** & **React** for the frontend
- **Tailwind CSS** for styling
- **Clerk** for authentication
- **MongoDB** for database
- **TypeScript** throughout the codebase

## 🌍 Open Source
IfcLCA is and will always be Open Source. Sustainability is a team effort and requires trust and transparency. The project is released under the **AGPL-3.0** license.


## 📦 Model Requirements
- **IFC version**: IFC4 preferred (IFC2x3 is supported)
- **Base Quantities**: export element volumes via Ifc Base Quantities (NetVolume or GrossVolume)
- **Materials**: include assembly layers when possible (supports `IfcMaterialLayerSet` and `IfcMaterialConstituentSet`)
- **Classification**: provide element classification codes for amortization lookup (see below)

## 🧾 Classification Support
- **Supported systems**: currently **eBKP-H** is supported for amortization years
- **Unknown/missing classification**: falls back to a sensible default amortization period
- Classification is read from your IFC model; set or correct it in your authoring tool or use [ifcclassify.com](https://ifcclassify.com)

## 📐 Emissions Calculation
IfcLCA computes three metrics using Swiss KBOB data:
- **GWP** (Global Warming Potential)
- **UBP** (Environmental Impact Points)
- **PENRE** (Primary Energy Non‑Renewable)

### Absolute emissions
- Computed per material and summed per project
- Formula (per material):

$$
\text{absolute}_{\text{metric}} = \text{volume} \times \text{density} \times \text{factor}_{\text{metric}}
$$

- Useful for total project impacts

### Relative emissions (annual, per area)
- Normalizes absolute emissions by amortization years and area
- Formula:

$$
\text{relative} = \frac{\text{absolute}}{\text{amortizationYears} \times \text{area}}
$$

- Requires a valid calculation area and classification to derive amortization years

### Units
- **Absolute**
  - GWP: `kg CO₂ eq`
  - UBP: `UBP`
  - PENRE: `kWh oil-eq`
- **Relative** (per area and year; area unit defaults to `m²`)
  - GWP: `kg CO₂ eq/<area>·a`
  - UBP: `UBP/<area>·a`
  - PENRE: `kWh oil-eq/<area>·a`
