"""
models.py — AI Model Loading & Inference Functions v3.0
========================================================
Handles:
  - YOLOv8 person/vehicle detection
  - InsightFace face embedding + matching (primary)
  - face_recognition/dlib fallback (CPU-friendly)
  - DeepSORT multi-object tracking
  - OSNet appearance re-identification
  - MediaPipe person detection (lightweight fallback)
  - PaddleOCR license plate reading (optional)

Confidence return signature changed to:
  process_frame_for_person → (img, is_match, face_conf, reid_conf)
"""

import cv2
import numpy as np
from typing import Optional, Tuple
from scipy.spatial.distance import cosine

# ─────────────────────────────────────────────
# YOLOv8 — Person + Vehicle Detection
# ─────────────────────────────────────────────
print("[MODELS] Loading YOLOv8n...", flush=True)
try:
    from ultralytics import YOLO
    yolo_model = YOLO("yolov8n.pt")
    print("[MODELS] YOLOv8n loaded ✓", flush=True)
    HAS_YOLO = True
except Exception as e:
    print(f"[MODELS] YOLOv8 FAILED: {e}", flush=True)
    yolo_model = None
    HAS_YOLO = False


# ─────────────────────────────────────────────
# InsightFace — Primary Face Analysis
# ─────────────────────────────────────────────
HAS_INSIGHTFACE = False
face_app = None
try:
    import insightface
    from insightface.app import FaceAnalysis
    face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    face_app.prepare(ctx_id=-1, det_size=(640, 640))
    HAS_INSIGHTFACE = True
    print("[MODELS] InsightFace (buffalo_l) loaded ✓", flush=True)
except Exception as e:
    print(f"[MODELS] InsightFace not available: {e}", flush=True)


# ─────────────────────────────────────────────
# face_recognition (dlib) — CPU-Friendly Fallback
# ─────────────────────────────────────────────
HAS_FACE_RECOGNITION = False
try:
    import face_recognition
    HAS_FACE_RECOGNITION = True
    print("[MODELS] face_recognition (dlib) loaded ✓", flush=True)
except ImportError:
    print("[MODELS] face_recognition not installed", flush=True)


# ─────────────────────────────────────────────
# DeepSORT — Multi-Object Tracking
# ─────────────────────────────────────────────
HAS_DEEPSORT = False
tracker = None
try:
    from deep_sort_realtime.deepsort_tracker import DeepSort
    tracker = DeepSort(max_age=30, nn_budget=100, override_track_class=None)
    HAS_DEEPSORT = True
    print("[MODELS] DeepSORT loaded ✓", flush=True)
except ImportError:
    print("[MODELS] DeepSORT not installed — install: pip install deep-sort-realtime", flush=True)


# ─────────────────────────────────────────────
# OSNet (torchreid) — Appearance Re-ID
# ─────────────────────────────────────────────
HAS_OSNET = False
osnet = None
try:
    import torch
    import torchreid
    osnet = torchreid.models.build_model(
        name="osnet_x1_0",
        num_classes=1000,
        loss="softmax",
        pretrained=True,
    )
    osnet.eval()
    HAS_OSNET = True
    print("[MODELS] OSNet (torchreid) loaded ✓", flush=True)
except Exception as e:
    print(f"[MODELS] OSNet not available: {e}", flush=True)


# ─────────────────────────────────────────────
# MediaPipe — Lightweight Person Detection Fallback
# ─────────────────────────────────────────────
HAS_MEDIAPIPE = False
mp_pose = None
try:
    import mediapipe as mp
    _mp = mp.solutions.pose
    mp_pose = _mp.Pose(
        static_image_mode=True,
        min_detection_confidence=0.5,
        model_complexity=0,
    )
    HAS_MEDIAPIPE = True
    print("[MODELS] MediaPipe Pose loaded ✓", flush=True)
except Exception as e:
    print(f"[MODELS] MediaPipe not available: {e}", flush=True)


# ─────────────────────────────────────────────
# PaddleOCR — License Plate Reading (Optional)
# ─────────────────────────────────────────────
HAS_PADDLEOCR = False
ocr_engine = None
try:
    from paddleocr import PaddleOCR
    ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    HAS_PADDLEOCR = True
    print("[MODELS] PaddleOCR loaded ✓", flush=True)
except Exception as e:
    print(f"[MODELS] PaddleOCR not available: {e}", flush=True)


