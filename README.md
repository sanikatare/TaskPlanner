# TaskTrack AI

An AI-powered academic productivity platform that helps students manage assignments, optimize study schedules, predict effort requirements, and generate personalized study plans using Machine Learning and Generative AI.

---

## Overview

TaskTrack AI is an intelligent study scheduling and task optimization platform designed to assist students in managing academic workloads effectively. The system combines full-stack web development, machine learning, recommendation systems, and generative AI to automatically prioritize tasks, optimize study schedules, adapt to missed deadlines, and improve productivity.

The platform addresses common challenges faced by students, including poor task prioritization, inefficient time management, deadline conflicts, and lack of adaptive planning.

---

## Problem Statement

Students frequently manage multiple assignments, projects, examinations, practical submissions, internships, and extracurricular commitments simultaneously. Traditional calendars and task management applications provide task storage but lack intelligent decision-making capabilities.

Existing solutions typically do not:

* Prioritize tasks dynamically
* Predict effort required for completion
* Adapt schedules when tasks are skipped
* Optimize study sessions based on deadlines
* Recommend the most important task at any given time
* Generate personalized study plans

TaskTrack AI addresses these limitations through intelligent scheduling, machine learning-based predictions, recommendation systems, and generative AI assistance.

---

## Solution Approach

TaskTrack AI continuously analyzes:

* Assignment deadlines
* Task priorities
* Subject difficulty levels
* Estimated study effort
* User productivity patterns
* Historical completion data

Based on this information, the platform:

1. Predicts required study time using machine learning models.
2. Prioritizes tasks according to urgency and importance.
3. Generates optimized study schedules.
4. Adapts schedules when tasks are delayed or skipped.
5. Recommends the next best task to work on.
6. Generates personalized AI-powered study plans.

---

## Key Features

### Smart Task Scheduling

* Deadline-aware scheduling
* Automated timetable generation
* Intelligent workload balancing
* Study session optimization

### Adaptive Rescheduling

* Detects missed tasks automatically
* Recalculates priorities dynamically
* Updates future schedules in real time

### Recommendation Engine

* Suggests the next best task
* Considers urgency, workload, and difficulty
* Learns from user behavior patterns

### Time Prediction

* Estimates study hours required
* Uses machine learning regression models
* Improves predictions based on historical data

### Generative AI Assistance

* Personalized study plans
* Topic breakdown generation
* Revision schedule creation
* Learning recommendations
* Study strategy suggestions

### Google Calendar Integration

* Calendar synchronization
* Automatic event creation
* Real-time schedule updates

### Analytics Dashboard

* Productivity tracking
* Study-hour analytics
* Completion statistics
* Deadline monitoring

### Notification System

* Assignment reminders
* Deadline alerts
* Study session notifications
* Schedule change updates

---

## Technology Stack

### Frontend

* React 18
* TypeScript
* Tailwind CSS
* Chart.js
* Zustand
* React Query

### Backend

* Node.js
* Express.js
* TypeScript

### Database

* MongoDB Atlas
* Mongoose ODM

### AI Service

* Python
* FastAPI
* Scikit-Learn
* NumPy
* Pandas

### Authentication

* Firebase Authentication

### Notifications

* Firebase Cloud Messaging

### AI Integration

* Claude API (Anthropic)

### External Integrations

* Google Calendar API

---

## System Architecture

```text
Frontend (React + TypeScript + Tailwind CSS)
                │
                ▼
Backend API (Node.js + Express)
                │
                ▼
MongoDB Database
                │
      ┌─────────┴─────────┐
      ▼                   ▼
AI Service          Firebase Services
(FastAPI)           Authentication
      │             Notifications
      ▼
Machine Learning Models
      │
      ▼
Claude AI API
      │
      ▼
Google Calendar API
```

---

## Project Structure

```text
TaskTrackAI/
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   ├── utils/
│   └── assets/
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── models/
│   │   └── config/
│
├── ai-service/
│   ├── models/
│   ├── services/
│   ├── routers/
│   ├── training/
│   └── datasets/
│
├── docs/
├── docker-compose.yml
├── README.md
└── .gitignore
```

---

## Installation

### Prerequisites

* Node.js 20+
* Python 3.11+
* MongoDB Atlas or MongoDB Local
* Firebase Project
* Google Cloud Project
* Claude API Key

---

### Clone Repository

```bash
git clone https://github.com/sanikatare/TasktrackAI.git

cd TasktrackAI
```

---

## Backend Setup

```bash
cd backend

npm install
```

Create a `.env` file inside the backend directory:

```env
PORT=5000

MONGODB_URI=

JWT_SECRET=

FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

ANTHROPIC_API_KEY=
```

Start the backend server:

```bash
npm run dev
```

---

## Frontend Setup

```bash
cd frontend

npm install
```

Create a `.env.local` file and add Firebase configuration values.

Start the frontend:

```bash
npm run dev
```

---

## AI Service Setup

```bash
cd ai-service

python -m venv venv
```

### Windows

```bash
venv\Scripts\activate
```

### Linux / macOS

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the AI service:

```bash
uvicorn main:app --reload
```

---

## Running the Complete Application

### Backend

```bash
npm run dev
```

### Frontend

```bash
npm run dev
```

### AI Service

```bash
uvicorn main:app --reload
```

Application URLs:

```text
Frontend:  http://localhost:3000
Backend:   http://localhost:5000
AI Docs:   http://localhost:8000/docs
```

---

## AI and Machine Learning Components

### Time Prediction Model

Uses Ridge Regression to estimate:

* Task completion duration
* Required study effort
* Future workload expectations

### Recommendation Engine

Prioritizes tasks using:

* Deadline urgency
* Task priority
* Difficulty level
* Estimated effort

Provides:

* Best next task recommendation
* Alternative task suggestions

### Schedule Optimization

Implements:

* Earliest Deadline First (EDF)
* Dynamic workload balancing
* Fatigue-aware study sessions

### Claude AI Integration

Generates:

* Personalized study plans
* Revision schedules
* Topic breakdowns
* Learning recommendations

---

## API Overview

### Authentication APIs

```http
POST /api/auth/register
GET  /api/auth/me
```

### Task APIs

```http
GET    /api/tasks
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id
PATCH  /api/tasks/:id/complete
```

### Scheduling APIs

```http
POST /api/schedule/generate
GET  /api/schedule
POST /api/schedule/sync-calendar
```

### AI APIs

```http
POST /api/ai/recommend
POST /api/ai/generate-plan
```

---

## Deployment

### Frontend

Deploy using:

* Vercel
* Netlify

### Backend

Deploy using:

* Railway
* Render
* AWS

### Database

* MongoDB Atlas

### AI Service

* Railway
* Render
* Docker

### Docker

```bash
docker compose up --build
```

---

## Future Enhancements

* Reinforcement Learning based scheduling
* Mobile application
* Offline support
* Collaborative study groups
* Voice assistant integration
* Examination preparation mode
* Cross-device synchronization
* Advanced learning analytics

---

## Educational Objectives

This project demonstrates:

* Full Stack Development
* System Design
* REST API Development
* Machine Learning Integration
* Recommendation Systems
* Generative AI Applications
* Cloud Services Integration
* Authentication Systems
* Database Design
* Software Architecture

---

## License

This project is licensed under the MIT License.
