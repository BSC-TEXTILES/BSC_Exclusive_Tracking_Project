# BSC Exclusive Tracking
## Complete Project Documentation

---

## 1. Project Overview

BSC Exclusive Tracking is a full-stack enterprise web application designed for organizations that need to track compliance processes, verify employee locations, collect evidence, and maintain complete audit trails. The system enforces accountability through GPS tracking, photo/document evidence, supervisor approvals, and automated compliance workflows.

This platform is built for operations teams that need proof, not promises. Every action is logged, every location is verified, and every submission is tracked through a complete approval chain.

---

## 2. Project Motive

### 2.1 Problem Statement

Organizations face several challenges in managing field operations:

- **No proof of work** — Supervisors cannot verify if employees actually visited assigned locations or completed tasks
- **Paper-based tracking** — Manual logs are easily manipulated, lost, or incomplete
- **No real-time visibility** — Management has no insight into where team members are or what they are doing
- **Inconsistent compliance** — Different employees follow different processes with no standardization
- **Audit failures** — When regulators ask for proof, organizations cannot produce it
- **Delayed approvals** — Paper submissions take days or weeks to reach decision makers
- **No accountability** — Without tracking, there is no way to measure performance or identify issues

### 2.2 Solution

BSC Exclusive Tracking solves these problems by providing:

- **Digital proof** — Every task submission requires evidence (photos, documents, audio)
- **GPS verification** — Employee locations are tracked and stored for every submission
- **Real-time dashboard** — Management can see all team locations on a live map
- **Standardized workflows** — Checkpoints define exactly what needs to be done at each step
- **Complete audit trail** — Every action from login to submission is logged with timestamps
- **Automated approvals** — Time-based auto-approval prevents bottlenecks
- **Role-based access** — Each person sees only what they need to see

### 2.3 Target Users

