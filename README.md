# Amber Alert AI: Graph-Based Missing Child Tracking System

A professional-grade, intelligent surveillance system that transitions from legacy geolocation models to a modern **Graph-Based Camera Network**. The system uses spatio-temporal video intelligence to track targets across a network of 15 connected CCTV cameras.

## 🚨 Core Architecture: The Camera Graph

The system models the surveillance environment as a mathematical graph:
- **Nodes:** Each camera (1–15) is a node in the network.
- **Edges:** Possible movement paths between cameras are defined in an unweighted adjacency list.
- **Traversal:** The AI uses **Depth-First Search (DFS)** to intelligently predict and scan the next camera in the sequence based on the graph's topology.

### Camera Network Topology
The system uses the following fixed adjacency list (defined in `data/cameras/camera_graph.json`):
```json
{
  "1":  [2, 3], "2":  [1], "3":  [1, 4, 5],
  "4":  [3, 6], "5":  [3, 6], "6":  [4, 5, 7],
  "7":  [6, 8, 9], "8": [7], "9":  [7, 10, 11],
  "10": [9], "11": [9, 12, 13], "12": [11],
  "13": [11, 14, 15], "14": [13], "15": [13]
}
```

---

## 📁 Data Structure & Storage

### Camera Footage
Footage is stored numerically in `/data/cameras/`:
- `1.mp4`, `2.mp4`, ..., `15.mp4`
- Filenames correspond directly to Camera/Node IDs.

### Camera Metadata (`camera_metadata.json`)
The system consumes manually defined timestamps to synchronize video frames with real-world time.
```json
{
  "camera_id": 1,
  "video_path": "data/cameras/1.mp4",
  "video_start_timestamp": "2026-04-11T10:00:00",
  "fps": 30,
  "duration_seconds": 120
}
```
> [!IMPORTANT]
> The system requires `video_start_timestamp` to be set. If left as `USER_DEFINED`, that camera will be skipped during traversal.

---

## 🧠 Intelligence Engine

### 👤 Human Tracking Stack
The AI Service (`ai-service`) utilizes a multi-stage pipeline:
1.  **Detection:** YOLOv8 (Ultralytics) for person detection.
2.  **Face Recognition:** InsightFace for deep feature extraction.
3.  **Body ReID:** OSNet (torchreid) for person re-identification when faces are obscured.
4.  **Fallback:** MediaPipe and DeepSORT for resilient tracking.

### 🚗 Vehicle Tracking Stack
1.  **Detection:** YOLOv8 Vehicle Detection.
2.  **Recognition:** PaddleOCR for high-accuracy license plate extraction.

### 📊 Confidence Calculation
The composite confidence score is calculated as:
**`Score = 0.5 * Face_Match + 0.3 * ReID_Match + 0.2 * Temporal_Feasibility`**

### ⏱️ Temporal Validation
Transitions between Camera A and Camera B are strictly validated:
- **Regression Check:** If `timestamp_B < timestamp_A`, the detection is rejected.
- **Feasibility:** Gaps too small or too large significantly reduce the temporal confidence component.

---

## 🎨 Tactical Frontend (React Flow)

The dashboard replaces maps with a **Live Graph Visualization**:
- **MATCH:** Green Node
- **SCANNING:** Yellow Node (Animated)
- **CLEAR:** Grey Node
- **PATH:** Animated paths showing the target's trajectory (e.g., `1 → 3 → 6 → 7 → 9`).

---

## 🚀 Getting Started

### 1. Requirements
- Docker & Docker Compose
- Node.js 18+
- Python 3.10+ (for local AI development)

### 2. Setup Camera Data
1. Place your `.mp4` files in `/data/cameras/` named `1.mp4` to `15.mp4`.
2. Edit `/data/cameras/camera_metadata.json` and set the `video_start_timestamp` for your footage.

### 3. Start the Services
**Next.js Frontend & API:**
```bash
cd temp-app
npm install
npm run dev
```

**AI Service (Docker):**
```bash
docker-compose up --build
```

---

## 🛠️ Tech Stack
- **Frontend:** Next.js, React Flow, Tailwind CSS, Framer Motion.
- **Backend:** Node.js (Orchestrator), FastAPI (AI Service).
- **ML/CV:** YOLOv8, InsightFace, PaddleOCR, OSNet, MediaPipe.
- **Database:** JSON-based persistent storage for camera metadata and graphs.
