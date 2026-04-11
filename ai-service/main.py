"""
Amber Alert AI Service — Graph-Based Video Intelligence Pipeline v4.0
=====================================================================
FastAPI service implementing:
  - /encode-face  : Extract face embedding from reference image
  - /scan-video   : Scan a single video for a target face/person
  - /track-child  : Full graph-traversal tracking pipeline (BFS/DFS)
  - /scan-vehicle : Vehicle + license plate detection
  - /health       : Service health check
  - /camera-graph : Return camera graph for frontend visualization

Architecture:
  - Camera network = UNWEIGHTED DIRECTED GRAPH (plain adjacency list)
  - No geolocation. No lat/lon. No weights.
  - Traversal: DFS from start node; ALWAYS expands all neighbours
  - Confidence: 0.5*face_match + 0.3*reid_match + 0.2*temporal_feasibility
  - Temporal feasibility: reject timestamp regression; penalise impossible gaps
  - Video timestamps: manually set per-camera in camera_metadata.json
"""

import base64
import json
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import (
    encode_face_from_image,
    process_frame_for_person,
    process_frame_for_vehicle,
    HAS_INSIGHTFACE,
    HAS_DEEPSORT,
    HAS_OSNET,
)

# ─────────────────────────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="Amber Alert AI Service",
    description="Graph-based child tracking via CCTV video intelligence",
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
# Data Paths
# ─────────────────────────────────────────────────────────────
DATA_ROOT     = os.environ.get("DATA_ROOT", "/app/data/cameras")
METADATA_PATH = os.path.join(DATA_ROOT, "camera_metadata.json")
GRAPH_PATH    = os.path.join(DATA_ROOT, "camera_graph.json")

# Per-session scan cache: { camera_id -> scan_result }
_scan_cache: Dict[str, Any] = {}


# ─────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────

def encode_image_b64(img: np.ndarray) -> str:
    """Encode OpenCV BGR image to base64 JPEG string."""
    _, buffer = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return base64.b64encode(buffer).decode("utf-8")


def frame_to_timestamp(start_time_iso: str, frame_number: int, fps: float) -> str:
    """
    real_timestamp = video_start_timestamp + (frame_number / fps)
    """
    start_dt = datetime.fromisoformat(start_time_iso)
    return (start_dt + timedelta(seconds=frame_number / fps)).isoformat()


def parse_iso(ts: str) -> datetime:
    return datetime.fromisoformat(ts)


# ─────────────────────────────────────────────────────────────
# Metadata Loader — Unweighted Graph
# ─────────────────────────────────────────────────────────────

def load_metadata() -> Tuple[List[Dict], Dict[str, List[str]]]:
    """
    Load camera metadata and UNWEIGHTED camera graph.

    Graph format in camera_graph.json:
        { "1": [2, 3], "3": [1, 4, 5], ... }

    Returns:
        cameras: list of camera metadata dicts
        graph:   { "1": ["2", "3"], "3": ["1", "4", "5"], ... }
                 (all values normalised to strings)
    """
    if not os.path.exists(METADATA_PATH):
        raise FileNotFoundError(f"Camera metadata not found: {METADATA_PATH}")
    if not os.path.exists(GRAPH_PATH):
        raise FileNotFoundError(f"Camera graph not found: {GRAPH_PATH}")

    with open(METADATA_PATH, "r") as f:
        cameras = json.load(f)

    with open(GRAPH_PATH, "r") as f:
        raw_graph = json.load(f)

    # Strip comment key
    raw_graph.pop("_comment", None)

    # Normalise: all keys and neighbour IDs are strings
    graph: Dict[str, List[str]] = {}
    for k, neighbors in raw_graph.items():
        graph[str(k)] = [str(n) for n in neighbors]

    return cameras, graph


# ─────────────────────────────────────────────────────────────
# Graph Utilities — Unweighted
# ─────────────────────────────────────────────────────────────