- **Compliance teams** — Need proof that regulations are being followed
- **Operations managers** — Need visibility into field activities
- **Field employees** — Need a simple way to submit evidence and report progress
- **Auditors** — Need read-only access to verify processes
- **HR teams** — Need to track employee activity and performance
- **Executive leadership** — Need high-level dashboards and reports

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                               │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    REACT 19 (Vite)                            │  │
│  │                                                               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │  │
│  │  │ Consent  │→ │  Auth    │→ │ Tracking │→ │  Pages   │    │  │
│  │  │  Gate    │  │ Provider │  │ Provider │  │ (Routes) │    │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────────────────────────┐    │  │
│  │  │         API Client (fetch + credentials)              │    │  │
│  │  └──────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                    HTTPS /api/* requests                             │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   VERCEL            │
                    │   Static + CDN      │
                    │   + API Proxy       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   RENDER            │
                    │   Node.js/Express   │
                    │   REST API          │
                    └──┬──────┬──────┬───┘
                       │      │      │
          ┌────────────▼┐  ┌──▼───┐  ▼──────────────┐
          │  SUPABASE   │  │ JWT  │  SUPABASE       │
          │  PostgreSQL │  │(Auth)│  Storage         │
          │  (Database) │  │      │  (Files)         │
          └─────────────┘  └──────┘  └──────────────┘
```

### 3.2 Component Breakdown

#### Frontend (React SPA)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Build Tool | Vite 6.3.5 | Fast compilation, HMR |
| UI Framework | React 19.2.2 | Component-based UI |
| Routing | React Router 7.10.5 | Client-side navigation |
| Styling | Tailwind CSS 4.1.12 | Utility-first CSS |
| HTTP Client | Fetch API | API communication |
| Charts | Recharts 2.15.4 | Dashboard analytics |
| Maps | Leaflet 1.9.4 | GPS tracking visualization |
| File Upload | Native FormData | Evidence submission |

#### Backend (Express API)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js 18+ | Server environment |
| Framework | Express 5.1.0 | REST API |
| Database | PostgreSQL 14+ | Data storage |
| Authentication | JWT (jsonwebtoken) | Session management |
| Password Hashing | bcrypt 6.0.0 | Secure storage |
| File Upload | Multer 2.0.1 | Multipart handling |
| Validation | Zod 4.1.12 | Schema validation |
| Cron Jobs | node-cron 4.0.1 | Scheduled tasks |

#### Database (Supabase PostgreSQL)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Database | PostgreSQL | Relational data |
| Storage | Supabase Storage | File uploads |
| Connection | pg Pool | Connection management |
| SSL | Required | Encrypted connections |

### 3.3 Deployment Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Vercel    │    │   Render    │    │  Supabase   │
│             │    │             │    │             │
│ Frontend    │    │ Backend     │    │ Database    │
│ React SPA   │    │ Express API │    │ PostgreSQL  │
│ CDN + HTTPS │    │ Node.js     │    │ File Storage│
│ API Proxy   │    │ SSL/TLS     │    │ SSL/TLS     │
└─────────────┘    └─────────────┘    └─────────────┘
```

---

## 4. Core Components

### 4.1 Authentication System

**File:** `backend/src/routes/auth.routes.ts`, `frontend/src/lib/auth.tsx`

The authentication system handles user login, session management, and security.

**Features:**
- JWT tokens stored in HTTP-only cookies
- Password hashing with bcrypt (10 salt rounds)
- Session tracking in database
- Automatic session expiry (7 days)
- Logout with cookie clearing
- CORS configuration for cross-origin requests

**Flow:**
1. User submits username and password
2. Backend validates credentials against database
3. Backend creates JWT token with user ID and role
4. Token is set as HTTP-only cookie
5. Session row is inserted into database
6. Frontend receives user object and permissions
7. Protected routes check cookie on every request

**Security Measures:**
- Passwords never stored in plaintext
- JWT secret is environment variable
- Cookies are HTTP-only (no JavaScript access)
- SameSite cookie policy (None in production for cross-origin)
- Session expiry enforced on both client and server

### 4.2 Role-Based Access Control (RBAC)

**File:** `backend/src/middleware/rbac.ts`, `database/schema.sql`

The RBAC system provides granular permissions for different user roles.

**Roles:**
- **Admin** — Full access to all features, bypasses all checks
- **Manager** — Can approve/reject submissions, view reports
- **Supervisor** — Can manage team members, approve/reject
- **Auditor** — Read-only access to submissions and audit logs
- **User** — Can submit checkpoints, upload evidence, track location
- **Viewer** — Can view own data and reports only

**Permission Structure:**
```
roles
  └── role_permissions
        └── permissions
              ├── users:list, users:create, users:update, users:delete
              ├── modules:list, modules:create, modules:update, modules:delete
              ├── checkpoints:list, checkpoints:create, checkpoints:update, checkpoints:delete
              ├── submissions:view_all, submissions:approve, submissions:reject
              ├── tracking:update, tracking:view_all, tracking:view_history
              ├── evidence:upload, evidence:delete, evidence:download
              ├── departments:list, departments:create, departments:update
              ├── reports:view, reports:export
              ├── audit:view
              └── notifications:manage
```

**Middleware:**
- `requireAuth` — Checks if user is authenticated
- `requirePermission(permission)` — Checks if user has specific permission
- `requireRole(roles)` — Checks if user has one of the specified roles

### 4.3 GPS Tracking System

**Files:** `frontend/src/lib/tracking.tsx`, `backend/src/routes/tracking.routes.ts`

The GPS tracking system captures and stores employee locations.

**Features:**
- Automatic 30-minute interval tracking
- Manual "Sync Now" button
- Location history per user
- Online/offline status detection
- Accuracy and battery level recording
- Geofencing support (future)
- Live map display for supervisors

**Data Captured:**
- Latitude and longitude
- Accuracy (meters)
- Battery level (%)
- Timestamp
- User ID

**Frontend Implementation:**
- Uses browser Geolocation API
- Permission check before requesting location
- 20-second timeout for GPS acquisition
- 120-second maximum age for cached positions
- Exponential backoff on permission denial

**Backend Implementation:**
- Stores location in `location_tracks` table
- Queries latest location per user for live map
- Supports location history queries
- Calculates online status based on last 5 minutes

### 4.4 Evidence Upload System

**Files:** `backend/src/routes/evidence.routes.ts`, `frontend/src/components/EvidenceUploader.tsx`

The evidence upload system handles file storage and retrieval.

**Supported File Types:**
- Images: JPG, JPEG, PNG, WEBP, GIF
- Documents: PDF
- Spreadsheets: CSV
- Audio: MP3, WAV, M4A, OGG, AAC, MP4

**File Size Limit:** 25 MB per file

**Storage Options:**
- **Local:** Files stored in `backend/uploads/` directory
- **Supabase:** Files stored in Supabase Storage bucket

**Upload Process:**
1. User selects file(s) in browser
2. Frontend creates FormData with files
3. Backend receives multipart request
4. Multer validates MIME type and file size
5. File is stored (local or Supabase)
6. Metadata is saved to `evidence_files` table
7. Public URL is returned to frontend

**Security:**
- MIME type validation (no file extension spoofing)
- File size limits enforced
- Files linked to specific submissions
- Only owners can delete their files
- Audit log entry for every upload

### 4.5 Compliance Checkpoint System

**Files:** `backend/src/routes/admin.routes.ts`, `frontend/src/pages/admin/AdminModules.tsx`

The checkpoint system defines compliance tasks and tracks completion.

**Structure:**
```
Modules
  └── Checkpoints
        └── Checkpoint Assignments
              └── Checkpoint Submissions
                    └── Evidence Files
```

**Module Properties:**
- Name and description
- Department assignment
- Display order
- Status (active/inactive)

**Checkpoint Properties:**
- Title and description
- Score (0-100)
- Accuracy required flag
- Photo required flag
- Display order
- Status (active/inactive)

**Submission Workflow:**
1. Supervisor assigns checkpoints to users
2. User sees assigned checkpoints in dashboard
3. User fills in checkpoint data
4. User uploads required evidence
5. User submits for approval
6. System creates submission record
7. Supervisor reviews and approves/rejects
8. System auto-approves after 1 hour (configurable)

### 4.6 Notification System

**Files:** `backend/src/routes/notifications.routes.ts`, `frontend/src/components/NotificationBell.tsx`

The notification system provides real-time alerts to users.

**Notification Types:**
- Checkpoint assigned
- Submission approved
- Submission rejected
- System announcements

**Features:**
- In-app notification bell with unread count
- Mark as read functionality
- Mark all as read
- Delete individual notifications
- Real-time updates

**Storage:**
- Notifications stored in `notifications` table
- Linked to specific user
- Include type, title, message, and metadata
- Read status tracked

### 4.7 Auto-Approval System

**Files:** `backend/src/jobs/autoApprove.ts`, `backend/src/config.ts`

The auto-approval system prevents submission bottlenecks.

**How It Works:**
1. Submissions are created with status `pending`
2. Cron job runs every 5 minutes
3. Job finds submissions pending for more than 1 hour
4. Job updates status to `approved`
5. Job sets `auto_approved = true`
6. Audit log entry is created

**Configuration:**
- `AUTO_APPROVE_HOURS` — Hours before auto-approval (default: 1)
- `CRON_ENABLED` — Enable/disable cron job (default: true)
- `CRON_EXPRESSION` — Cron schedule (default: `*/5 * * * *`)

### 4.8 Audit Logging System

**File:** `backend/src/utils/audit.ts`

The audit system tracks every action in the system.

**Logged Events:**
- User login/logout
- User create/update/delete
- Module create/update/delete/clone
- Checkpoint create/update/delete
- Submission submit/approve/reject
- Evidence upload/delete
- Location tracking submissions
- Permission changes

**Audit Record:**
- User ID
- Action performed
- Entity type and ID
- Old values (before change)
- New values (after change)
- IP address
- User agent
- Timestamp

### 4.9 Data Flow Diagrams

#### 4.9.1 Authentication Flow

**What happens when a user logs in:**

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
                                                  │                      │
                       ←──────────────────────────┘
Redirect to          Display dashboard
dashboard
```