# ─────────────────────────────────────────────
# Helper: OSNet Re-ID Feature Extraction
# ─────────────────────────────────────────────
def extract_person_features(img: np.ndarray, bbox: Tuple[int, int, int, int]) -> np.ndarray:
    """Extract appearance embedding for a person crop using OSNet."""
    if not HAS_OSNET or osnet is None:
        return np.zeros(512, dtype=np.float32)

    import torch
    x1, y1, x2, y2 = map(int, bbox)
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return np.zeros(512, dtype=np.float32)

    crop = cv2.resize(crop, (128, 256))
    crop = np.transpose(crop, (2, 0, 1)) / 255.0
    tensor = torch.tensor(crop, dtype=torch.float32).unsqueeze(0)

    with torch.no_grad():
        features = osnet(tensor)

    return features.numpy().flatten()


# ─────────────────────────────────────────────
# Core: Encode Reference Face
# ─────────────────────────────────────────────
def encode_face_from_image(img: np.ndarray) -> Optional[np.ndarray]:
    """
    Extract face embedding from a reference photo.
    Priority: InsightFace → face_recognition → None
    """
    if HAS_INSIGHTFACE and face_app is not None:
        try:
            faces = face_app.get(img)
            if faces:
                largest = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
                return largest.embedding
        except Exception as e:
            print(f"[MODELS] InsightFace encode error: {e}", flush=True)

    if HAS_FACE_RECOGNITION:
        try:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            locations = face_recognition.face_locations(rgb, model="hog")
            if locations:
                encodings = face_recognition.face_encodings(rgb, locations)
                if encodings:
                    return np.array(encodings[0], dtype=np.float32)
        except Exception as e:
            print(f"[MODELS] face_recognition encode error: {e}", flush=True)

    print("[MODELS] No face detected in reference image", flush=True)
    return None


# ─────────────────────────────────────────────
# Core: Process Frame — Person Detection + Matching
# Returns: (annotated_image, is_match, face_confidence, reid_confidence)
# ─────────────────────────────────────────────
def process_frame_for_person(
    img: np.ndarray,
    target_face_encoding: Optional[np.ndarray] = None,
    target_reid_encoding: Optional[np.ndarray] = None,
    face_threshold: float = 0.55,
    reid_threshold: float = 0.60,
) -> Tuple[np.ndarray, bool, float, float]:
    """
    Detect persons in frame and match against target embedding.

    Pipeline:
      1. YOLOv8 detects persons
      2. DeepSORT assigns track IDs (fallback: raw YOLO boxes)
      3. InsightFace / face_recognition matches face embedding
      4. OSNet matches body Re-ID embedding
      5. MediaPipe used as person presence fallback when YOLO unavailable

    Returns:
        (annotated_image, is_match, face_confidence, reid_confidence)
    """
    is_match    = False
    face_conf   = 0.0
    reid_conf   = 0.0

    # ── Step 1: YOLO detection ──────────────────────────
    if HAS_YOLO and yolo_model is not None:
        results = yolo_model(img, classes=[0], verbose=False)
    elif HAS_MEDIAPIPE and mp_pose is not None:
        # MediaPipe fallback: check if any person present
        rgb_frame = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        mp_result = mp_pose.process(rgb_frame)
        if mp_result.pose_landmarks:
            # Person detected — treat the whole frame as a bounding box
            h, w = img.shape[:2]
            if target_face_encoding is None:
                # Demo mode
                cv2.rectangle(img, (10, 10), (w - 10, h - 10), (0, 200, 100), 2)
                cv2.putText(img, "PERSON [MediaPipe]", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 100), 2)
                return img, True, 0.80, 0.0
        return img, False, 0.0, 0.0
    else:
        return img, False, 0.0, 0.0

    detections = []
    raw_boxes  = []

    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            detections.append(([x1, y1, x2 - x1, y2 - y1], conf, 0))
            raw_boxes.append((x1, y1, x2, y2, conf))

    # ── Step 2: DeepSORT tracking ───────────────────────
    if HAS_DEEPSORT and tracker is not None:
        try:
            tracks = tracker.update_tracks(detections, frame=img)
        except Exception:
            tracks = []

        for track in tracks:
            if not track.is_confirmed():
                continue

            track_id = track.track_id
            x1, y1, x2, y2 = map(int, track.to_ltrb())
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(img.shape[1], x2), min(img.shape[0], y2)

            local_face_sim = 0.0
            local_reid_sim = 0.0
            face_matched   = False

            # ── Step 3a: Face matching ──────────────────
            if target_face_encoding is not None:
                if HAS_INSIGHTFACE and face_app is not None:
                    try:
                        faces = face_app.get(img)
                        for face in faces:
                            fx, fy = int(face.bbox[0]), int(face.bbox[1])
                            if x1 <= fx <= x2 and y1 <= fy <= y2:
                                sim = 1.0 - cosine(target_face_encoding, face.embedding)
                                local_face_sim = max(local_face_sim, sim)
                                face_matched = True
                                break
                    except Exception as e:
                        print(f"[MODELS] InsightFace match error: {e}", flush=True)

                if not face_matched and HAS_FACE_RECOGNITION:
                    try:
                        crop = img[y1:y2, x1:x2]
                        if crop.size > 0:
                            rgb_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                            locs = face_recognition.face_locations(rgb_crop, model="hog")
                            if locs:
                                encs = face_recognition.face_encodings(rgb_crop, locs)
                                if encs and len(target_face_encoding) == len(encs[0]):
                                    dist = face_recognition.face_distance([target_face_encoding], encs[0])[0]
                                    local_face_sim = max(0.0, 1.0 - dist)
                    except Exception as e:
                        print(f"[MODELS] face_recognition match error: {e}", flush=True)

            # ── Step 3b: Re-ID matching ─────────────────
            if HAS_OSNET and target_reid_encoding is not None:
                try:
                    reid_feat = extract_person_features(img, (x1, y1, x2, y2))
                    if np.any(reid_feat):
                        local_reid_sim = max(0.0, 1.0 - cosine(target_reid_encoding, reid_feat))
                except Exception as e:
                    print(f"[MODELS] ReID match error: {e}", flush=True)

            # ── Step 4: Determine match ─────────────────
            if target_face_encoding is None and target_reid_encoding is None:
                # Demo mode
                is_match  = True
                face_conf = 0.85
                reid_conf = 0.0
                color     = (0, 200, 100)
                label     = f"ID:{track_id} [DEMO]"
            elif local_face_sim > face_threshold:
                if local_face_sim > face_conf:
                    is_match  = True
                    face_conf = local_face_sim
                    reid_conf = local_reid_sim
                color = (0, 0, 255)
                label = f"ID:{track_id} MATCH:{local_face_sim:.2f}"
            elif local_reid_sim > reid_threshold and target_reid_encoding is not None:
                if local_reid_sim * 0.6 > face_conf:
                    is_match  = True
                    face_conf = local_reid_sim * 0.6
                    reid_conf = local_reid_sim
                color = (0, 165, 255)
                label = f"ID:{track_id} ReID:{local_reid_sim:.2f}"
            else:
                color = (80, 80, 80)
                label = f"ID:{track_id}"

            cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
            cv2.putText(img, label, (x1, max(y1 - 10, 15)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

    else:
        # No DeepSORT — raw YOLO boxes
        for (x1, y1, x2, y2, conf) in raw_boxes:
            if target_face_encoding is None:
                is_match  = True
                face_conf = float(conf)
                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 200, 100), 2)
                cv2.putText(img, f"Person {conf:.2f}", (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 100), 2)

    return img, is_match, face_conf, reid_conf