def get_neighbors(
    graph: Dict[str, List[str]],
    cam_id: str,
    visited: set,
) -> List[str]:
    """Return unvisited adjacent camera IDs. Order is preserved from graph file."""
    return [n for n in graph.get(cam_id, []) if n not in visited]


# ─────────────────────────────────────────────────────────────
# Temporal Feasibility
# ─────────────────────────────────────────────────────────────

MIN_TRAVEL_SECONDS = 5
MAX_TRAVEL_SECONDS = 900


def temporal_feasibility_score(prev_ts: Optional[str], curr_ts: str) -> float:
    """
    Score [0.0 – 1.0] representing how physically plausible the timestamp gap is.

      - No prev (starting node)     → 1.0
      - curr <= prev (regression)   → 0.0  (will be rejected by is_valid)
      - gap < MIN_TRAVEL             → 0.3  (suspiciously fast)
      - MIN <= gap <= MAX            → 1.0  (feasible)
      - gap > MAX                    → 0.5  (stale but not impossible)
    """
    if prev_ts is None:
        return 1.0
    try:
        gap = (parse_iso(curr_ts) - parse_iso(prev_ts)).total_seconds()
        if gap <= 0:
            return 0.0
        if gap < MIN_TRAVEL_SECONDS:
            return 0.3
        if gap <= MAX_TRAVEL_SECONDS:
            return 1.0
        return 0.5
    except Exception:
        return 0.5


def is_temporally_valid(prev_ts: Optional[str], curr_ts: str) -> bool:
    """Hard reject: curr timestamp must be strictly after prev."""
    if prev_ts is None:
        return True
    try:
        return parse_iso(curr_ts) > parse_iso(prev_ts)
    except Exception:
        return True


# ─────────────────────────────────────────────────────────────
# Timestamp Validation Helper
# ─────────────────────────────────────────────────────────────

def resolve_start_ts(cam_meta: Dict) -> Optional[str]:
    """
    Return the video_start_timestamp if it has been set by the user.
    Returns None if still set to the placeholder 'USER_DEFINED'.
    """
    ts = cam_meta.get("video_start_timestamp", "USER_DEFINED")
    if ts == "USER_DEFINED" or not ts:
        return None
    return ts


# ─────────────────────────────────────────────────────────────
# Video Scanner
# ─────────────────────────────────────────────────────────────