**Explanation:**
- User enters credentials in the login form
- Frontend sends POST request with username and password
- Backend queries the database for the user
- Backend uses bcrypt to compare the password hash
- If valid, backend creates a JWT token with user ID and role
- Token is set as an HTTP-only cookie (not accessible via JavaScript)
- Session is recorded in the database for tracking
- Frontend receives the user object with all permissions
- Frontend redirects to the appropriate dashboard based on role

---

#### 4.9.2 Evidence Upload Flow

**What happens when a user uploads a file:**

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

**Explanation:**
- User clicks upload button and selects file(s)
- Frontend creates a FormData object with the files
- Frontend sends POST request with multipart/form-data content type
- Backend uses Multer to parse the multipart request
- Multer validates the MIME type against an allowlist
- Multer checks the file size is under 25MB
- File is stored either locally in `uploads/` or uploaded to Supabase Storage
- Backend generates a public URL for the file
- Backend inserts a record into the `evidence_files` table
- Frontend receives the metadata and displays the file in the evidence list

---

#### 4.9.3 GPS Tracking Flow

**What happens when location is captured:**

```
Browser             Tracking Provider         Backend              Database
─────────────────────────────────────────────────────────────────────────────
Every 30 min   →   navigator.geolocation  →                      │
or manual sync      .getCurrentPosition()                        │
                      │                                           │
                      ▼                                           │
                  GPS coordinates                                 │
                  accuracy                                        │
                  battery level                                   │
                      │                                           │
                      ▼                                           │
                  POST /api/tracking   →    INSERT location_    →  tracks
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
                  Display on Leaflet map
                  Show online/offline status
```

**Explanation:**
- Browser's Geolocation API is triggered (automatic or manual)
- Browser requests GPS coordinates from the device
- Coordinates include latitude, longitude, and accuracy
- Frontend also captures battery level
- Frontend sends POST request with location data
- Backend inserts a record into the `location_tracks` table
- Location is stored with a timestamp
- When supervisor opens the map, backend queries latest locations
- Backend returns all users with location in last 5 minutes
- Frontend displays markers on a Leaflet map
- Online status is determined by whether location was updated recently

---

#### 4.9.4 Checkpoint Submission Flow

**What happens when a user submits a checkpoint:**

