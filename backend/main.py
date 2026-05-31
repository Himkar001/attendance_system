"""
main.py
--------
FastAPI backend for the Attendance System.

Start with:
    uvicorn main:app --reload --port 8000
"""

import io
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from camera import CameraThread
from recognition import RecognitionEngine
import attendance as att_db

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(title="Attendance System API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # React dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Globals ───────────────────────────────────────────────────────────────────

camera  = CameraThread(camera_index=0)
engine  = RecognitionEngine(camera)
marked_today: set = set()

# ── Startup / Shutdown ────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    global marked_today
    print("[INFO] Starting camera...")
    if not camera.start():
        print("[WARNING] Could not open webcam on index 0.")

    print("[INFO] Loading InsightFace model...")
    engine.load_model()

    # Restore marks from today's CSV (crash recovery)
    marked_today = att_db.get_already_marked_today()
    camera.marked_count = len(marked_today)
    print(f"[INFO] Ready. Already marked today: {len(marked_today)}")


@app.on_event("shutdown")
async def shutdown():
    engine.stop()
    camera.stop()


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/api/status")
def status():
    return {
        "camera":      camera.is_running(),
        "recognition": engine.running,
        "marked_today": len(marked_today),
        "students":    len(engine.list_students()),
    }


# ── Video stream ──────────────────────────────────────────────────────────────

def _mjpeg_generator():
    """Yields MJPEG frames for the browser."""
    while True:
        jpeg = camera.get_jpeg_frame()
        if jpeg is None:
            # Send a blank frame placeholder
            import time; time.sleep(0.05)
            continue
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n")


@app.get("/video/feed")
def video_feed():
    return StreamingResponse(
        _mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# ── Recognition control ───────────────────────────────────────────────────────

@app.post("/api/recognition/start")
def start_recognition():
    if engine.running:
        return {"message": "Recognition already running."}

    def on_mark(name: str):
        marked_today.add(name)
        att_db.mark(name)
        print(f"  [✓] Marked: {name}")

    engine.start(marked_today, on_mark)
    return {"message": "Recognition started."}


@app.post("/api/recognition/stop")
def stop_recognition():
    engine.stop()
    camera.update_overlays([], len(marked_today))
    return {"message": "Recognition stopped."}


# ── Registration ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str


@app.post("/api/register")
def register_student(req: RegisterRequest):
    if not req.name.strip():
        raise HTTPException(400, "Name cannot be empty.")

    frame = camera.get_raw_frame()
    if frame is None:
        raise HTTPException(503, "Camera not available.")

    result = engine.register_face(req.name.strip(), frame)
    if not result["success"]:
        raise HTTPException(400, result["message"])

    return result


@app.get("/api/register/preview")
def register_preview():
    """Returns current camera frame as JPEG for the registration preview."""
    jpeg = camera.capture_jpeg()
    if jpeg is None:
        raise HTTPException(503, "Camera not available.")
    return StreamingResponse(io.BytesIO(jpeg), media_type="image/jpeg")


# ── Students ──────────────────────────────────────────────────────────────────

@app.get("/api/students")
def list_students():
    return engine.list_students()


@app.delete("/api/students/{name}")
def delete_student(name: str):
    result = engine.delete_student(name)
    if not result["success"]:
        raise HTTPException(404, result["message"])
    return result


# ── Attendance ────────────────────────────────────────────────────────────────

@app.get("/api/attendance/today")
def attendance_today():
    students = engine.list_students()
    names    = [s["name"] for s in students]
    return att_db.get_today(names)


@app.get("/api/attendance/history")
def attendance_history(name: str = None, date: str = None):
    return att_db.get_history(name_filter=name, date_filter=date)


@app.get("/api/attendance/stats")
def attendance_stats():
    students = engine.list_students()
    names    = [s["name"] for s in students]
    return att_db.get_stats(names)


@app.get("/api/attendance/export")
def export_attendance(date: str = None):
    path = att_db.export_csv(date)
    if not path:
        raise HTTPException(404, "No attendance file found for that date.")
    filename = f"attendance_{date or 'today'}.csv"
    return FileResponse(path, media_type="text/csv",
                        headers={"Content-Disposition": f"attachment; filename={filename}"})
