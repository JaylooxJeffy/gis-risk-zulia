# GIS Risk Zulia 🗺️

> A full-stack web GIS application for managing and visualizing risk zones across Zulia State, Venezuela.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-336791?style=flat&logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet.js-1.9-199900?style=flat&logo=leaflet&logoColor=white)

---

## 📌 Overview

GIS Risk Zulia is my undergraduate thesis project at Universidad del Zulia (FEC), developed as a production-ready geographic information system. It enables government analysts and consultants to register, visualize, and manage risk zones (flooding, soil erosion, contamination, etc.) on an interactive map of Maracaibo and Zulia State.

---

## ✨ Features

- 🗺️ **Interactive map** with Leaflet.js — draw, edit, and delete risk zones as polygons
- 👥 **Role-based access control** — three roles: Consultant, Analyst, Administrator
- 🔐 **JWT authentication** with bcrypt password hashing
- 📧 **Password recovery** via email (Nodemailer + Gmail)
- 📊 **Risk factor management** — categorized by level (high/medium) and type
- 🗄️ **Spatial database** with PostGIS for geospatial queries
- 📱 **Responsive frontend** built with vanilla JavaScript

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express.js |
| Database | PostgreSQL 16 + PostGIS |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Maps | Leaflet.js, ArcGIS API |
| Auth | JWT, bcrypt |
| Email | Nodemailer, Gmail SMTP |
| Dev Tools | Git, dotenv |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 16 with PostGIS extension
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/JaylooxJeffy/gis-risk-zulia.git
cd gis-risk-zulia

# Install backend dependencies
cd backend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your database credentials and JWT secret

# Start the server
node server.js
```

### Database Setup

```bash
# Create the database
createdb gis_risk_db

# Enable PostGIS
psql -d gis_risk_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Run the schema
psql -d gis_risk_db -f backend/crear_archivos.js
```

### Frontend

Open `frontend/index.html` with a local server (e.g., Live Server on port 5500).

---

## 👤 User Roles

| Role | Permissions |
|------|-------------|
| **Consultant** | View map and risk zones |
| **Analyst** | Create and edit risk zones and factors |
| **Administrator** | Full access including user management |

---

## 📁 Project Structure

```
gis-risk-zulia/
├── backend/
│   ├── config/          # Database connection
│   ├── controllers/     # Route logic
│   ├── middleware/      # Auth middleware (JWT)
│   ├── models/          # Data models
│   ├── routes/          # API endpoints
│   ├── utils/           # Helper functions
│   ├── server.js        # Entry point
│   └── .env.example     # Environment variables template
└── frontend/
    ├── index.html       # Main application
    └── ...
```

---

## 🌍 Live Demo

> Currently runs on localhost. Deployment coming soon.

---

## 👨‍💻 Author

**Jefferson Rosales** — Computer Engineering student at Universidad del Zulia  
📧 jeffersonrosales2014@gmail.com  
🔗 [GitHub](https://github.com/JaylooxJeffy) | [Upwork](https://www.upwork.com/freelancers/jeffersonr)

---

## 📄 License

This project was developed as an undergraduate thesis. All rights reserved © 2025 Jefferson Rosales.