```
User Action          Frontend                  Backend                 Database
─────────────────────────────────────────────────────────────────────────────
Fills checkpoint →   POST /api/checkpoints →  Validate input     →  INSERT submission
form + uploads       /submit                 Check permissions      (status: pending)
evidence             {checkpoint_id,         Link evidence files
                      data, evidence_ids}    Create audit log
                                                  │
                       ←──────────────────────────┘
Receive               Display success
confirmation          notification
                                                  │
Supervisor reviews:                                │
                                                  │
Approves          →   PATCH /api/admin       →   UPDATE submission →  status: approved
                      /submissions/:id/appve      reviewed_by
                                                  reviewed_at
                                                  │
Rejects           →   PATCH /api/admin       →   UPDATE submission →  status: rejected
                      /submissions/:id/reject     supervisor_comment
                                                  reviewed_by
                                                  │
Auto-approve (1hr):                                │
                      Cron job runs            →  UPDATE submissions → status: approved
                      every 5 minutes              WHERE status = pending
                                                   AND submitted_at < NOW() - 1 hour
```

**Explanation:**
- User navigates to an assigned checkpoint
- User fills in the required data fields
- User optionally uploads evidence files
- Frontend sends POST request with submission data
- Backend validates the input using Zod schemas
- Backend checks user permissions
- Backend creates a submission record with status "pending"
- Backend links any uploaded evidence files
- Backend creates an audit log entry
- User receives a success notification
- Supervisor can review the submission
- Supervisor can approve or reject with comments
- If no action within 1 hour, cron job auto-approves

---

#### 4.9.5 Consent Gate Flow

**What happens on first visit:**

```
User Opens Site      ConsentGate              localStorage
─────────────────────────────────────────────────────────────
                  →  Check localStorage
                     key: bsc_consent_accepted
                          │
                          ▼
                     Key exists?
                     ┌────┴────┐
                     No        Yes
                     │          │
                     ▼          ▼
              Show modal    Render app
              (blocking)    directly
                     │
                     ▼
              User must check:
              ☐ Terms & Conditions
              ☐ Privacy Policy
              ☐ Grant Location
                     │
                     ▼
              All checked?
              ┌────┴────┐
              No        Yes
              │          │
              ▼          ▼
           Button     Save to
           disabled   localStorage
              │       key: bsc_consent_accepted
              │       key: bsc_location_granted
              │          │
              └──────────┘
                          │
                          ▼
                     Render app
```

**Explanation:**
- When the app loads, ConsentGate checks localStorage
- If consent was previously given, the app renders immediately
- If not, a modal blocks the entire screen
- User must read and check Terms & Conditions checkbox
- User must read and check Privacy Policy checkbox
- User must grant browser location permission
- All three checkboxes must be checked
- The submit button remains disabled until all are checked
- Once all checked, consent is saved to localStorage
- The modal closes and the app renders

---

#### 4.9.6 RBAC Permission Check Flow

**What happens on every protected API request:**

```
Frontend Request     Backend Middleware        Permission Check       Database
─────────────────────────────────────────────────────────────────────────────
GET /api/admin/  →  requireAuth()         →   Extract JWT from    →  SELECT sessions
users                 │                        cookie                 WHERE token_hash = ?
                      │                        │                      AND expires_at > NOW()
                      ▼                        │
                  JWT valid?               ←───┘
                  ┌────┴────┐
                  No        Yes
                  │          │
                  ▼          ▼
              401 Unauthorized    requirePermission('users:list')
              Clear cookie              │
                                        ▼
                                  Has permission?
                                  ┌────┴────┐
                                  No        Yes
                                  │          │
                                  ▼          ▼
                              403 Forbidden    Execute route handler
                              Return error     Query database
                                               Return response
```

**Explanation:**
- Frontend sends request with HTTP-only cookie
- `requireAuth` middleware extracts JWT from cookie
- Middleware verifies JWT signature and expiry
- If invalid, returns 401 and clears cookie
- If valid, `requirePermission` middleware checks permission
- Middleware queries user's role and permissions from database
- If user lacks permission, returns 403 Forbidden
- If user has permission, route handler executes
- Route handler queries database and returns response

---

#### 4.9.7 Auto-Approval Cron Flow

**What happens every 5 minutes:**

```
Cron Scheduler       Auto-Approve Job         Backend                 Database
─────────────────────────────────────────────────────────────────────────────
Every 5 min     →   Start job              →                      │
(CRON_EXPRESSION)      │                                            │
                       ▼                                            │
                  Query pending        →    SELECT submissions    →  WHERE status = 'pending'
                  submissions                JOIN assignments          AND submitted_at
                                              JOIN checkpoints        < NOW() - INTERVAL '1 hour'
                       │                                            │
                       ▼                                            │
                  Found submissions?                                │
                  ┌────┴────┐                                       │
                  No        Yes                                     │
                  │          │                                       │
                  ▼          ▼                                       │
              Log "No      For each submission:                     │
              pending"         │                                     │
                               ▼                                     │
                          UPDATE submission   →  status = 'approved'
                          Set auto_approved      auto_approved = true
                          reviewed_at = NOW()    reviewed_by = NULL
                               │                                     │
                               ▼                                     │
                          INSERT audit_log    →  action = 'auto_approve'
                          Log the action          entity_type = 'submission'
```