# ─────────────────────────────────────────────
# Core: Process Frame — Vehicle Detection + OCR
# ─────────────────────────────────────────────
def process_frame_for_vehicle(
    img: np.ndarray,
    target_plate: Optional[str] = None,
) -> Tuple[np.ndarray, bool, float]:
    """
    Detect vehicles using YOLO. Optionally match license plate via PaddleOCR.
    Classes: 2=car, 3=motorcycle, 5=bus, 7=truck
    """
    detected   = False
    confidence = 0.0

    if not HAS_YOLO or yolo_model is None:
        return img, False, 0.0

    results = yolo_model(img, classes=[2, 3, 5, 7], verbose=False)

    vehicle_classes = {2: "Car", 3: "Motorcycle", 5: "Bus", 7: "Truck"}

    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf    = float(box.conf[0])
            cls_id  = int(box.cls[0])
            label   = vehicle_classes.get(cls_id, "Vehicle")

            # PaddleOCR license plate reading
            plate_text = ""
            if HAS_PADDLEOCR and ocr_engine is not None and target_plate:
                try:
                    crop = img[y1:y2, x1:x2]
                    if crop.size > 0:
                        ocr_result = ocr_engine.ocr(crop, cls=True)
                        if ocr_result and ocr_result[0]:
                            texts = [line[1][0] for line in ocr_result[0] if line[1][1] > 0.6]
                            plate_text = " ".join(texts).upper().replace(" ", "")
                            if target_plate.upper().replace(" ", "") in plate_text:
                                cv2.putText(img, f"PLATE MATCH: {plate_text}", (x1, y2 + 20),
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                except Exception as e:
                    print(f"[MODELS] PaddleOCR error: {e}", flush=True)

            display_label = f"{label} {conf:.2f}"
            if plate_text:
                display_label += f" | {plate_text}"

            cv2.rectangle(img, (x1, y1), (x2, y2), (255, 200, 0), 2)
            cv2.putText(img, display_label, (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 200, 0), 2)

            detected   = True
            confidence = max(confidence, conf)

    return img, detected, confidence
