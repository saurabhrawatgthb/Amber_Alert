#!/usr/bin/env python3
"""
tracker.py — Graph-Based Missing Child Finder v4.0
===================================================
Standalone CLI implementation of the graph-traversal tracking pipeline.

- Camera network: UNWEIGHTED directed adjacency list
- No lat/lon, no weights, no geolocation
- Traversal: DFS from start_camera_id
- Confidence: 0.5*face_match + 0.3*reid_match + 0.2*temporal_feasibility
- Timestamps: manually set in camera_metadata.json (USER_DEFINED = not configured)
- Video files: data/cameras/{id}.mp4

Usage:
    python tracker.py --start 1 --image child_photo.jpg
    python tracker.py --start 1 --demo
    python tracker.py --start 3 --image child.jpg --frame-skip 10
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
import numpy as np
import cv2

# ══════════════════════════════════════════════════════════════
# MODULE 1: DATA LOADING
# ══════════════════════════════════════════════════════════════

DEFAULT_CAMERA_METADATA = [
    {"camera_id": i, "label": f"Camera {i}",
     "video_path": f"data/cameras/{i}.mp4",
     "video_start_timestamp": "USER_DEFINED", "fps": 30, "duration_seconds": 120}
    for i in range(1, 16)
]

DEFAULT_CAMERA_GRAPH: Dict[str, List[str]] = {
    "1":  ["2", "3"],
    "2":  ["1"],
    "3":  ["1", "4", "5"],
    "4":  ["3", "6"],
    "5":  ["3", "6"],
    "6":  ["4", "5", "7"],
    "7":  ["6", "8", "9"],
    "8":  ["7"],
    "9":  ["7", "10", "11"],
    "10": ["9"],
    "11": ["9", "12", "13"],
    "12": ["11"],
    "13": ["11", "14", "15"],
    "14": ["13"],
    "15": ["13"],
}


def load_camera_metadata(path: str = "data/cameras/camera_metadata.json") -> List[Dict]:
    if os.path.exists(path):
        with open(path, "r") as f:
            print(f"[METADATA] Loaded: {path}")
            return json.load(f)
    print(f"[METADATA] Not found at '{path}' — using built-in defaults")
    return DEFAULT_CAMERA_METADATA


def load_camera_graph(path: str = "data/cameras/camera_graph.json") -> Dict[str, List[str]]:
    """
    Load unweighted adjacency list.
    JSON format: { "1": [2, 3], "3": [1, 4, 5], ... }
    All values normalised to string lists.
    """
    if os.path.exists(path):
        with open(path, "r") as f:
            raw = json.load(f)
            raw.pop("_comment", None)
            graph: Dict[str, List[str]] = {}
            for k, neighbors in raw.items():
                graph[str(k)] = [str(n) for n in neighbors]
            print(f"[GRAPH] Loaded: {path} ({len(graph)} nodes)")
            return graph
    print(f"[GRAPH] Not found at '{path}' — using built-in defaults")
    return DEFAULT_CAMERA_GRAPH


# ══════════════════════════════════════════════════════════════
# MODULE 2: TIMESTAMP ENGINE
# ══════════════════════════════════════════════════════════════

def frame_to_timestamp(start_time_iso: str, frame_number: int, fps: float) -> str:
    """real_timestamp = video_start_timestamp + (frame_number / fps)"""
    start_dt = datetime.fromisoformat(start_time_iso)
    return (start_dt + timedelta(seconds=frame_number / fps)).isoformat()


def resolve_start_ts(cam_meta: Dict) -> Optional[str]:
    ts = cam_meta.get("video_start_timestamp", "USER_DEFINED")
    if ts == "USER_DEFINED" or not ts:
        return None
    return ts


# ══════════════════════════════════════════════════════════════
# MODULE 3: TEMPORAL FEASIBILITY
# ══════════════════════════════════════════════════════════════

MIN_TRAVEL_SECONDS = 5
MAX_TRAVEL_SECONDS = 900


def temporal_feasibility_score(prev_ts: Optional[str], curr_ts: str) -> float:
    if prev_ts is None:
        return 1.0
    try:
        gap = (datetime.fromisoformat(curr_ts) - datetime.fromisoformat(prev_ts)).total_seconds()
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
    """Hard reject: curr must be strictly after prev."""
    if prev_ts is None:
        return True
    try:
        return datetime.fromisoformat(curr_ts) > datetime.fromisoformat(prev_ts)
    except Exception:
        return True


# ══════════════════════════════════════════════════════════════
# MODULE 4: GRAPH UTILITIES (Unweighted)
# ══════════════════════════════════════════════════════════════

def get_neighbors(
    graph: Dict[str, List[str]],
    cam_id: str,
    visited: set,
) -> List[str]:
    """Return unvisited adjacent camera IDs."""
    return [n for n in graph.get(cam_id, []) if n not in visited]


# ══════════════════════════════════════════════════════════════
# MODULE 5: FACE DETECTION + MATCHING
# ══════════════════════════════════════════════════════════════

HAS_INSIGHTFACE = False
HAS_FACE_RECOGNITION = False
HAS_YOLO = False
HAS_MEDIAPIPE = False
face_app = None
yolo_model = None
mp_pose = None

try:
    from ultralytics import YOLO
    yolo_model = YOLO("yolov8n.pt")
    HAS_YOLO = True
    print("[MODELS] YOLOv8 loaded ✓")
except Exception as e:
    print(f"[MODELS] YOLOv8 unavailable: {e}")

try:
    from insightface.app import FaceAnalysis
    face_app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    face_app.prepare(ctx_id=-1, det_size=(640, 640))
    HAS_INSIGHTFACE = True
    print("[MODELS] InsightFace loaded ✓")
except Exception as e:
    print(f"[MODELS] InsightFace not available: {e}")

try:
    import face_recognition as fr
    HAS_FACE_RECOGNITION = True
    print("[MODELS] face_recognition loaded ✓")
except ImportError:
    print("[MODELS] face_recognition not installed")

try:
    import mediapipe as mp
    _mp_pose = mp.solutions.pose
    mp_pose = _mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5, model_complexity=0)
    HAS_MEDIAPIPE = True
    print("[MODELS] MediaPipe loaded ✓")
except Exception as e:
    print(f"[MODELS] MediaPipe not available: {e}")


def encode_reference_face(image_path: str) -> Optional[np.ndarray]:
    img = cv2.imread(image_path)
    if img is None:
        print(f"[ENCODE] Cannot read: {image_path}")
        return None

    if HAS_INSIGHTFACE and face_app:
        try:
            faces = face_app.get(img)
            if faces:
                largest = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
                print(f"[ENCODE] InsightFace: {len(largest.embedding)}-dim embedding ✓")
                return largest.embedding
        except Exception as e:
            print(f"[ENCODE] InsightFace error: {e}")

    if HAS_FACE_RECOGNITION:
        try:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            locations = fr.face_locations(rgb, model="hog")
            if locations:
                encodings = fr.face_encodings(rgb, locations)
                if encodings:
                    print("[ENCODE] face_recognition: 128-dim embedding ✓")
                    return np.array(encodings[0], dtype=np.float32)
        except Exception as e:
            print(f"[ENCODE] face_recognition error: {e}")

    print("[ENCODE] No face detected")
    return None


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    from scipy.spatial.distance import cosine
    return 1.0 - float(cosine(a, b))


def match_face_in_frame(
    frame: np.ndarray,
    target_encoding: Optional[np.ndarray],
    threshold: float = 0.55,
) -> Tuple[float, float]:
    """
    Returns (face_confidence, reid_confidence).
    In demo mode (no target_encoding): returns simulated scores.
    """
    face_conf = 0.0
    reid_conf = 0.0

    if target_encoding is None:
        # Demo mode — check if any person is present
        if HAS_YOLO and yolo_model:
            results = yolo_model(frame, classes=[0], verbose=False)
            for r in results:
                if r.boxes:
                    return 0.85, 0.0
        elif HAS_MEDIAPIPE and mp_pose:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            res = mp_pose.process(rgb)
            if res.pose_landmarks:
                return 0.80, 0.0
        return 0.0, 0.0

    if HAS_INSIGHTFACE and face_app:
        try:
            faces = face_app.get(frame)
            for face in faces:
                sim = cosine_sim(target_encoding, face.embedding)
                if sim > threshold and sim > face_conf:
                    face_conf = sim
        except Exception as e:
            print(f"[MATCH] InsightFace error: {e}")

    if face_conf < threshold and HAS_FACE_RECOGNITION and len(target_encoding) == 128:
        try:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            locs = fr.face_locations(rgb, model="hog")
            if locs:
                for enc in fr.face_encodings(rgb, locs):
                    dist = fr.face_distance([target_encoding], enc)[0]
                    sim = max(0.0, 1.0 - dist)
                    if sim > threshold and sim > face_conf:
                        face_conf = sim
        except Exception as e:
            print(f"[MATCH] face_recognition error: {e}")

    return face_conf, reid_conf


# ══════════════════════════════════════════════════════════════
# MODULE 6: VIDEO SCANNER
# ══════════════════════════════════════════════════════════════

_scan_cache: Dict[str, Any] = {}


def scan_video(
    video_path: str,
    cam_meta: Dict,
    target_encoding: Optional[np.ndarray],
    frame_skip: int = 5,
    confidence_threshold: float = 0.55,
    prev_timestamp: Optional[str] = None,
) -> Optional[Dict]:
    """
    Scan video for target child.
    Confidence = 0.5*face + 0.3*reid + 0.2*temporal
    """
    cam_id   = str(cam_meta["camera_id"])
    start_ts = resolve_start_ts(cam_meta)
    fps      = float(cam_meta["fps"])

    if cam_id in _scan_cache:
        print(f"[CACHE] {cam_id}")
        return _scan_cache[cam_id]

    # Guard: timestamp must be configured
    if start_ts is None:
        print(f"[SKIP] Camera {cam_id}: video_start_timestamp not configured")
        _scan_cache[cam_id] = None
        return None

    if not os.path.exists(video_path):
        print(f"[DEMO] {video_path} not found — simulating")
        demo_frame = 150
        demo_ts    = frame_to_timestamp(start_ts, demo_frame, fps)

        if not is_temporally_valid(prev_timestamp, demo_ts):
            _scan_cache[cam_id] = None
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
            "demo_mode":    True,
        }
        _scan_cache[cam_id] = result
        return result

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open: {video_path}")
        return None

    video_fps    = cap.get(cv2.CAP_PROP_FPS) or fps
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"[SCAN] Camera {cam_id} | {total_frames} frames @ {video_fps:.1f}fps | skip={frame_skip}")

    frame_count = 0
    result      = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % frame_skip == 0:
            face_conf, reid_conf = match_face_in_frame(frame, target_encoding, confidence_threshold)

            if face_conf >= confidence_threshold:
                timestamp = frame_to_timestamp(start_ts, frame_count, video_fps)

                if not is_temporally_valid(prev_timestamp, timestamp):
                    frame_count += 1
                    continue

                temp_score = temporal_feasibility_score(prev_timestamp, timestamp)
                total_conf = round(
                    0.5 * face_conf + 0.3 * reid_conf + 0.2 * temp_score,
                    3,
                )
                print(f"[MATCH] ✓ Camera {cam_id} | frame={frame_count} | "
                      f"face={face_conf:.2f} reid={reid_conf:.2f} temp={temp_score:.2f} "
                      f"→ conf={total_conf:.3f} | ts={timestamp}")

                result = {
                    "matched":      True,
                    "camera_id":    cam_id,
                    "label":        cam_meta["label"],
                    "frame_number": frame_count,
                    "timestamp":    timestamp,
                    "confidence":   total_conf,
                    "demo_mode":    False,
                }
                break

        frame_count += 1

    cap.release()
    _scan_cache[cam_id] = result
    return result


# ══════════════════════════════════════════════════════════════
# MODULE 7: DFS TRACKING ENGINE
# ══════════════════════════════════════════════════════════════

def track_child(
    cameras: List[Dict],
    graph: Dict[str, List[str]],
    start_camera_id: int,
    target_encoding: Optional[np.ndarray],
    frame_skip: int = 5,
    max_cameras: int = 15,
) -> Tuple[List[Dict], int]:
    """
    DFS traversal from start_camera_id.

    Key rules:
      - Always expand ALL unvisited neighbours (regardless of match result)
      - Temporal regression → hard reject
      - No graph weights — pure adjacency traversal
      - Confidence = 0.5*face + 0.3*reid + 0.2*temporal
    """
    global _scan_cache
    _scan_cache = {}

    cam_map  = {str(c["camera_id"]): c for c in cameras}
    start_id = str(start_camera_id)

    if start_id not in cam_map:
        print(f"[ERROR] Start camera {start_id} not in metadata")
        return [], 0

    print(f"\n{'='*60}")
    print(f"  DFS GRAPH TRAVERSAL | Start: Camera {start_id}")
    print(f"  Graph nodes: {len(graph)}")
    print(f"{'='*60}\n")

    tracking_path:   List[Dict]     = []
    path_sequence:   List[str]      = []
    visited:         set            = set()
    cameras_scanned: int            = 0
    prev_timestamp:  Optional[str]  = None

    # Plain DFS stack (no weights)
    stack: List[str] = [start_id]

    while stack and cameras_scanned < max_cameras:
        current_id = stack.pop()

        if current_id in visited:
            continue
        visited.add(current_id)

        cam_meta = cam_map.get(current_id)
        if not cam_meta:
            print(f"[WARN] {current_id} not in metadata")
            continue

        print(f"[TRACK] ─── Camera {current_id}: {cam_meta['label']}")
        video_path = cam_meta["video_path"]

        result = scan_video(
            video_path=video_path,
            cam_meta=cam_meta,
            target_encoding=target_encoding,
            frame_skip=frame_skip,
            prev_timestamp=prev_timestamp,
        )
        cameras_scanned += 1

        if result and result.get("matched"):
            tracking_path.append({
                "camera_id":  result["camera_id"],
                "label":      result["label"],
                "timestamp":  result["timestamp"],
                "confidence": result["confidence"],
                "demo_mode":  result.get("demo_mode", False),
            })
            path_sequence.append(current_id)
            prev_timestamp = result["timestamp"]
            print(f"[TRACK] ✓ Camera {current_id} | conf={result['confidence']:.3f}")
        else:
            print(f"[TRACK] ✗ Camera {current_id}: No detection")

        # Always expand neighbours (DFS, unweighted)
        neighbours = get_neighbors(graph, current_id, visited)
        if neighbours:
            print(f"[TRACK]   → Neighbours: {neighbours}")
            for n in reversed(neighbours):
                stack.append(n)
        else:
            print(f"[TRACK]   → Terminal node")

    tracking_path.sort(key=lambda x: x["timestamp"])
    path_str = " → ".join(path_sequence)
    print(f"\n[TRACK] Done: {len(tracking_path)} detections / {cameras_scanned} cameras")
    print(f"[TRACK] Path: {path_str}")
    return tracking_path, cameras_scanned


# ══════════════════════════════════════════════════════════════
# MODULE 8: REPORT FORMATTER
# ══════════════════════════════════════════════════════════════

def format_report(tracking_path: List[Dict], cameras_scanned: int) -> Dict:
    timeline = []
    for i, hit in enumerate(tracking_path):
        ts = datetime.fromisoformat(hit["timestamp"]).strftime("%H:%M:%S")
        line = f"[{ts}] Camera {hit['camera_id']} — {hit['label']} (conf: {hit['confidence']*100:.1f}%)"
        if i > 0:
            gap = (datetime.fromisoformat(hit["timestamp"]) -
                   datetime.fromisoformat(tracking_path[i-1]["timestamp"])).total_seconds()
            line += f" | +{gap:.0f}s"
        if hit.get("demo_mode"):
            line += " [DEMO]"
        timeline.append(line)
    return {
        "tracking_path":     tracking_path,
        "movement_timeline": timeline,
        "summary": {
            "total_cameras_scanned": cameras_scanned,
            "total_matches":         len(tracking_path),
            "first_seen":            tracking_path[0]["timestamp"] if tracking_path else None,
            "last_seen":             tracking_path[-1]["timestamp"] if tracking_path else None,
        },
    }


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Amber Alert — Graph-Based Child Tracker v4.0",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tracker.py --start 1 --image child.jpg
  python tracker.py --start 1 --demo
  python tracker.py --start 3 --image child.jpg --frame-skip 10 --max-cameras 15
        """,
    )
    parser.add_argument("--image",       type=str,               help="Reference child photo")
    parser.add_argument("--start",       type=int, required=True, help="Start camera ID (1–15)")
    parser.add_argument("--metadata",    type=str, default="data/cameras/camera_metadata.json")
    parser.add_argument("--graph",       type=str, default="data/cameras/camera_graph.json")
    parser.add_argument("--frame-skip",  type=int, default=5)
    parser.add_argument("--max-cameras", type=int, default=15)
    parser.add_argument("--output",      type=str, default=None, help="Save results to JSON")
    parser.add_argument("--demo",        action="store_true",    help="Demo mode (no real videos needed)")

    args = parser.parse_args()

    print("=" * 60)
    print("  AMBER ALERT AI — GRAPH-BASED TRACKER v4.0")
    print("  Confidence: 0.5·face + 0.3·reid + 0.2·temporal")
    print("=" * 60)
    print(f"  Start Camera : {args.start}")
    print(f"  Reference    : {args.image or 'DEMO MODE'}")
    print(f"  Frame Skip   : every {args.frame_skip} frames")
    print(f"  Max Cameras  : {args.max_cameras}")
    print("=" * 60)

    cameras = load_camera_metadata(args.metadata)
    graph   = load_camera_graph(args.graph)

    print(f"\n[SYSTEM] {len(cameras)} cameras, {len(graph)} graph nodes")
    print("\n  GRAPH ADJACENCY:")
    for k, v in sorted(graph.items(), key=lambda x: int(x[0])):
        print(f"    Camera {k:>2} → [{', '.join(v)}]")

    target_encoding = None
    if args.image and not args.demo:
        print(f"\n[ENCODE] Processing: {args.image}")
        target_encoding = encode_reference_face(args.image)
        if target_encoding is None:
            print("[WARN] No face detected — DEMO MODE activated")

    tracking_path, cameras_scanned = track_child(
        cameras=cameras,
        graph=graph,
        start_camera_id=args.start,
        target_encoding=target_encoding,
        frame_skip=args.frame_skip,
        max_cameras=args.max_cameras,
    )

    report = format_report(tracking_path, cameras_scanned)

    print("\n" + "=" * 60)
    print("  TRACKING RESULTS")
    print("=" * 60)

    if tracking_path:
        path_str = " → ".join(str(h["camera_id"]) for h in tracking_path)
        print(f"\n  ✓ Path: {path_str}\n")
        print("  MOVEMENT TIMELINE:")
        for line in report["movement_timeline"]:
            print(f"    {line}")
    else:
        print("  ✗ Target not detected in any camera\n")

    output = {
        "status":        "SUCCESS" if tracking_path else "NOT_FOUND",
        "path_sequence": [h["camera_id"] for h in tracking_path],
        "tracking_path": [
            {
                "camera_id":  h["camera_id"],
                "label":      h["label"],
                "timestamp":  datetime.fromisoformat(h["timestamp"]).strftime("%H:%M:%S"),
                "confidence": h["confidence"],
                "demo_mode":  h.get("demo_mode", False),
            }
            for h in tracking_path
        ],
        "summary": report["summary"],
    }

    print("\n  STRUCTURED OUTPUT:")
    print(json.dumps(output, indent=2))

    if args.output:
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\n  [SAVED] → {args.output}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