**Explanation:**
- Cron scheduler triggers every 5 minutes
- Job queries for submissions with status "pending" older than 1 hour
- If no pending submissions, job logs and exits
- For each pending submission, job updates status to "approved"
- Job sets `auto_approved = true` to indicate system approval
- Job sets `reviewed_at` to current timestamp
- Job creates audit log entry for traceability
- This prevents submissions from being stuck in "pending" forever

---

#### 4.9.8 Notification Flow

**What happens when a notification is created:**

```
Trigger Event        Backend                   Notification           Frontend
─────────────────────────────────────────────────────────────────────────────
Submission      →   Check who to notify    →                      │
approved/rejected      │                                            │
                       ▼                                            │
                  Build notification                                │
                  {                                                 │
                    user_id: supervisor_id,                         │
                    type: 'submission_approved',                    │
                    title: 'Submission Approved',                   │
                    message: 'Your submission was approved',        │
                    metadata: { submission_id }                     │
                  }                                                 │
                       │                                            │
                       ▼                                            │
                  INSERT INTO             →  notifications          │
                  notifications              table                   │
                       │                                            │
                       ▼                                            │
                  Return success        →                          │
                                              GET /api/notifications
                                              (polling or WebSocket)
                                                   │
                                                   ▼
                                              Update notification
                                              bell badge count
                                              Display in dropdown
```

**Explanation:**
- Trigger event occurs (submission approved/rejected, etc.)
- Backend determines which users need to be notified
- Backend builds notification object with type, title, message, metadata
- Backend inserts record into `notifications` table
- Frontend polls for new notifications (or uses WebSocket)
- Frontend updates the notification bell badge count
- User can click bell to see notification dropdown
- User can mark notifications as read
- User can delete individual notifications

---

#### 4.9.9 Audit Logging Flow

**What happens when an action is logged:**

```
User Action          Audit Logger              Database
───────────────────────────────────────────────────────────────
User performs    →   captureAudit()         →
action (login,        │
submit, approve)      ▼
                  Build audit record:
                  {
                    user_id: req.user.id,
                    action: 'submission_submit',
                    entity_type: 'checkpoint_submission',
                    entity_id: submission.id,
                    old_values: null,
                    new_values: { status: 'pending' },
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent'],
                    created_at: NOW()
                  }
                       │
                       ▼
                  INSERT INTO             →  audit_logs
                  audit_logs                 table
                       │
                       ▼
                  Return success
```

**Explanation:**
- User performs an action (login, submit, approve, etc.)
- Route handler calls `captureAudit()` utility
- Audit logger builds record with user, action, entity details
- Logger captures old values (before change) and new values (after change)
- Logger captures IP address and user agent from request
- Logger inserts record into `audit_logs` table
- Audit trail is immutable — records cannot be modified or deleted
- Auditors can query audit_logs to verify all actions

---

#### 4.9.10 File Storage Flow

**What happens when a file is uploaded to Supabase:**

```
Backend              Supabase Storage         Database
───────────────────────────────────────────────────────────
Receive file    →                          │
from Multer          │                      │
                     ▼                      │
                Validate file               │
                - MIME type check           │
                - Size limit (25MB)         │
                     │                      │
                     ▼                      │
                Generate unique             │
                filename                    │
                (uuid + original)           │
                     │                      │
                     ▼                      │
                Upload to bucket    →  evidence/           │
                evidence/                  │
                     │                      │
                     ▼                      │
                Get public URL    ←  Return URL            │
                     │                      │
                     ▼                      │
                Store metadata     →  INSERT evidence_files │
                in database              │
                     │                   │
                     ▼                   │
                Return to frontend  ←───┘
```

**Explanation:**
- Backend receives file from Multer middleware
- Backend validates MIME type against allowlist
- Backend checks file size is under 25MB limit
- Backend generates unique filename using UUID
- Backend uploads file to Supabase Storage bucket
- Supabase returns public URL for the file
- Backend inserts metadata into `evidence_files` table
- Metadata includes original name, stored name, MIME type, size, URL
- Backend returns file metadata to frontend
- Frontend displays file in evidence list with preview

---

## 5. Database Schema

### 5.1 Core Tables

#### users
Stores user accounts and profile information.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| employee_code | VARCHAR(50) | Unique employee identifier |
| full_name | VARCHAR(100) | User's full name |
| email | VARCHAR(150) | Email address |
| phone | VARCHAR(20) | Phone number |
| username | VARCHAR(50) | Login username (unique) |
| password_hash | VARCHAR(255) | bcrypt hashed password |
| status | VARCHAR(20) | active, inactive, suspended |
| role_id | UUID | Foreign key to roles |
| department_id | UUID | Foreign key to departments |
| created_at | TIMESTAMP | Account creation time |
| updated_at | TIMESTAMP | Last update time |

#### roles
Defines user roles and their descriptions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(50) | Role name (unique) |
| description | TEXT | Role description |

#### permissions
Lists all available permissions in the system.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Permission name (unique) |
| description | TEXT | Permission description |

#### role_permissions
Maps roles to their permissions (many-to-many).

