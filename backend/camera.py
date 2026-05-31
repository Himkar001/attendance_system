"""
camera.py
----------
Manages the webcam in a background thread.
Provides:
  - Raw frames for recognition engine
  - Annotated MJPEG stream for browser
"""

import cv2
import threading
import time
import numpy as np
from datetime import datetime


class CameraThread:
    def __init__(self, camera_index: int = 0):
        self.camera_index  = camera_index
        self.cap           = None
        self.running       = False
        self.thread        = None

        self._raw_frame    = None          # latest raw frame (for recognition)
        self._display_frame = None         # latest annotated frame (for stream)
        self._lock         = threading.Lock()

        # Overlays injected by recognition engine
        self.face_overlays  = []           # list of (bbox, name, marked)
        self.marked_count   = 0
        self.recognition_on = False

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self):
        if self.running:
            return True
        self.cap = cv2.VideoCapture(self.camera_index)
        if not self.cap.isOpened():
            return False
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.running = True
        self.thread  = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()
        return True

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=2)
        if self.cap:
            self.cap.release()
        self.cap = None

    def is_running(self) -> bool:
        return self.running

    # ── Internal loop ─────────────────────────────────────────────────────────

    def _loop(self):
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(0.05)
                continue

            with self._lock:
                self._raw_frame = frame.copy()

            annotated = self._annotate(frame)
            with self._lock:
                self._display_frame = annotated

            time.sleep(0.03)   # ~30fps cap

    def _annotate(self, frame):
        """Draw face boxes + status overlay onto frame."""
        out = frame.copy()

        for (bbox, name, marked) in self.face_overlays:
            x1, y1, x2, y2 = bbox
            color = (0, 200, 0) if name != "Unknown" else (0, 0,220)
            cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
            cv2.rectangle(out, (x1, y2 - 32), (x2, y2), color, cv2.FILLED)
            label = f"{name}  {'✓' if marked else ''}"
            cv2.putText(out, label, (x1 + 5, y2 - 8),
                        cv2.FONT_HERSHEY_DUPLEX, 0.6, (255, 255, 255), 1)

        # Status bar
        ts    = datetime.now().strftime("%Y-%m-%d  %H:%M:%S")
        mode  = "RECOGNITION ON" if self.recognition_on else "RECOGNITION OFF"
        mcolor = (0, 255, 100) if self.recognition_on else (0, 140, 255)

        cv2.putText(out, ts,   (10, 25),  cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 255), 2)
        cv2.putText(out, mode, (10, 50),  cv2.FONT_HERSHEY_SIMPLEX, 0.6, mcolor, 2)
        cv2.putText(out, f"Marked today: {self.marked_count}",
                    (10, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 180), 2)

        return out

    # ── Public accessors ──────────────────────────────────────────────────────

    def get_raw_frame(self):
        with self._lock:
            return self._raw_frame.copy() if self._raw_frame is not None else None

    def get_jpeg_frame(self):
        """Returns JPEG bytes of the latest annotated frame."""
        with self._lock:
            frame = self._display_frame
        if frame is None:
            return None
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        return buf.tobytes()

    def capture_jpeg(self):
        """Returns JPEG bytes of the current raw frame (for registration)."""
        frame = self.get_raw_frame()
        if frame is None:
            return None
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
        return buf.tobytes()

    def update_overlays(self, overlays, marked_count: int):
        self.face_overlays = overlays
        self.marked_count  = marked_count
