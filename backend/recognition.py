"""
recognition.py
---------------
InsightFace-based face recognition engine.
Runs in a background thread, reads frames from CameraThread,
matches against known embeddings, updates overlays and logs attendance.
"""

import os
import cv2
import pickle
import threading
import time
import numpy as np
from datetime import datetime

KNOWN_FACES_DIR = "../known_faces"
ENCODINGS_FILE  = "../face_encodings.pkl"
THRESHOLD       = 0.45   # cosine distance — lower = stricter


class RecognitionEngine:
    def __init__(self, camera):
        self.camera    = camera
        self.app       = None          # InsightFace app
        self.running   = False
        self.thread    = None

        self.known_embeddings = []
        self.known_names      = []

        self._attendance_callback = None   # called when someone is marked

    # ── InsightFace setup ─────────────────────────────────────────────────────

    def load_model(self):
        from insightface.app import FaceAnalysis
        self.app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
        self.app.prepare(ctx_id=0, det_size=(640, 640))
        self.reload_encodings()
        return True

    # ── Encodings ─────────────────────────────────────────────────────────────

    def reload_encodings(self):
        """Re-read known faces from disk (call after registering a new student)."""
        enc_path = os.path.join(os.path.dirname(__file__), ENCODINGS_FILE)
        if os.path.exists(enc_path):
            with open(enc_path, "rb") as f:
                data = pickle.load(f)
            self.known_embeddings = data["embeddings"]
            self.known_names      = data["names"]
            return

        # Build from images
        self.known_embeddings = []
        self.known_names      = []
        faces_dir = os.path.join(os.path.dirname(__file__), KNOWN_FACES_DIR)

        if not os.path.exists(faces_dir):
            return

        for filename in os.listdir(faces_dir):
            if not filename.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            filepath = os.path.join(faces_dir, filename)
            img      = cv2.imread(filepath)
            if img is None:
                continue
            faces = self.app.get(img)
            if not faces:
                continue

            base  = os.path.splitext(filename)[0]
            parts = base.rsplit("_", 1)
            name  = (parts[0] if parts[-1].isdigit() else base).replace("_", " ").title()

            self.known_embeddings.append(faces[0].normed_embedding)
            self.known_names.append(name)

        self._save_encodings()

    def _save_encodings(self):
        enc_path = os.path.join(os.path.dirname(__file__), ENCODINGS_FILE)
        with open(enc_path, "wb") as f:
            pickle.dump({"embeddings": self.known_embeddings,
                         "names":      self.known_names}, f)

    def register_face(self, name: str, image_bgr) -> dict:
        """
        Detect face in image_bgr, save photo + embedding.
        Returns {"success": bool, "message": str}
        """
        faces = self.app.get(image_bgr)
        if not faces:
            return {"success": False, "message": "No face detected in frame. Try again."}

        # Save photo
        faces_dir = os.path.join(os.path.dirname(__file__), KNOWN_FACES_DIR)
        os.makedirs(faces_dir, exist_ok=True)
        safe_name = name.strip().replace(" ", "_")
        idx       = sum(1 for f in os.listdir(faces_dir) if f.startswith(safe_name)) + 1
        filename  = f"{safe_name}_{idx}.jpg"
        cv2.imwrite(os.path.join(faces_dir, filename), image_bgr)

        # Add embedding
        display_name = name.strip().title()
        self.known_embeddings.append(faces[0].normed_embedding)
        self.known_names.append(display_name)
        self._save_encodings()

        return {"success": True, "message": f"{display_name} registered successfully!",
                "filename": filename}

    def delete_student(self, name: str) -> dict:
        """Remove all photos and embeddings for a student."""
        faces_dir  = os.path.join(os.path.dirname(__file__), KNOWN_FACES_DIR)
        safe_name  = name.replace(" ", "_")
        deleted    = 0

        if os.path.exists(faces_dir):
            for f in os.listdir(faces_dir):
                if os.path.splitext(f)[0].rsplit("_", 1)[0] == safe_name:
                    os.remove(os.path.join(faces_dir, f))
                    deleted += 1

        # Rebuild encodings without this person
        indices = [i for i, n in enumerate(self.known_names) if n != name]
        self.known_embeddings = [self.known_embeddings[i] for i in indices]
        self.known_names      = [self.known_names[i]      for i in indices]
        self._save_encodings()

        # Delete cached pkl so it's rebuilt fresh
        enc_path = os.path.join(os.path.dirname(__file__), ENCODINGS_FILE)
        if os.path.exists(enc_path):
            os.remove(enc_path)

        return {"success": deleted > 0,
                "message": f"Deleted {deleted} image(s) for {name}"}

    def list_students(self) -> list:
        faces_dir = os.path.join(os.path.dirname(__file__), KNOWN_FACES_DIR)
        if not os.path.exists(faces_dir):
            return []

        students = {}
        for f in os.listdir(faces_dir):
            if not f.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            base  = os.path.splitext(f)[0]
            parts = base.rsplit("_", 1)
            name  = (parts[0] if parts[-1].isdigit() else base).replace("_", " ").title()
            students[name] = students.get(name, 0) + 1

        return [{"name": k, "photos": v} for k, v in sorted(students.items())]

    # ── Recognition loop ──────────────────────────────────────────────────────

    def start(self, marked_today: set, mark_callback):
        if self.running:
            return
        self.running              = True
        self._marked_today        = marked_today
        self._attendance_callback = mark_callback
        self.camera.recognition_on = True
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        self.camera.recognition_on = False
        if self.thread:
            self.thread.join(timeout=2)

    def _cosine_dist(self, a, b):
        return 1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-6)

    def _loop(self):
        while self.running:
            frame = self.camera.get_raw_frame()
            if frame is None or not self.known_embeddings:
                time.sleep(0.1)
                continue

            faces    = self.app.get(frame)
            overlays = []

            for face in faces:
                emb  = face.normed_embedding
                name = "Unknown"

                dists = [self._cosine_dist(emb, k) for k in self.known_embeddings]
                best  = int(np.argmin(dists))
                if dists[best] < THRESHOLD:
                    name = self.known_names[best]
                    if name not in self._marked_today:
                        self._attendance_callback(name)

                bbox   = face.bbox.astype(int).tolist()
                marked = name in self._marked_today
                overlays.append((bbox, name, marked))

            self.camera.update_overlays(overlays, len(self._marked_today))
            time.sleep(0.1)   # 10 recognitions/sec is plenty