| Column | Type | Description |
|--------|------|-------------|
| role_id | UUID | Foreign key to roles |
| permission_id | UUID | Foreign key to permissions |

#### departments
Organizational departments.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Department name |
| description | TEXT | Department description |
| status | VARCHAR(20) | active, inactive |
| created_at | TIMESTAMP | Creation time |

#### modules
Compliance modules that contain checkpoints.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Module name |
| slug | VARCHAR(100) | URL-friendly identifier |
| description | TEXT | Module description |
| department_id | UUID | Foreign key to departments |
| display_order | INT | Sort order |
| status | VARCHAR(20) | active, inactive |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

#### checkpoints
Individual compliance tasks within modules.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| module_id | UUID | Foreign key to modules |
| title | VARCHAR(200) | Checkpoint title |
| description | TEXT | Detailed description |
| score | INT | Score value (0-100) |
| is_accuracy_required | BOOLEAN | Must provide accuracy data |
| is_photo_required | BOOLEAN | Must upload photo |
| display_order | INT | Sort order |
| status | VARCHAR(20) | active, inactive |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

#### checkpoint_assignments
Assigns checkpoints to specific users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| checkpoint_id | UUID | Foreign key to checkpoints |
| user_id | UUID | Foreign key to users |
| assigned_by | UUID | Foreign key to users (assigner) |
| assigned_at | TIMESTAMP | Assignment time |
| status | VARCHAR(20) | assigned, completed, cancelled |

#### checkpoint_submissions
Records when users submit checkpoint completions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| assignment_id | UUID | Foreign key to assignments |
| checkpoint_id | UUID | Foreign key to checkpoints |
| user_id | UUID | Foreign key to users |
| submission_date | DATE | Date of submission |
| status | VARCHAR(20) | pending, approved, rejected, draft |
| supervisor_comment | TEXT | Reviewer's comments |
| reviewed_by | UUID | Foreign key to users (reviewer) |
| reviewed_at | TIMESTAMP | Review time |
| auto_approved | BOOLEAN | Was auto-approved |
| submitted_at | TIMESTAMP | Submission time |

#### evidence_files
Stores metadata for uploaded files.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| submission_id | UUID | Foreign key to submissions |
| uploaded_by | UUID | Foreign key to users |
| original_name | VARCHAR(255) | Original filename |
| stored_name | VARCHAR(255) | Stored filename |
| mime_type | VARCHAR(100) | File MIME type |
| file_size | BIGINT | File size in bytes |
| storage_path | TEXT | Path to stored file |
| public_url | TEXT | Public URL for access |
| created_at | TIMESTAMP | Upload time |

#### location_tracks
Stores GPS location data for users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| latitude | DECIMAL(10,8) | GPS latitude |
| longitude | DECIMAL(11,8) | GPS longitude |
| accuracy | DECIMAL(10,2) | Accuracy in meters |
| battery_level | INT | Device battery percentage |
| tracked_at | TIMESTAMP | When location was captured |
| created_at | TIMESTAMP | Record creation time |

#### notifications
In-app notifications for users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| type | VARCHAR(50) | Notification type |
| title | VARCHAR(200) | Notification title |
| message | TEXT | Notification message |
| metadata | JSONB | Additional data |
| is_read | BOOLEAN | Read status |
| created_at | TIMESTAMP | Creation time |

#### sessions
Active user sessions for authentication.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| token_hash | VARCHAR(255) | Hashed session token |
| expires_at | TIMESTAMP | Expiry time |
| created_at | TIMESTAMP | Creation time |

#### audit_logs
Complete audit trail of all system actions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users |
| action | VARCHAR(100) | Action performed |
| entity_type | VARCHAR(50) | Entity type affected |
| entity_id | UUID | Entity ID affected |
| old_values | JSONB | Values before change |
| new_values | JSONB | Values after change |
| ip_address | INET | Client IP address |
| user_agent | TEXT | Client user agent |
| created_at | TIMESTAMP | Action time |

### 5.2 Entity Relationships

```
users ──┬── roles
        ├── departments
        ├── checkpoint_submissions
        ├── location_tracks
        ├── evidence_files
        └── notifications

modules ──┬── departments
          └── checkpoints

checkpoints ──┬── checkpoint_assignments
              └── checkpoint_submissions

checkpoint_assignments ── checkpoint_submissions

checkpoint_submissions ── evidence_files

roles ── role_permissions ── permissions
```

---

## 6. API Endpoints

### 6.1 Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | No | User login |
| GET | /api/auth/me | Yes | Get current user |
| POST | /api/auth/logout | Yes | User logout |

### 6.2 Admin - Users

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | /api/admin/users | users:list | List all users |
| POST | /api/admin/users | users:create | Create new user |
| PUT | /api/admin/users/:id | users:update | Update user |
| DELETE | /api/admin/users/:id | users:delete | Delete user |
| POST | /api/admin/users/:id/reset-password | users:update | Reset password |

