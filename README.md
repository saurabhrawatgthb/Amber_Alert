# Amber Alert AI Tracking System

An intelligent, highly resilient Missing Child Tracking System utilizing Distributed Video Intelligence. This system correlates simulated camera feeds, extracts intelligence via YOLO and ReID mechanisms, and visualizes geographic tracking.

## Architecture & Unified Deployment

This system fulfills the **Single Deployed Link** requirement by unifying the Next.js React frontend and the Express-equivalent API backend into a single serverless application capable of natively running on Vercel.

1.  **Frontend & Main API Server:** The directory `temp-app` is actually the **Root System**. It contains the entire UI (React, Tailwind, Framer Motion) and the main API routes (`/api/auth/login`, `/api/complaints`, `/api/cameras`). When deployed to Vercel, this yields a *single link* that serves both frontend and backend APIs immediately.
2.  **AI Microservice:** The directory `ai-service` contains the heavy-duty Python ML models (YOLO). This operates independently as a FastAPI service to avoid blocking the Node.js event loop and to maintain manageable Vercel build sizes. It exposes REST endpoints like `/scan` that the Next.js API can talk to internally.

---

## 🚀 Running Locally

### 1. Start the Unified Web Platform (Next.js)
Open a terminal and run:
```bash
cd temp-app
npm install
npm run dev
```
Wait a few seconds, then open **http://localhost:3000** in your browser. 
-> The entire UI and the Node.js backend APIs are now running on this single link!

### 2. Start the REAL AI Engine (Docker Container)
Open a separate terminal and run:
```bash
docker-compose up --build
```
*(This automatically provisions a heavy Linux environment with all C++ build tools, PyTorch, YOLOv8, OSNet, and InsightFace without corrupting your Windows registry).*

---

## 🎨 UI Access
1.  **Login Panel:** Navigate to `http://localhost:3000/login`. Credentials: `police` / `admin123`.
2.  **Dashboard:** Initiate a tracking sequence by providing child details.
3.  **Command Center Tracking:** The UI shifts to a Leaflet geospatial map mirroring intelligence logs and tracking path predictions via simulated API events.

---

## ☁️ Vercel Deployment Guide

To deploy this as a single unified system onto Vercel:

1. Push this repository to a GitHub repository.
2. In Vercel, create a new Project and select that GitHub repository.
3. For the **Root Directory** setting on Vercel, select the `temp-app/` folder.
4. Keep the framework preset to "Next.js".
5. Click **Deploy**.

Vercel will build both your Frontend (React pages) and Backend (API Routes like `/api/complaints`) and host them on a single integrated domain.

*(To deploy the Python AI service, use Render, Railway, or HuggingFace Spaces. The URLs from the AI deployment can be added as environment variables in Vercel to allow the Next.js backend to stream frames to the AI engine).*
