# 🎓 AttendAI — Real-Time Attendance System
### FastAPI · React · InsightFace · OpenCV

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [High-Level Design (HLD)](#high-level-design)
3. [System Architecture](#system-architecture)
4. [How Face Registration Works](#how-face-registration-works)
5. [How Face Recognition Works](#how-face-recognition-works)
6. [Project Structure](#project-structure)
7. [API Reference](#api-reference)
8. [How to Run](#how-to-run)
9. [Troubleshooting](#troubleshooting)

---

## Project Overview

AttendAI is a real-time face recognition attendance system that runs entirely
on your local machine. It replaces manual attendance with a browser-based
dashboard where you can:

- Register students by capturing their face via webcam (no terminal needed)
- Automatically detect and identify faces in a live camera feed
- Mark attendance in CSV files the moment a known face is recognized
- View today's present/absent lists, historical records, and per-student stats
- Export attendance data as CSV

**Technology Stack**

| Layer | Technology | Purpose |
|---|---|---|
| Face AI | InsightFace (buffalo_sc) | Face detection + embedding |
| Runtime | ONNX Runtime | Runs InsightFace models on CPU |
| Backend | FastAPI + Uvicorn | REST API + MJPEG video stream |
| Frontend | React + Vite + Tailwind | Browser dashboard |
| Storage | CSV files | Attendance records |
| Camera | OpenCV | Webcam capture |

---

## High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React)                          │
│                     http://localhost:5173                        │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────────┐  │
│  │ Live Feed  │ │  Register  │ │ Attendance │ │   Students  │  │
│  │            │ │  Student   │ │  Records   │ │  Management │  │
│  │ MJPEG img  │ │ 5-capture  │ │ Today/     │ │ List/Delete │  │
│  │ Start/Stop │ │ sequence   │ │ History/   │ │             │  │
│  │ button     │ │ thumbnails │ │ Stats/CSV  │ │             │  │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └──────┬──────┘  │
└────────┼──────────────┼──────────────┼───────────────┼──────────┘
         │  HTTP / REST API            │               │
         ▼                             ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND                               │
│                   http://localhost:8000                          │
│                                                                  │
│  /video/feed          /api/register      /api/attendance/*       │
│  /api/recognition/*   /api/students      /api/status             │
│                                                                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ CameraThread │  │ RecognitionEngine│  │  AttendanceDB    │   │
│  │              │  │                  │  │                  │   │
│  │ Runs 24/7    │  │ InsightFace model│  │ Read/Write CSV   │   │
│  │ ~30fps loop  │  │ Face matching    │  │ Stats/Export     │   │
│  │ MJPEG output │  │ Background thread│  │                  │   │
│  └──────┬───────┘  └────────┬─────────┘  └──────────────────┘   │
└─────────┼───────────────────┼─────────────────────────────────────┘
          │                   │
          ▼                   ▼
┌─────────────────┐  ┌────────────────────────────────┐
│   WEBCAM        │  │          FILE SYSTEM           │
│   (OpenCV)      │  │                                │
│                 │  │  known_faces/                  │
│  Raw frames     │  │    Himkar_Vashistha_1.jpg       │
│  640×480        │  │    Himkar_Vashistha_2.jpg  ...  │
└─────────────────┘  │                                │
                     │  attendance/                   │
                     │    2026-05-31.csv               │
                     │    2026-06-01.csv  ...          │
                     │                                │
                     │  face_encodings.pkl            │
                     │    (cached embeddings)          │
                     └────────────────────────────────┘
```

---

## System Architecture

### Backend — 4 modules

```
backend/
├── main.py          ← FastAPI app: defines all routes, manages startup/shutdown
├── camera.py        ← CameraThread: webcam loop, annotation, MJPEG stream
├── recognition.py   ← RecognitionEngine: InsightFace, matching, registration
└── attendance.py    ← CSV read/write, today's records, history, stats
```

**Startup sequence (when you run uvicorn):**

```
1. CameraThread.start()
      └─ Opens OpenCV VideoCapture(0)
      └─ Spawns background thread running at ~30fps
      └─ Each frame stored as _raw_frame (for recognition)
         and _display_frame (annotated, for MJPEG stream)

2. RecognitionEngine.load_model()
      └─ Downloads InsightFace buffalo_sc model (first run only, ~150MB)
      └─ Loads face_encodings.pkl if it exists (cached embeddings)
      └─ Otherwise scans known_faces/ and builds embeddings from scratch

3. att_db.get_already_marked_today()
      └─ Reads today's CSV (if exists) to restore marked set after a crash
```

### Frontend — 4 pages

```
frontend/src/pages/
├── LiveFeed.jsx     ← MJPEG stream + recognition toggle + present list
├── Register.jsx     ← 5-capture registration flow with thumbnail preview
├── Attendance.jsx   ← Today / History / Stats tabs + CSV export
└── Students.jsx     ← Student list with photo count + delete
```

The Vite dev server proxies `/api/*` and `/video/*` to `localhost:8000` so
the React app never has to deal with CORS in development.

---

## How Face Registration Works

```
User types "Himkar Vashistha" → clicks "Capture 5 Photos & Register"

For each of 5 iterations (800ms apart):

  1. Frontend fetches GET /api/register/preview
        └─ Backend: camera.capture_jpeg()
        └─ Returns current raw frame as JPEG
        └─ Frontend shows it as a thumbnail

  2. Frontend sends POST /api/register { "name": "Himkar Vashistha" }
        └─ Backend: camera.get_raw_frame() → fresh BGR frame
        └─ RecognitionEngine.register_face(name, frame)

              Inside register_face():
              ┌──────────────────────────────────────────┐
              │ 1. InsightFace detects faces in frame    │
              │ 2. If no face → return error             │
              │ 3. Save photo:                           │
              │      known_faces/Himkar_Vashistha_1.jpg  │
              │ 4. Extract 512-dim normed embedding      │
              │      from the detected face              │
              │ 5. Append to known_embeddings list       │
              │ 6. Append name to known_names list       │
              │ 7. Save face_encodings.pkl               │
              └──────────────────────────────────────────┘

  3. Frontend updates progress bar: 1/5 → 2/5 → ... → 5/5
  4. Thumbnail slot fills with captured image + green checkmark
```

**What gets saved:**

```
known_faces/
  Himkar_Vashistha_1.jpg   ← full frame (BGR)
  Himkar_Vashistha_2.jpg
  Himkar_Vashistha_3.jpg
  Himkar_Vashistha_4.jpg
  Himkar_Vashistha_5.jpg

face_encodings.pkl  ← {
    "embeddings": [array(512,), array(512,), ...],
    "names":      ["Himkar Vashistha", "Himkar Vashistha", ...]
  }
```

> Multiple embeddings per person intentionally — different angles/lighting
> make matching more robust. All 5 are compared at recognition time.

---

## How Face Recognition Works

```
User clicks "Start Recognition" → POST /api/recognition/start

RecognitionEngine spawns a background thread:

┌─────────────────────────────────────────────────────────────┐
│                  Recognition Loop (10 fps)                  │
│                                                             │
│  1. frame = camera.get_raw_frame()                          │
│                                                             │
│  2. faces = insightface_app.get(frame)                      │
│        └─ Returns list of detected Face objects             │
│        └─ Each Face has: bbox, landmark, normed_embedding   │
│                                                             │
│  3. For each detected face:                                 │
│                                                             │
│       a. Get 512-dim normed embedding from face             │
│                                                             │
│       b. Compute cosine distance against ALL known:         │
│             dist = 1 - dot(face_emb, known_emb)            │
│             (lower = more similar, 0 = identical)          │
│                                                             │
│       c. Find best match (minimum distance)                 │
│                                                             │
│       d. If best_dist < THRESHOLD (0.45):                   │
│               name = known_names[best_index]                │
│             Else:                                           │
│               name = "Unknown"                              │
│                                                             │
│       e. If name is known AND not in marked_today set:      │
│               att_db.mark(name)   → write to CSV            │
│               marked_today.add(name)                        │
│                                                             │
│  4. camera.update_overlays(bboxes + names)                  │
│        └─ CameraThread draws boxes on display frame         │
│        └─ Green box = known, Red box = unknown              │
│        └─ "[MARKED] ✓" shown once attendance is logged      │
│                                                             │
│  5. Sleep 100ms → repeat                                    │
└─────────────────────────────────────────────────────────────┘
```

**What is Cosine Distance?**

InsightFace converts every face into a 512-number vector (embedding) that
captures the unique geometry of that face — distance between eyes, nose
shape, jawline, etc. Two photos of the same person produce very similar
vectors. Cosine distance measures the angle between two vectors:

```
cosine_distance = 1 - (A · B) / (|A| × |B|)

  0.0  → identical faces
  0.45 → our threshold (tunable in recognition.py)
  1.0  → completely different
```

**Why 10fps for recognition but 30fps for display?**

Recognition is CPU-heavy (running a neural network). Doing it every frame
would make the system laggy. Running it at 10fps is imperceptible to users
while keeping CPU usage low. The display thread always runs at 30fps using
the last computed overlays.

**Attendance is marked only ONCE per person per day:**

```python
if name not in marked_today:
    att_db.mark(name)       # writes to CSV
    marked_today.add(name)  # blocks future writes today
```

Even if the person stands in front of the camera for an hour, only one
entry is written. If the backend restarts mid-day, it reloads `marked_today`
from the existing CSV so no duplicates are created.

---

## Project Structure

```
attendance_system_v2/
│
├── backend/
│   ├── main.py              ← FastAPI app, all HTTP routes, startup/shutdown
│   ├── camera.py            ← CameraThread: frame loop, annotation, MJPEG
│   ├── recognition.py       ← InsightFace engine, register_face(), match loop
│   ├── attendance.py        ← CSV helpers: mark(), get_today(), get_history()
│   └── requirements.txt     ← Python dependencies
│
├── frontend/
│   ├── index.html           ← HTML entry point
│   ├── vite.config.js       ← Vite + proxy config
│   ├── tailwind.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx         ← React root
│       ├── index.css        ← Tailwind base styles
│       ├── App.jsx          ← Router + sidebar + status bar
│       └── pages/
│           ├── LiveFeed.jsx    ← Camera stream + recognition control
│           ├── Register.jsx    ← 5-capture registration flow
│           ├── Attendance.jsx  ← Today / History / Stats / Export
│           └── Students.jsx    ← Student list + delete
│
├── known_faces/             ← Auto-created. Stores face photos.
│   ├── Himkar_Vashistha_1.jpg
│   └── ...
│
├── attendance/              ← Auto-created. One CSV per day.
│   ├── 2026-05-31.csv
│   └── 2026-06-01.csv
│
├── face_encodings.pkl       ← Auto-created. Cached face embeddings.
└── README.md
```

---

## API Reference

### System
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/status` | Camera state, recognition state, counts |

### Video
| Method | Endpoint | Description |
|---|---|---|
| GET | `/video/feed` | MJPEG stream (use as `<img src="...">`) |

### Recognition
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/recognition/start` | Start face recognition loop |
| POST | `/api/recognition/stop` | Stop face recognition loop |

### Registration
| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/register` | `{"name": "John Doe"}` | Capture frame + register face |
| GET | `/api/register/preview` | — | Get current frame as JPEG |

### Students
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/students` | List all registered students + photo count |
| DELETE | `/api/students/{name}` | Delete student + all their photos |

### Attendance
| Method | Endpoint | Params | Description |
|---|---|---|---|
| GET | `/api/attendance/today` | — | Present/absent lists for today |
| GET | `/api/attendance/history` | `?name=X&date=YYYY-MM-DD` | Filtered records |
| GET | `/api/attendance/stats` | — | Per-student attendance % |
| GET | `/api/attendance/export` | `?date=YYYY-MM-DD` | Download CSV file |

---

## How to Run

### Prerequisites

- Python 3.10
- Node.js 18+
- A working webcam

### Step 1 — Install backend dependencies

```bash
cd attendance_system_v2/backend
pip install -r requirements.txt
```

On first run, InsightFace downloads its models (~150MB). This happens
automatically and is cached — subsequent starts are instant.

### Step 2 — Start the backend

```bash
cd attendance_system_v2/backend
uvicorn main:app --reload --port 8000
```

You should see:
```
[INFO] Starting camera...
[INFO] Loading InsightFace model...
[INFO] Ready. Already marked today: 0
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 3 — Install frontend dependencies

```bash
cd attendance_system_v2/frontend
npm install
```

### Step 4 — Start the frontend

```bash
cd attendance_system_v2/frontend
npm run dev
```

You should see:
```
  VITE v5.x  ready in 300ms
  ➜  Local:   http://localhost:5173/
```

### Step 5 — Open the dashboard

Go to **http://localhost:5173** in your browser.

### Step 6 — Register students

1. Click **Register Student** in the sidebar
2. Type the student's full name
3. Have them look at the camera
4. Click **"Capture 5 Photos & Register"**
5. Watch the 5 thumbnails fill in automatically
6. Repeat for each student

### Step 7 — Take attendance

1. Click **Live Feed** in the sidebar
2. Click **"Start Recognition"**
3. Students walk in front of the camera
4. Names appear with green boxes when recognized
5. Attendance is marked automatically — once per person per day
6. Click **"Stop Recognition"** when done

### Step 8 — View records

- **Attendance → Today** — present/absent for today
- **Attendance → History** — filter by date or name, download CSV
- **Attendance → Stats** — bar chart of attendance % per student

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Camera not opening | Wrong camera index | Change `camera_index=0` to `1` in `main.py` line 16 |
| InsightFace download fails | No internet | Connect to internet and restart backend |
| Face not recognized | Too few photos or bad angle | Register 5 photos, vary head angle slightly |
| "Unknown" for known person | Threshold too strict | Change `THRESHOLD = 0.45` to `0.5` in `recognition.py` |
| False matches (wrong name) | Threshold too loose | Lower `THRESHOLD` to `0.40` in `recognition.py` |
| Dashboard shows blank | Backend not running | Start backend first, check port 8000 |
| Video feed not loading | Browser blocking mixed content | Use http:// not https:// for localhost |
| Slow recognition | CPU overloaded | Close other apps; recognition runs at 10fps intentionally |

### Adjusting the recognition threshold

In `backend/recognition.py`:

```python
THRESHOLD = 0.45   # default — good balance of accuracy vs strictness

# Too many "Unknown" results?  → increase to 0.50 or 0.55
# Wrong person being matched? → decrease to 0.40 or 0.35
```

### Resetting everything

```bash
# Delete all registered faces and cached encodings:
rm -rf known_faces/* face_encodings.pkl

# Delete all attendance records:
rm -rf attendance/*
```
### Author
Himkar Vashistha