### 6.3 Admin - Modules

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | /api/admin/modules | modules:list | List all modules |
| POST | /api/admin/modules | modules:create | Create module |
| PUT | /api/admin/modules/:id | modules:update | Update module |
| DELETE | /api/admin/modules/:id | modules:delete | Delete module |
| POST | /api/admin/modules/:id/clone | modules:create | Clone module |

### 6.4 Admin - Checkpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | /api/admin/modules/:moduleId/checkpoints | checkpoints:list | List checkpoints |
| POST | /api/admin/modules/:moduleId/checkpoints | checkpoints:create | Create checkpoint |
| PUT | /api/admin/checkpoints/:id | checkpoints:update | Update checkpoint |
| DELETE | /api/admin/checkpoints/:id | checkpoints:delete | Delete checkpoint |

### 6.5 Admin - Departments

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | /api/admin/departments | departments:list | List departments |
| POST | /api/admin/departments | departments:create | Create department |
| PUT | /api/admin/departments/:id | departments:update | Update department |
| DELETE | /api/admin/departments/:id | departments:delete | Delete department |

### 6.6 Admin - Assignments

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | /api/admin/assignments | assignments:list | List assignments |
| POST | /api/admin/assignments | assignments:create | Create assignment |
| DELETE | /api/admin/assignments/:id | assignments:delete | Delete assignment |

### 6.7 Tracking

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | /api/tracking | tracking:update | Submit location |
| GET | /api/tracking/me | Auth only | Get own history |
| GET | /api/tracking/latest | tracking:view_all | Get all latest |
| GET | /api/tracking/history | tracking:view_all | Get user history |

### 6.8 Evidence

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | /api/evidence/:id | Auth + owner | Download file |
| DELETE | /api/evidence/:id | Auth + owner | Delete file |

### 6.9 Notifications

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | /api/notifications | Auth only | Get notifications |
| PATCH | /api/notifications/:id/read | Auth only | Mark as read |
| PATCH | /api/notifications/read-all | Auth only | Mark all read |
| DELETE | /api/notifications/:id | Auth only | Delete notification |

### 6.10 Checkpoints (User)

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | /api/checkpoints/assigned | Auth only | Get assigned |
| POST | /api/checkpoints/submit | Auth only | Submit completion |

### 6.11 Reports

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | /api/reports/dashboard | Auth only | Dashboard stats |
| GET | /api/reports/submissions | Auth only | Submission report |
| GET | /api/reports/tracking | Auth only | Tracking report |

### 6.12 Admin - Reports

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | /api/admin/reports/submissions | Auth admin | Submissions report |
| GET | /api/admin/reports/submissions/export | Auth admin | Export CSV |
| GET | /api/admin/reports/tracking | Auth admin | Tracking report |
| GET | /api/admin/reports/tracking/export | Auth admin | Export CSV |

---

## 7. Frontend Pages

### 7.1 Public Pages

| Page | Path | Description |
|------|------|-------------|
| Landing | / | Marketing page with features |
| Login | /login | User authentication |

### 7.2 Protected Pages

| Page | Path | Roles | Description |
|------|------|-------|-------------|
| Dashboard | / | All | Main user dashboard |
| Checkpoints | /checkpoints | user, supervisor, manager | View assigned tasks |
| Submit | /checkpoints/:id | user | Submit checkpoint data |
| Tracking | /tracking | user, supervisor, manager | GPS tracking |
| Evidence | /evidence | user, supervisor, manager | View uploaded files |
| Notifications | /notifications | All | View notifications |
| Profile | /profile | All | User profile settings |

### 7.3 Supervisor Pages

| Page | Path | Roles | Description |
|------|------|-------|-------------|
| Dashboard | /supervisor | supervisor, manager | Team overview |
| Submissions | /supervisor/submissions | supervisor, manager | Review submissions |
| Team | /supervisor/team | supervisor, manager | Team management |

### 7.4 Admin Pages

| Page | Path | Roles | Description |
|------|------|-------|-------------|
| Dashboard | /admin | admin | Admin overview |
| Users | /admin/users | admin | User management |
| Modules | /admin/modules | admin | Module management |
| Audit | /admin/audit | admin | Audit log viewer |
| Settings | /admin/settings | admin | System settings |

---

## 8. Security Implementation

### 8.1 Authentication Security

- **JWT Tokens:** Signed with server-side secret, HTTP-only cookies
- **Password Hashing:** bcrypt with 10 salt rounds
- **Session Expiry:** 7-day token lifetime
- **Cookie Security:** SameSite=None in production (cross-origin)

### 8.2 Authorization Security

- **RBAC Middleware:** Checks permissions on every request
- **Route Guards:** Frontend checks permissions before rendering
- **Resource Ownership:** Users can only access their own data
- **Admin Bypass:** Admin role bypasses all permission checks

### 8.3 Data Security

- **Input Validation:** Zod schemas on all endpoints
- **SQL Injection Prevention:** Parameterized queries only
- **XSS Prevention:** React auto-escaping, CSP headers
- **CORS:** Configurable allowed origins
- **File Upload Security:** MIME validation, size limits