def scan_video_for_target(
    video_path: str,
    cam_meta: Dict,
    target_face_encoding: Optional[np.ndarray],
    frame_skip: int = 5,
    prev_timestamp: Optional[str] = None,
) -> Optional[Dict]:
    """
    Scan a single camera's video footage for the target person.

    Confidence formula:
        confidence = 0.5 * face_match
                   + 0.3 * reid_match
                   + 0.2 * temporal_feasibility

    Returns:
        Match dict or None if not found.
    """
    cam_id    = str(cam_meta["camera_id"])
    cache_key = cam_id
    start_ts  = resolve_start_ts(cam_meta)
    fps       = float(cam_meta["fps"])

    # Cache hit
    if cache_key in _scan_cache:
        print(f"[CACHE] {cam_id}", flush=True)
        return _scan_cache[cache_key]

    # Guard: timestamp must be configured
    if start_ts is None:
        print(f"[SKIP] Camera {cam_id}: video_start_timestamp is USER_DEFINED — set it first", flush=True)
        _scan_cache[cache_key] = None
        return None

    # Demo mode: video file does not exist
    if not os.path.exists(video_path):
        print(f"[DEMO] {cam_id}: {video_path} not found — simulating detection", flush=True)
        demo_frame = 150
        demo_ts    = frame_to_timestamp(start_ts, demo_frame, fps)

        if not is_temporally_valid(prev_timestamp, demo_ts):
            print(f"[TEMPORAL] Rejected {cam_id}: timestamp regression", flush=True)
            _scan_cache[cache_key] = None
            return None

        temp_score = temporal_feasibility_score(prev_timestamp, demo_ts)
        face_score = round(0.72 + (hash(cam_id) % 20) / 100, 2)
        total_conf = round(0.5 * face_score + 0.3 * 0.0 + 0.2 * temp_score, 3)

        result = {
            "matched":      True,
            "camera_id":    cam_id,
            "label":        cam_meta["label"],
            "frame_number": demo_frame,
            "timestamp":    demo_ts,
            "confidence":   total_conf,
            "frame_b64":    None,
            "demo_mode":    True,
        }
        _scan_cache[cache_key] = result
        return result

    # Real video scanning
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open: {video_path}", flush=True)
        _scan_cache[cache_key] = None
        return None

    video_fps   = cap.get(cv2.CAP_PROP_FPS) or fps
    frame_count = 0
    best_match  = None

    print(f"[SCAN] Camera {cam_id} | {video_path} | skip={frame_skip}", flush=True)

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % frame_skip == 0:
            result_img, is_match, raw_face_conf, raw_reid_conf = process_frame_for_person(
                frame,
                target_face_encoding=target_face_encoding,
                target_reid_encoding=None,
            )

            if is_match and raw_face_conf > 0.55:
                timestamp = frame_to_timestamp(start_ts, frame_count, video_fps)

                if not is_temporally_valid(prev_timestamp, timestamp):
                    print(f"[TEMPORAL] Skipped frame {frame_count}: timestamp regression", flush=True)
                    frame_count += 1
                    continue

                temp_score = temporal_feasibility_score(prev_timestamp, timestamp)
                total_conf = round(
                    0.5 * raw_face_conf
                    + 0.3 * raw_reid_conf
                    + 0.2 * temp_score,
                    3,
                )

                print(
                    f"[MATCH] Camera {cam_id} | frame={frame_count} | "
                    f"face={raw_face_conf:.2f} reid={raw_reid_conf:.2f} "
                    f"temp={temp_score:.2f} → conf={total_conf:.3f}",
                    flush=True,
                )

                best_match = {
                    "matched":      True,
                    "camera_id":    cam_id,
                    "label":        cam_meta["label"],
                    "frame_number": frame_count,
                    "timestamp":    timestamp,
                    "confidence":   total_conf,
                    "frame_b64":    encode_image_b64(result_img),
                    "demo_mode":    False,
                }
                break  # Early exit on first strong match

        frame_count += 1

    cap.release()
    _scan_cache[cache_key] = best_match
    return best_match


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Service health check with model availability."""
    return {
        "status":  "ok",
        "version": "4.0.0",
        "models": {
            "insightface": HAS_INSIGHTFACE,
            "deepsort":    HAS_DEEPSORT,
            "osnet":       HAS_OSNET,
        },
        "data_root":       DATA_ROOT,
        "metadata_exists": os.path.exists(METADATA_PATH),
        "graph_exists":    os.path.exists(GRAPH_PATH),
    }


@app.get("/camera-graph")
def get_camera_graph():
    """Return camera metadata + unweighted graph for frontend visualization."""
    try:
        cameras, graph = load_metadata()
        return JSONResponse({"status": "ok", "cameras": cameras, "graph": graph})
    except FileNotFoundError as e:
        return JSONResponse({"status": "ERROR", "message": str(e)}, status_code=500)


@app.post("/encode-face")
async def encode_face(image: UploadFile = File(...)):
    """
    Encode a reference face image into a feature embedding vector.
    Returns { encoding: [floats], dimensions: N }
    """
    try:
        image_bytes = await image.read()
        img_array   = np.frombuffer(image_bytes, np.uint8)
        img         = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        encoding = encode_face_from_image(img)

        if encoding is None:
            return JSONResponse({
                "status":  "NO_FACE",
                "message": "No face detected. Use a clear frontal photo.",
            }, status_code=422)

        return JSONResponse({
            "status":     "SUCCESS",
            "encoding":   encoding.tolist(),
            "dimensions": len(encoding),
        })

    except Exception as e:
        return JSONResponse({"status": "ERROR", "message": str(e)}, status_code=500)


@app.post("/scan-video")
async def scan_video_endpoint(
    video_path:      str = Form(...),
    fps_to_process:  int = Form(1),
    start_time:      str = Form(""),
    target_encoding: str = Form(None),
):
    """Scan a single video for a target face/person."""
    face_encoding = None
    if target_encoding:
        try:
            face_encoding = np.array(json.loads(target_encoding), dtype=np.float32)
        except Exception as e:
            print(f"[WARN] Could not decode target_encoding: {e}", flush=True)

    cap        = cv2.VideoCapture(video_path) if os.path.exists(video_path) else None
    video_fps  = 25.0
    frame_count = 0
    matches: List[Dict] = []

    if cap and cap.isOpened():
        video_fps      = cap.get(cv2.CAP_PROP_FPS) or 25.0
        frame_interval = max(1, int(video_fps / fps_to_process))

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_count % frame_interval == 0:
                result_img, is_match, face_conf, reid_conf = process_frame_for_person(
                    frame,
                    target_face_encoding=face_encoding,
                    target_reid_encoding=None,
                )
                if is_match:
                    matches.append({
                        "status":          "MATCH",
                        "confidence":      round(face_conf, 3),
                        "time_offset_sec": frame_count / video_fps,
                        "frame":           encode_image_b64(result_img),
                    })
                    if len(matches) > 3:
                        break

            frame_count += 1

        cap.release()

    return JSONResponse({
        "status":        "SUCCESS",
        "video":         video_path,
        "total_matches": len(matches),
        "matches":       matches,
    })


# ─────────────────────────────────────────────────────────────
# /track-child — Graph-Traversal Pipeline
# ─────────────────────────────────────────────────────────────

class TrackChildRequest(BaseModel):
    """Request body for the full graph-based tracking pipeline."""
    reference_encoding: Optional[List[float]] = None  # face embedding
    start_camera_id:    int = 1                        # starting graph node
    last_known_time:    str = ""                       # ISO timestamp (optional)
    frame_skip:         int = 5                        # process every Nth frame
    max_cameras:        int = 15                       # safety cap on DFS depth


@app.post("/track-child")
async def track_child(req: TrackChildRequest):
    """
    Full graph-based sequential tracking pipeline.

    Algorithm (DFS, unweighted):
      1. Load camera graph (plain adjacency list) + metadata
      2. Start DFS stack at start_camera_id
      3. Pop camera → scan video → record match if found
      4. ALWAYS push all unvisited graph neighbours onto stack
         (traversal follows topology regardless of match result)
      5. Validate temporal feasibility for every candidate timestamp
      6. Confidence = 0.5*face + 0.3*reid + 0.2*temporal
      7. Return chronologically sorted detection path

    Response:
        {
          "status": "SUCCESS",
          "tracking_path": [...],
          "path_sequence": [1, 3, 4, 6, ...],
          "cameras_scanned": N,
          "total_detections": M
        }
    """
    global _scan_cache
    _scan_cache = {}  # Fresh session for each tracking request

    try:
        cameras, graph = load_metadata()
    except FileNotFoundError as e:
        return JSONResponse({"status": "ERROR", "message": str(e)}, status_code=500)

    # Build lookup: "1" -> metadata dict
    cam_map: Dict[str, Dict] = {str(c["camera_id"]): c for c in cameras}

    # Decode face encoding
    face_encoding: Optional[np.ndarray] = None
    if req.reference_encoding:
        face_encoding = np.array(req.reference_encoding, dtype=np.float32)
        print(f"[TRACK] Face encoding loaded: {len(req.reference_encoding)} dims", flush=True)
    else:
        print("[TRACK] No face encoding — DEMO MODE", flush=True)

    start_id = str(req.start_camera_id)
    if start_id not in cam_map:
        return JSONResponse({
            "status":  "ERROR",
            "message": f"Start camera '{start_id}' not found in metadata",
        }, status_code=400)

    print(f"[TRACK] Start node: Camera {start_id}", flush=True)
    print(f"[TRACK] Graph nodes: {len(graph)} | DFS traversal", flush=True)

    tracking_path:   List[Dict]     = []
    path_sequence:   List[int]      = []
    visited:         set            = set()
    cameras_scanned: int            = 0
    prev_timestamp:  Optional[str]  = req.last_known_time or None

    # DFS stack: plain list of camera ID strings
    stack: List[str] = [start_id]

    while stack and cameras_scanned < req.max_cameras:
        current_id = stack.pop()

        if current_id in visited:
            continue
        visited.add(current_id)

        cam_meta = cam_map.get(current_id)
        if not cam_meta:
            print(f"[WARN] Camera {current_id} not in metadata", flush=True)
            continue

        video_path = f"/app/data/cameras/{current_id}.mp4"
        print(f"\n[TRACK] ─── Camera {current_id}: {cam_meta['label']}", flush=True)

        result = scan_video_for_target(
            video_path=video_path,
            cam_meta=cam_meta,
            target_face_encoding=face_encoding,
            frame_skip=req.frame_skip,
            prev_timestamp=prev_timestamp,
        )
        cameras_scanned += 1

        if result and result.get("matched"):
            print(f"[TRACK] ✓ Camera {current_id} | conf={result['confidence']:.3f}", flush=True)
            tracking_path.append({
                "camera_id":  result["camera_id"],
                "label":      result["label"],
                "timestamp":  result["timestamp"],
                "confidence": result["confidence"],
                "frame_b64":  result.get("frame_b64"),
                "demo_mode":  result.get("demo_mode", False),
            })
            path_sequence.append(int(current_id))
            prev_timestamp = result["timestamp"]
        else:
            print(f"[TRACK] ✗ Camera {current_id}: No detection", flush=True)

        # ALWAYS expand neighbours (unweighted DFS)
        neighbours = get_neighbors(graph, current_id, visited)
        if neighbours:
            print(f"[TRACK]   Neighbours of {current_id}: {neighbours}", flush=True)
            # Push reversed so first neighbour in list is processed first
            for n in reversed(neighbours):
                stack.append(n)
        else:
            print(f"[TRACK]   Camera {current_id}: terminal node", flush=True)

    # Sort results chronologically
    tracking_path.sort(key=lambda x: x["timestamp"])

    path_str = " → ".join(str(p) for p in path_sequence)
    print(f"\n[TRACK] Done: {len(tracking_path)} detections / {cameras_scanned} cameras", flush=True)
    print(f"[TRACK] Path: {path_str}", flush=True)

    return JSONResponse({
        "status":           "SUCCESS",
        "tracking_path":    tracking_path,
        "path_sequence":    path_sequence,
        "cameras_scanned":  cameras_scanned,
        "total_detections": len(tracking_path),
        "message":          f"Path: {path_str}" if path_str else "No detections",
    })


# ─────────────────────────────────────────────────────────────
# /scan-vehicle
# ─────────────────────────────────────────────────────────────

@app.post("/scan-vehicle")
async def scan_vehicle(
    video_path:     str = Form(...),
    fps_to_process: int = Form(1),
    start_time:     str = Form(""),
    target_plate:   str = Form(None),
):
    """Vehicle detection via YOLO + PaddleOCR across video frames."""
    if not os.path.exists(video_path):
        return JSONResponse({
            "status":  "ERROR",
            "message": f"File not found: {video_path}",
        }, status_code=404)

    cap        = cv2.VideoCapture(video_path)
    video_fps  = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_interval = max(1, int(video_fps / fps_to_process))
    frame_count    = 0
    matches: List[Dict] = []

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % frame_interval == 0:
            result_img, is_match, max_conf = process_frame_for_vehicle(frame, target_plate)
            if is_match:
                matches.append({
                    "status":          "MATCH",
                    "confidence":      round(max_conf, 3),
                    "time_offset_sec": frame_count / video_fps,
                    "frame":           encode_image_b64(result_img),
                })
                if len(matches) > 3:
                    break

        frame_count += 1

    cap.release()

    return JSONResponse({
        "status":        "SUCCESS",
        "video":         video_path,
        "total_matches": len(matches),
        "matches":       matches,
    })
