# 01_IfcLCA

01_IfcLCA is a web platform designed to facilitate Life Cycle Assessments (LCAs) on construction projects by leveraging Industry Foundation Classes (IFC) files. It aims to simplify the LCA process by providing a user-friendly dashboard for project overview and detailed carbon footprint analysis of construction elements.

## Overview

The platform is built on a robust architecture utilizing MongoDB for data storage, Node.js with Express for server-side logic, and EJS for server-side rendering. The front end is styled with Bootstrap and uses vanilla JavaScript for dynamic content. Projects are managed through a dashboard displaying project cards, and users can upload IFC files for analysis, which is initially simulated by counting elements in the file.

## Features

- **Dashboard Overview:** View all projects at a glance with details including name, phase, and total carbon footprint.
- **Project Management:** Add new projects easily through a user-friendly form.
- **IFC File Analysis:** Upload IFC files for detailed carbon footprint analysis of building elements.
- **Simplified User Interface:** Designed with simplicity in mind, providing a straightforward user experience.

## Getting started

### Requirements

- MongoDB installed and running
- Node.js and npm installed

### Quickstart

1. Clone the repository and navigate into the project directory.
2. Copy `.env.example` to `.env` and fill in your MongoDB URL and session secret.
3. Run `npm install` to install dependencies.
4. Start the server with `npm start`.
5. Open your browser and navigate to `http://localhost:3001` to view the dashboard.

### License

Copyright (c) 2024.