### 8.4 Infrastructure Security

- **SSL/TLS:** All connections encrypted
- **Environment Variables:** Secrets never in code
- **Audit Logging:** Every mutation logged
- **Rate Limiting:** Configurable request limits (future)

---

## 9. Deployment Guide

### 9.1 Supabase Setup

1. Create Supabase project
2. Run `schema.sql` in SQL Editor
3. Run `supabase-storage-setup.sql`
4. Copy connection string
5. Copy service role key

### 9.2 Render Setup

1. Create Web Service
2. Connect GitHub repository
3. Set root directory: `backend`
4. Build command: `npm install && npm run build`
5. Start command: `node dist/server.js`
6. Set environment variables:
   - DATABASE_URL
   - DB_SSL=true
   - SESSION_SECRET
   - CORS_ORIGIN
   - FILE_STORAGE_TYPE=supabase
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - AUTO_APPROVE_HOURS=1
   - CRON_ENABLED=true

### 9.3 Vercel Setup

1. Connect GitHub repository
2. Framework preset: Vite
3. Build command: `npm run build`
4. Output directory: `dist`
5. Install command: `npm install`
6. Set environment variable:
   - VITE_API_URL=https://bsc-v1.onrender.com
7. Deploy

### 9.4 Environment Variables

| Variable | Location | Required | Description |
|----------|----------|----------|-------------|
| DATABASE_URL | Render | Yes | PostgreSQL connection string |
| DB_SSL | Render | No | Force SSL connections |
| SESSION_SECRET | Render | Yes | JWT signing secret |
| CORS_ORIGIN | Render | Yes | Allowed frontend URLs |
| FILE_STORAGE_TYPE | Render | No | local or supabase |
| SUPABASE_URL | Render | If supabase | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Render | If supabase | Service role key |
| SUPABASE_BUCKET | Render | No | Storage bucket name |
| MAX_FILE_SIZE_MB | Render | No | Max upload size |
| AUTO_APPROVE_HOURS | Render | No | Auto-approval window |
| CRON_ENABLED | Render | No | Enable cron jobs |
| CRON_EXPRESSION | Render | No | Cron schedule |
| VITE_API_URL | Vercel | No | Backend API URL |

---

## 10. Troubleshooting

### 10.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 405 on login | Vercel proxy not working | Check vercel.json and VITE_API_URL |
| Cannot reach database | Wrong DATABASE_URL format | Use PostgreSQL string, not HTTP |
| Evidence upload fails | Wrong storage config | Set FILE_STORAGE_TYPE=supabase |
| GPS not working | Browser permission denied | Grant location permission |
| Login loop | Cookie not set | Check CORS_ORIGIN and sameSite |
| Build fails | Node version mismatch | Use Node 18+ |
| TypeScript errors | Missing types | Run npm install |

### 10.2 Debug Mode

Set environment variables for debugging:

```bash
LOG_LEVEL=debug     # Enable verbose logging
NODE_ENV=development # Enable dev features
DB_SSL=false        # Disable SSL (dev only)
```

### 10.3 Health Check

Backend health endpoint: `GET /api/health`

Returns:
```json
{
  "status": "healthy",
  "database": "connected",
  "version": "1.0.0",
  "uptime": 12345
}
```

---

## 11. Future Enhancements

### 11.1 Planned Features

- **Push Notifications** — Browser push notifications for alerts
- **Email Notifications** — Email alerts for important events
- **Mobile App** — React Native mobile application
- **Offline Support** — Service worker for offline capability
- **Geofencing** — Virtual boundaries for location tracking
- **Advanced Analytics** — ML-powered insights
- **Multi-language** — Internationalization support
- **SSO Integration** — SAML/OAuth enterprise login
- **Webhook System** — Event-driven integrations
- **API Rate Limiting** — Protection against abuse

### 11.2 Technical Debt

- Add comprehensive unit tests
- Add integration tests
- Implement E2E testing
- Add API documentation (Swagger/OpenAPI)
- Implement database migrations
- Add monitoring and alerting
- Optimize database queries
- Add Redis caching layer

---

## 12. Development Guidelines

### 12.1 Code Style

- TypeScript for all new code
- Functional components with hooks
- Consistent naming conventions
- No comments unless requested
- Follow existing patterns

### 12.2 Git Workflow

- Feature branches from main
- Pull request reviews required
- Squash merge preferred
- Descriptive commit messages
- Never commit secrets

### 12.3 Testing

- Unit tests for utilities
- Integration tests for API endpoints
- E2E tests for critical flows
- Minimum 80% code coverage target

---

## 13. Support

For issues and questions:

- **GitHub Issues:** https://github.com/GaganCB2002/bsc_v1/issues
- **Documentation:** This file and README.md
- **Code Comments:** In source files

---

<div align="center">

**BSC Exclusive Tracking**
Enterprise Process & Compliance Platform

Built with React, Express, PostgreSQL, and Supabase

</div>
