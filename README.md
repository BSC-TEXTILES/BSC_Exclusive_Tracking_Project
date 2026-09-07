<div align="center">

# BSC Exclusive Tracking

**Enterprise Process & Compliance Tracking Platform**

Track Every Process. Verify Every Location. Prove Every Action.

[![Frontend](https://img.shields.io/badge/Frontend-Live-000000?style=flat-square&logo=vercel)](https://bsc-v1-seven.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Live-46E3B7?style=flat-square&logo=render)](https://bsc-v1.onrender.com)
[![Version](https://img.shields.io/badge/Version-2.0.0-brightgreen?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-Private-blue?style=flat-square)](#)

</div>

---

## Table of Contents

1. [Project Motive](#project-motive)
2. [What Problem It Solves](#what-problem-it-solves)
3. [Key Features](#key-features)
4. [Tech Stack](#tech-stack)
5. [System Architecture](#system-architecture)
6. [Complete System Architecture Diagram](#complete-system-architecture-diagram)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Project File Structure](#project-file-structure)
9. [Authentication Flow](#authentication-flow)
10. [Profile Photo Upload Flow](#profile-photo-upload-flow)
11. [Live Google Maps Tracking Flow](#live-google-maps-tracking-flow)
12. [Map Layers Flow](#map-layers-flow)
13. [Admin Navigate-to-Location Flow](#admin-navigate-to-location-flow)
14. [Evidence Upload Flow](#evidence-upload-flow)
15. [GPS Tracking Flow](#gps-tracking-flow)
16. [WebSocket Real-Time Flow](#websocket-real-time-flow)
17. [Database Schema](#database-schema)
18. [Roles & Permissions](#roles--permissions)
19. [API Endpoints](#api-endpoints)
20. [Environment Variables](#environment-variables)
21. [Deployment](#deployment)
22. [Local Development](#local-development)

---

## Project Motive

BSC Exclusive Tracking is built for organizations that need **proof, not promises**. The core idea is simple: every task an employee completes should be verifiable, every location they visit should be tracked, and every submission should go through a proper approval chain with complete evidence.

This is not a generic project management tool. It is a **compliance enforcement platform** that ensures field operations follow documented processes, employees provide verifiable proof of their work, and management has real-time visibility into all activities.

---

## What Problem It Solves

**Without this system:**
- Supervisors cannot verify if employees actually visited assigned locations
- Paper-based logs are easily manipulated, lost, or incomplete
- No real-time visibility into where team members are
- Different employees follow different processes with no standardization
- When regulators ask for proof, organizations cannot produce it
- No way to calculate distance between admin and field employees

**With this system:**
- Every task submission requires evidence (photos, documents, audio)
- GPS locations are tracked and stored for every submission with live Google Maps
- Management sees all team locations on a live Google Map with profile photos
- Map layers (Street View, Satellite, Terrain) for detailed location analysis
- One-click navigation to any user's location via Google Maps
- Distance calculation between admin and each tracked user
- Profile photos visible on map markers and across the platform
- Every action from login to submission is logged with timestamps
- Time-based auto-approval prevents bottlenecks

---

## Key Features

| Feature | What It Does |
|---------|-------------|
| **Profile Photo Upload** | Users upload profile photos (JPG/PNG/WEBP, 5MB max) visible in their account and on the live map |
| **Live Google Maps** | Real-time tracking on Google Maps with Street View, Satellite, Terrain, and Hybrid layers |
| **Profile Photos on Map** | Each user's profile photo appears as their map marker for instant identification |
| **One-Click Navigation** | Admin clicks on any user to auto-redirect to Google Maps with distance and driving directions |
| **Distance Calculation** | Haversine formula calculates real-time distance between admin and each tracked user |
| **Map Layer Controls** | Switch between Street View, Satellite, Terrain, and Hybrid map layers |
| **Role-Based Access Control** | 6 roles with 40+ granular permissions |
| **GPS Location Tracking** | Automatic continuous location sync via WebSocket |
| **Evidence Upload** | Upload images, PDFs, CSVs, and audio files (25MB limit) |
| **Compliance Checkpoints** | Modules with checkpoints that define required tasks and evidence |
| **Submission Approval** | Review, approve, or reject submissions with comments |
| **Auto-Approval** | Submissions auto-approve after configurable time window |
| **Notifications** | Real-time in-app alerts for assignments and reviews |
| **Audit Trail** | Complete log of every action with IP and user agent |
| **Dashboard & Reports** | Analytics, charts, and CSV export |
| **Consent Gate** | Mandatory terms acceptance and location permission on first visit |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19, Vite, TypeScript | Single-page application |
| Styling | Tailwind CSS 4 | Responsive design |
| Charts | Recharts | Dashboard analytics |
| Maps | Google Maps (@vis.gl/react-google-maps) | Live tracking with layers |
| Backend | Node.js, Express 5 | REST API server |
| Realtime | Socket.IO | WebSocket for live tracking + chat |
| Authentication | JWT, bcrypt | Secure sessions |
| Database | PostgreSQL (Supabase) | Relational data storage |
| File Storage | Supabase Storage | Evidence + profile photo uploads |
| Deployment | Vercel (frontend), Render (backend) | Cloud hosting |

---

## Complete System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER / DEVICE                             │
│                                                                               │
│   ┌──────────────────────────────────────────────────────────────────────┐   │
│   │                       REACT 19 (Vite)                                │   │
│   │                                                                      │   │
│   │   ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐   │   │
│   │   │ ConsentGate  │→ │ AuthProvider │→ │ TrackingProvider       │   │   │
│   │   │ (first visit)│  │ (JWT cookie) │  │ (GPS watchPosition)   │   │   │
│   │   └──────────────┘  └──────────────┘  └────────────────────────┘   │   │
│   │                                                                      │   │
│   │   ┌──────────────────────────────────────────────────────────────┐  │   │
│   │   │                    API Client (fetch + cookies)               │  │   │
│   │   │   POST /api/profile/photo  (profile upload)                 │  │   │
│   │   │   POST /api/tracking       (GPS sync)                       │  │   │
│   │   │   GET  /api/tracking/latest (live map data)                 │  │   │
│   │   └──────────────────────────────────────────────────────────────┘  │   │
│   │                                                                      │   │
│   │   ┌──────────────────────────────────────────────────────────────┐  │   │
│   │   │              LiveMap Component (Google Maps)                  │  │   │
│   │   │   ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │  │   │
│   │   │   │ Map Layers  │  │ User Markers │  │ InfoWindow      │   │  │   │
│   │   │   │ Street View │  │ (profile     │  │ (profile photo, │   │  │   │
│   │   │   │ Satellite   │  │  photos +    │  │  role, distance,│   │  │   │
│   │   │   │ Terrain     │  │  online      │  │  navigate btn)  │   │  │   │
│   │   │   │ Hybrid      │  │  status)     │  │                 │   │  │   │
│   │   │   └─────────────┘  └──────────────┘  └─────────────────┘   │  │   │
│   │   └──────────────────────────────────────────────────────────────┘  │   │
│   │                                                                      │   │
│   │   ┌──────────────────────────────────────────────────────────────┐  │   │
│   │   │              Socket.IO Client                                 │  │   │
│   │   │   tracking:update  (real-time GPS broadcasts)               │  │   │
│   │   │   chat:message     (real-time messaging)                    │  │   │
│   │   │   notification:new (real-time alerts)                       │  │   │
│   │   └──────────────────────────────────────────────────────────────┘  │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                        │
│                          HTTPS + WebSocket                                     │
│                                      │                                        │
└──────────────────────────────────────┼────────────────────────────────────────┘
                                       │
                     ┌─────────────────▼─────────────────┐
                     │           VERCEL (CDN)             │
                     │                                     │
                     │   Static files served globally      │
                     │   API proxy: /api/* → Render        │
                     └─────────────────┬─────────────────┘
                                       │
                     ┌─────────────────▼─────────────────┐
                     │          RENDER (Backend)           │
                     │                                     │
                     │   Express REST API (Node.js)        │
                     │   Socket.IO Server                  │
                     │   JWT Validation                    │
                     │   Multer File Upload                │
                     │   Cron Jobs (auto-approve)          │
                     │                                     │
                     │   Routes:                           │
                     │   ├── /api/auth/*                   │
                     │   ├── /api/profile/*  (photo upload)│
                     │   ├── /api/tracking/*               │
                     │   ├── /api/admin/*                  │
                     │   ├── /api/evidence/*               │
                     │   └── /api/chat/*                   │
                     └──┬──────────┬──────────┬──────────┘
                        │          │          │
             ┌──────────▼┐   ┌────▼────┐   ▼──────────┐
             │ SUPABASE   │   │  JWT    │   SUPABASE   │
             │ PostgreSQL │   │ Tokens  │   Storage    │
             │            │   │         │              │
             │ Tables:    │   └─────────┘   Buckets:   │
             │ users      │                 evidence   │
             │ location_  │                 profiles   │
             │   tracks   │                            │
             │ modules    │                            │
             │ evidence   │                            │
             │ sessions   │                            │
             └────────────┘                            │
                                                       │
                     ┌─────────────────────────────────┘
                     │
             ┌───────▼───────────┐
             │   GOOGLE MAPS     │
             │   (via API key)   │
             │                    │
             │   - Map rendering  │
             │   - Street View    │
             │   - Satellite View │
             │   - Terrain View   │
             │   - Directions API │
             │   - Geocoding      │
             └────────────────────┘
```

---

## Data Flow Diagrams

### Authentication Flow

```
User Action          Frontend                  Backend                 Database
─────────────────────────────────────────────────────────────────────────────
Enters username  →   POST /api/auth/login  →   Validate credentials →  SELECT user
and password         (send credentials)        Hash password check     WHERE username = ?
                                                   │                      │
                                                   ▼                      │
                                               Create JWT token          │
                                               Set HTTP-only cookie      │
                                               INSERT session         ←──┘
                                                   │
                       ←──────────────────────────┘
Receive user         GET /api/auth/me        →   Verify JWT         →  SELECT user
object + permissions      (include cookie)        Load permissions      with role
                       ←──────────────────────────┘
Redirect to          Display dashboard
dashboard
```

---

### Profile Photo Upload Flow

```
User Action            Frontend                   Backend                Storage
─────────────────────────────────────────────────────────────────────────────
Clicks camera      →   File input triggered     →                        │
icon on profile         Select image file           Validate MIME type    │
                        (JPG/PNG/WEBP)              Check size (≤5MB)     │
                                                       │                  │
                                                       ▼                  │
Create FormData     →   POST /api/profile/      →   Delete old photo   →  Remove from
(append photo)          photo                      (if exists)            Supabase/local
                        Content-Type:                │                    │
                        multipart/form-data          ▼                    │
                                                     Store new photo    → Upload to
                                                       │                Supabase/local
                                                       ▼                  │
                                                   Generate URL           │
                                                   UPDATE users        ←──┘
                                                   SET profile_image
                                                   WHERE id = ?
                                                       │
                       ←──────────────────────────────┘
Display updated     →   Show photo in profile
profile photo            card + header avatar
                       Refresh auth context
                       Update AppShell header
```

**Explanation:**
- User hovers over their profile photo (or initials) and clicks the camera icon
- Browser opens file picker filtered to JPG/PNG/WEBP images
- Frontend validates file size (max 5 MB) and type
- Frontend creates FormData and sends POST request
- Backend deletes old profile photo from storage (if exists)
- Backend stores new photo in Supabase Storage or local disk
- Backend generates public URL and updates `users.profile_image`
- Backend creates audit log entry
- Frontend receives the new URL and updates profile card + header avatar
- Auth context refreshes so all components show the new photo

---

### Live Google Maps Tracking Flow

```
Browser               Tracking Provider          Backend              Google Maps
──────────────────────────────────────────────────────────────────────────────────
Every 15 sec    →    navigator.geolocation  →                        │
watchPosition()        .watchPosition()                              │
                         │                                           │
                         ▼                                           │
                     GPS coordinates                                 │
                     accuracy                                        │
                     battery level                                   │
                         │                                           │
                         ▼                                           │
                     socket.emit(           →   INSERT location_   →  DB
                       'tracking:update',       tracks
                       {lat, lng, acc})         │
                         │                      ▼
                         │                  Broadcast to
                         │                  admins/supervisors
                         │                      │
Admin opens      →      │                  GET /api/tracking/
live map                │                      latest
                         │                      │
                         │                      ▼
                     Display on             Return all user
                     Google Maps            locations with
                     with profile           profile images
                     photos on              and online status
                     markers
                         │                                           │
                         │                                      ┌────▼────┐
                     Click marker      →                    │ InfoWindow│
                                                               │ Show:   │
                                                               │ Photo   │
                                                               │ Name    │
                                                               │ Role    │
                                                               │ Distance│
                                                               │ Navigate│
                                                               └─────────┘
```

---

### Map Layers Flow

```
User Action            LiveMap Component          Google Maps API
──────────────────────────────────────────────────────────────────────
Clicks Layers     →    MapLayerControl opens     →
button                  Show layer options:
                         ├── Street View (roadmap)
                         ├── Satellite
                         ├── Terrain
                         └── Hybrid

Selects layer     →    Set activeLayer state     →  Map re-renders
(Satellite)            Update map type             with new
                                               mapTypeControl

Result:              Map shows satellite imagery
                     User can still see markers
                     with profile photos overlaid
```

---

### Admin Navigate-to-Location Flow

```
Admin Action           Frontend                  Backend / Google Maps
──────────────────────────────────────────────────────────────────────────
Admin sees        →    User list shows          →
user "RAM" on          profile photo +           │
live map               location coords           │
                         │                       │
                         ▼                       │
Clicks "Navigate"  →   Calculate distance        │
button next to         using Haversine           │
RAM's entry            formula                   │
                         │                       │
                         ▼                       │
                   window.open(              →   Open Google Maps
                     google.com/maps/dir)        Directions page
                     ?api=1                      with:
                     &destination=lat,lng        ├── Origin: admin loc
                     &travelmode=driving         ├── Dest: RAM loc
                                                 ├── Mode: driving
                                                 └── Route shown

Alternative:       →   Click marker on map       →  InfoWindow shows
                       Click "Navigate in         "Navigate in Google
                       Google Maps" button         Maps" button
                                                  Opens directions
```

**Distance Calculation (Haversine Formula):**

```
┌─────────────────────────────────────────────────┐
│              HAVERSINE FORMULA                    │
│                                                   │
│  a = sin²(Δlat/2) +                             │
│      cos(lat1) · cos(lat2) · sin²(Δlon/2)       │
│                                                   │
│  c = 2 · atan2(√a, √(1−a))                     │
│                                                   │
│  distance = R · c                                │
│                                                   │
│  Where R = 6,371 km (Earth's radius)            │
│                                                   │
│  Example:                                         │
│  Admin at: 19.0760°N, 72.8777°E (Mumbai)       │
│  RAM at:   18.5204°N, 73.8567°E (Pune)         │
│  Distance: ~120.4 km                            │
└─────────────────────────────────────────────────┘
```

---

### Evidence Upload Flow

```
User Action          Frontend                  Backend                 Storage
─────────────────────────────────────────────────────────────────────────────
Selects file(s)  →   Create FormData      →   Parse multipart      →  Validate MIME type
                      (append files)            request (Multer)       Check file size (25MB)
                                                   │                      │
                                                   ▼                      │
                                               Store file             →  Upload to Supabase
                                               (local or supabase)       or local disk
                                                   │                      │
                                                   ▼                      │
                                               Generate URL              │
                                               INSERT evidence_files  ←──┘
                                                   │
                       ←──────────────────────────┘
Display file in       Show metadata +       ←   Return file URL
evidence list         preview link
```

---

### GPS Tracking Flow

```
Browser             Tracking Provider         Backend              Database
────────────────────────────────────────────────────────────────────────────
Every 30 min   →   navigator.geolocation  →                      │
or manual sync      .getCurrentPosition()                        │
                       │                                          │
                       ▼                                          │
                   GPS coordinates                                │
                   accuracy                                       │
                   battery level                                  │
                       │                                          │
                       ▼                                          │
                   POST /api/tracking   →    INSERT location_  →  tracks
                   {lat, lng, accuracy}      user_id, latitude,
                                             longitude, accuracy,
                                             battery_level, tracked_at
                       │
                       ▼
                   Store in localStorage
                   Update online status
                       │
                       ▼
Supervisor       GET /api/tracking/latest →  SELECT latest    →  Return all
opens map             (include cookie)       per user              user locations
                                             WHERE tracked_at
                                             > NOW() - 5 min
                       │
                       ▼
                   Display on Google Maps
                   Show profile photos
                   Show online/offline status
                   Show distance from admin
```

---

### WebSocket Real-Time Flow

```
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   Employee   │          │   Socket.IO  │          │    Admin     │
│   (Browser)  │          │   Server     │          │   (Browser)  │
└──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │                          │                          │
       │  tracking:update         │                          │
       │  {lat, lng, acc}        │                          │
       │─────────────────────────→│                          │
       │                          │  INSERT location_tracks  │
       │                          │─────────────────────────→│ DB
       │                          │                          │
       │                          │  tracking:update         │
       │                          │  {userId, name, photo,   │
       │                          │   lat, lng, online}      │
       │                          │─────────────────────────→│
       │                          │                          │
       │                          │                    ┌─────▼─────┐
       │                          │                    │ Update map│
       │                          │                    │ markers   │
       │                          │                    │ in real   │
       │                          │                    │ time      │
       │                          │                    └───────────┘
       │                          │
       │  tracking:confirmed      │
       │←─────────────────────────│
       │  {trackedAt: timestamp}  │
```

---

## Project File Structure

```
bsc_v1/
│
├── frontend/                          # React SPA (Vite)
│   ├── public/
│   │   ├── bsc-logo.png
│   │   └── manifest.json
│   ├── src/
│   │   ├── components/                # Reusable UI components
│   │   │   ├── LiveMap.tsx            # Google Maps with layers, profile photos, navigation
│   │   │   ├── AppShell.tsx           # Page layout with profile photo in header
│   │   │   ├── ConsentGate.tsx        # First-visit consent modal
│   │   │   ├── EvidenceUploader.tsx   # File upload component
│   │   │   ├── Modal.tsx              # Reusable modal
│   │   │   ├── States.tsx             # Loading & error states
│   │   │   └── ...
│   │   ├── lib/                       # Core libraries
│   │   │   ├── api.ts                 # HTTP client with retry logic
│   │   │   ├── auth.tsx               # Auth context & provider
│   │   │   ├── tracking.tsx           # GPS tracking (continuous watchPosition)
│   │   │   ├── useSocket.ts           # Socket.IO client hook
│   │   │   ├── types.ts               # TypeScript interfaces
│   │   │   └── format.ts              # Formatting utilities
│   │   ├── pages/                     # Page components
│   │   │   ├── Profile.tsx            # Profile with photo upload
│   │   │   ├── Dashboard.tsx          # User dashboard
│   │   │   ├── admin/
│   │   │   │   ├── AdminTracking.tsx  # Live map + user list with navigate
│   │   │   │   ├── AdminUsers.tsx     # User management
│   │   │   │   └── ...
│   │   │   └── ...
│   │   ├── App.tsx                    # Route definitions
│   │   ├── main.tsx                   # Entry point
│   │   └── index.css                  # Global styles
│   ├── .env                           # VITE_GOOGLE_MAPS_API_KEY
│   └── package.json
│
├── backend/                           # Express API (Render)
│   ├── src/
│   │   ├── server.ts                  # Entry point
│   │   ├── app.ts                     # Express app setup
│   │   ├── config.ts                  # Environment variables
│   │   ├── db.ts                      # PostgreSQL connection pool
│   │   ├── websocket.ts               # Socket.IO server (tracking + chat)
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT authentication
│   │   │   └── rateLimit.ts          # Request rate limiting
│   │   ├── routes/
│   │   │   ├── profile.routes.ts      # Profile + photo upload/delete
│   │   │   ├── tracking.routes.ts     # GPS location endpoints
│   │   │   ├── auth.routes.ts         # Login, logout, session
│   │   │   ├── admin.routes.ts        # Users, modules, departments
│   │   │   ├── evidence.routes.ts     # File upload/download
│   │   │   └── ...
│   │   └── utils/
│   │       ├── session.ts             # JWT + cookie management
│   │       ├── audit.ts               # Audit logging
│   │       └── storage.ts             # File storage (local/supabase)
│   ├── uploads/
│   │   └── profiles/                  # Local profile photo storage
│   └── package.json
│
├── database/
│   ├── schema.sql                     # Full database schema
│   └── supabase-complete-setup.sql
│
├── README.md                          # This file
└── document.md                        # Detailed project documentation
```

---

## Profile Photo Upload Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PROFILE PHOTO UPLOAD PROCESS                      │
│                                                                      │
│  1. USER clicks camera icon on profile card                         │
│     │                                                                │
│     ▼                                                                │
│  2. BROWSER opens file picker (JPG/PNG/WEBP only)                   │
│     │                                                                │
│     ▼                                                                │
│  3. FRONTEND validates:                                              │
│     ├── File type: image/jpeg, image/png, image/webp                │
│     └── File size: ≤ 5 MB                                           │
│     │                                                                │
│     ▼                                                                │
│  4. FRONTEND creates FormData with file                              │
│     │                                                                │
│     ▼                                                                │
│  5. POST /api/profile/photo (multipart/form-data)                    │
│     │                                                                │
│     ▼                                                                │
│  6. BACKEND (Multer middleware):                                     │
│     ├── Validates MIME type                                          │
│     ├── Validates file size                                          │
│     └── Stores file (memory for Supabase, disk for local)           │
│     │                                                                │
│     ▼                                                                │
│  7. BACKEND deletes old photo:                                       │
│     ├── If Supabase: remove from storage bucket                     │
│     └── If local: unlink from uploads/profiles/                     │
│     │                                                                │
│     ▼                                                                │
│  8. BACKEND stores new photo:                                        │
│     ├── If Supabase: upload to profiles/{userId}/{uuid}.ext         │
│     └── If local: save to uploads/profiles/{uuid}.ext               │
│     │                                                                │
│     ▼                                                                │
│  9. BACKEND updates database:                                        │
│     └── UPDATE users SET profile_image = '{public_url}'             │
│     │                                                                │
│     ▼                                                                │
│  10. BACKEND creates audit log:                                      │
│      └── INSERT INTO audit_logs (action: PROFILE_PHOTO_UPDATED)     │
│      │                                                               │
│      ▼                                                               │
│  11. FRONTEND receives URL and updates:                              │
│      ├── Profile page photo display                                  │
│      ├── AppShell header avatar                                      │
│      ├── Auth context (user.profileImage)                            │
│      └── Live map markers (via API refresh)                         │
│                                                                      │
│  RESULT: Photo visible in profile, header, and on live map markers   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Live Google Maps Tracking Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────────┐
│                  LIVE GOOGLE MAPS TRACKING                           │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     MAP COMPONENT                             │   │
│  │                                                               │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │                MAP LAYER CONTROL                        │  │   │
│  │  │                                                         │  │   │
│  │  │  [Layers Button] → Street View | Satellite | Terrain   │  │   │
│  │  │                    Hybrid                               │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │                                                               │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │              USER MARKERS (with profile photos)         │  │   │
│  │  │                                                         │  │   │
│  │  │   ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐              │  │   │
│  │  │   │RAM  │   │SHYAM│   │RAM  │   │PRIYA│              │  │   │
│  │  │   │ 📷  │   │ 📷  │   │ 📷  │   │ 📷  │              │  │   │
│  │  │   │●ON  │   │○OFF │   │●ON  │   │●ON  │              │  │   │
│  │  │   └──┬──┘   └─────┘   └─────┘   └─────┘              │  │   │
│  │  │      │                                                  │  │   │
│  │  └──────┼──────────────────────────────────────────────────┘  │   │
│  │         │                                                      │   │
│  │         ▼                                                      │   │
│  │  ┌──────────────────────────────────────┐                     │   │
│  │  │           INFO WINDOW                 │                     │   │
│  │  │                                       │                     │   │
│  │  │  ┌──────┐  RAM Kumar                 │                     │   │
│  │  │  │ 📷   │  Employee Code: EMP001     │                     │   │
│  │  │  └──────┘  [Field Executive]         │                     │   │
│  │  │            Engineering Dept          │                     │   │
│  │  │                                       │                     │   │
│  │  │  19.076000, 72.877700                │                     │   │
│  │  │  ● Online — GPS live                  │                     │   │
│  │  │  Battery: 85%                         │                     │   │
│  │  │  Accuracy: ±15 m                      │                     │   │
│  │  │  Distance: 120.4 km                   │                     │   │
│  │  │                                       │                     │   │
│  │  │  [Navigate in Google Maps →]          │                     │   │
│  │  └───────────────────────────────────────┘                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users      │     │    roles      │     │ permissions  │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id           │────▶│ id           │     │ id           │
│ employee_code│     │ name         │     │ name         │
│ full_name    │     │ description  │     │ description  │
│ email        │     └──────────────┘     └──────────────┘
│ phone        │            │                    │
│ username     │     ┌──────────────┐            │
│ password_hash│     │role_permissions│◀──────────┘
│ profile_image│     ├──────────────┤
│ status       │     │ role_id      │
│ role_id (FK) │     │ permission_id│
│ dept_id (FK) │     └──────────────┘
└──────────────┘
        │
        │
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  departments │     │   modules    │     │ checkpoints  │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id           │◀────│ dept_id (FK) │     │ id           │
│ name         │     │ id           │◀────│ module_id(FK)│
│ description  │     │ name         │     │ title        │
│ status       │     │ slug         │     │ description  │
└──────────────┘     │ description  │     │ score        │
                     │ display_order│     │ is_accuracy  │
                     │ status       │     │ is_photo     │
                     └──────────────┘     │ display_order│
                                          │ status       │
                                          └──────────────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  evidence_   │◀────│ submissions  │◀────│ assignments  │
│   files      │     ├──────────────┤     ├──────────────┤
├──────────────┤     │ id           │     │ id           │
│ id           │     │ assignment_id│◀────│ checkpoint_id│
│ submission_id│────▶│ checkpoint_id│     │ user_id      │
│ uploaded_by  │     │ user_id      │     │ assigned_by  │
│ original_name│     │ status       │     │ status       │
│ stored_name  │     │ supervisor_  │     └──────────────┘
│ mime_type    │     │   comment    │
│ file_size    │     │ auto_approved│
│ public_url   │     │ submitted_at │
└──────────────┘     └──────────────┘
                            │
                     ┌──────────────┐
                     │  location_   │
                     │    tracks    │
                     ├──────────────┤
                     │ id           │
                     │ user_id      │
                     │ latitude     │
                     │ longitude    │
                     │ accuracy     │
                     │ battery_level│
                     │ tracked_at   │
                     └──────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ audit_logs   │     │notifications │     │  sessions    │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id           │     │ id           │     │ id           │
│ user_id      │     │ user_id      │     │ user_id      │
│ action       │     │ type         │     │ token_hash   │
│ entity_type  │     │ title        │     │ expires_at   │
│ entity_id    │     │ message      │     └──────────────┘
│ old_values   │     │ is_read      │
│ new_values   │     │ created_at   │
│ ip_address   │     └──────────────┘
│ user_agent   │
│ created_at   │
└──────────────┘
```

---

## Roles & Permissions

| Role | Access Level | Can Do |
|------|-------------|--------|
| **Admin** | Full | Everything. Bypasses all checks. Manages users, sees audit logs, navigates to any user location. |
| **Manager** | Review | Approve/reject submissions. View reports. Manage team. |
| **Supervisor** | Team | Approve/reject own team submissions. View team tracking. |
| **Auditor** | Read | View all submissions, audit logs, reports. Cannot modify. |
| **User** | Standard | Submit checkpoints. Upload evidence. Upload profile photo. View own data. |
| **Viewer** | Minimal | View own data and reports only. |

**Permission Categories:**

| Category | Permissions |
|----------|------------|
| Users | list, create, update, delete, reset-password |
| Modules | list, create, update, delete, clone |
| Checkpoints | list, create, update, delete |
| Submissions | view_all, approve, reject |
| Tracking | update, view_all, view_history |
| Evidence | upload, delete, download |
| Departments | list, create, update, delete |
| Reports | view, export |
| Audit | view |

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with username/password |
| GET | `/api/auth/me` | Get current user from session |
| POST | `/api/auth/logout` | Clear session and cookie |

### Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | Get user profile data |
| PUT | `/api/profile` | Update profile (name, email, phone) |
| PUT | `/api/profile/password` | Change password |
| POST | `/api/profile/photo` | Upload profile photo (JPG/PNG/WEBP, 5MB) |
| DELETE | `/api/profile/photo` | Remove profile photo |

### Tracking

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tracking` | Submit GPS location |
| GET | `/api/tracking/me` | Get own location history |
| GET | `/api/tracking/latest` | Get latest location per user (with profile images) |
| GET | `/api/tracking/history` | Get user location history |

### Admin - Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users` | Create new user |
| PUT | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Delete user |
| POST | `/api/admin/users/:id/reset-password` | Reset user password |

### Evidence

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/evidence` | Upload evidence file |
| GET | `/api/evidence/:id` | Download evidence file |
| DELETE | `/api/evidence/:id` | Delete evidence file |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get user notifications |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |
| DELETE | `/api/notifications/:id` | Delete notification |

---

## Environment Variables

### Frontend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend API URL (leave empty for Vercel proxy) |
| `VITE_GOOGLE_MAPS_API_KEY` | **Yes** | Google Maps API key for live map with layers |

### Backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `DB_SSL` | No | Enable SSL for database (default: auto-detect) |
| `SESSION_SECRET` | **Yes** | JWT signing secret |
| `CORS_ORIGIN` | **Yes** | Comma-separated allowed origins |
| `FILE_STORAGE_TYPE` | No | `local` or `supabase` (default: local) |
| `SUPABASE_URL` | If supabase | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | If supabase | Supabase service role key |
| `SUPABASE_BUCKET` | No | Storage bucket name (default: evidence) |
| `AUTO_APPROVE_HOURS` | No | Hours before auto-approve (default: 1) |
| `CRON_ENABLED` | No | Enable cron jobs (default: true) |

---

## Deployment

### Google Maps API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Maps JavaScript API**
4. Create an API key (restrict to your domain)
5. Add to frontend `.env`: `VITE_GOOGLE_MAPS_API_KEY=your_key_here`

### Supabase (Database)

1. Create a Supabase project at supabase.com
2. Open SQL Editor
3. Run `database/schema.sql` to create all tables
4. Copy the PostgreSQL connection string
5. Copy the service role key from Settings > API

### Render (Backend)

1. Create a new Web Service on render.com
2. Connect the GitHub repository
3. Set root directory to `backend`
4. Build command: `npm install && npm run build`
5. Start command: `node dist/server.js`
6. Add environment variables (see table above)

### Vercel (Frontend)

1. Import the GitHub repository on vercel.com
2. Framework: Vite
3. Build command: `npm run build`
4. Output directory: `dist`
5. Install command: `npm install`
6. Add environment variables:
   - `VITE_API_URL` = `https://bsc-v1.onrender.com`
   - `VITE_GOOGLE_MAPS_API_KEY` = `your_google_maps_api_key`
7. Deploy

---

## Local Development

### Prerequisites

- Node.js 18 or higher
- PostgreSQL database
- Google Maps API key (free tier available)
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/GaganCB2002/bsc_v1.git
cd bsc_v1

# Set up the database
cd database
npm install
npm run init

# Set up the backend
cd ../backend
cp .env.example .env
# Edit .env with your DATABASE_URL and SESSION_SECRET
npm install
npm run dev

# Set up the frontend
cd ../frontend
cp .env.example .env
# Edit .env with VITE_GOOGLE_MAPS_API_KEY
npm install
npm run dev
```

### Getting a Google Maps API Key

1. Go to https://console.cloud.google.com/
2. Create a project
3. Enable "Maps JavaScript API"
4. Go to Credentials → Create Credentials → API Key
5. Copy the key into `frontend/.env` as `VITE_GOOGLE_MAPS_API_KEY`

### Demo Accounts

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | Admin@123456 |
| Supervisor | jane.smith | Supervisor@123 |
| Manager | mike.ross | Manager@123 |
| User | john.doe | User@123456 |

---

## How Data Flows Between Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW SUMMARY                                │
│                                                                          │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐  │
│  │  Profile   │───→│   Auth     │───→│  AppShell  │───→│  Live Map  │  │
│  │  Photo     │    │  Context   │    │  Header    │    │  Markers   │  │
│  │  Upload    │    │ (refresh)  │    │ (avatar)   │    │ (photos)   │  │
│  └────────────┘    └────────────┘    └────────────┘    └────────────┘  │
│       │                  │                  │                 │          │
│       ▼                  ▼                  ▼                 ▼          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        BACKEND API                                │   │
│  │                                                                  │   │
│  │  POST /api/profile/photo  →  UPDATE users.profile_image        │   │
│  │  GET  /api/auth/me        →  Return user with profileImage     │   │
│  │  GET  /api/tracking/latest → Return users with profileImage    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│       │                  │                  │                 │          │
│       ▼                  ▼                  ▼                 ▼          │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐  │
│  │ Supabase   │    │  WebSocket │    │  Google    │    │  Browser   │  │
│  │ Storage    │    │  Server    │    │  Maps API  │    │  Storage   │  │
│  │ (photos)   │    │ (realtime) │    │ (render)   │    │ (consent)  │  │
│  └────────────┘    └────────────┘    └────────────┘    └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

<div align="center">

**BSC Exclusive Tracking**

Built for operations teams that need proof, not promises.

</div>
