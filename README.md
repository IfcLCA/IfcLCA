# 01_IfcLCA

A web platform designed for conducting Life Cycle Assessments (LCAs) on construction projects. It streamlines the LCA process by allowing users to upload Industry Foundation Classes (IFC) files for carbon footprint analysis of building elements, presented through a user-friendly dashboard showcasing project summaries.

## Overview

The platform leverages a Node.js backend with Express for server-side logic, MongoDB for data storage, and EJS for templating. It emphasizes simplicity in user interaction and system design, with server-side rendering for dynamic content delivery. The application architecture simulates carbon footprint analysis through a mock Python script.

## Features

- **Dashboard Overview:** An interactive array of project cards displaying essential details and the total carbon footprint.
- **Project Management:** Easy project creation, updating, and visualization.
- **IFC File Analysis:** Upload IFC files for a simulated carbon footprint analysis of construction elements.

## Getting Started

### Requirements

- Node.js
- MongoDB
- Python (for the mock analysis script)

### Quickstart

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Set up your `.env` file based on `.env.example`.
4. Start the server with `npm start`.
5. Access the web application at `http://localhost:<PORT>` (default is 3000).

### License

Copyright (c) 2024.