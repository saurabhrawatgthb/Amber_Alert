import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface CameraMetadata {
  camera_id: number;
  label: string;
  video_path: string;
  video_start_timestamp: string;  // "USER_DEFINED" or ISO string set by user
  fps: number;
  duration_seconds: number;
}

interface TrackingHit {
  camera_id: string;
  label: string;
  timestamp: string;
  confidence: number;
  frame_b64: string | null;
  demo_mode: boolean;
}

// ─────────────────────────────────────────────
// POST /api/orchestrator
// ─────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      startCameraId,      // integer — start graph node
      timeStr,            // ISO timestamp of last sighting (optional)
      imageBase64,        // base64 face image
      referenceEncoding,  // pre-encoded face vector
    } = body;

    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

    // ── Step 1: Encode face if image provided ──
    let faceEncoding: number[] | null = referenceEncoding || null;

    if (imageBase64 && !faceEncoding) {
      try {
        console.log('[ORCHESTRATOR] Encoding reference face...');
        const imageBuffer = Buffer.from(
          imageBase64.replace(/^data:image\/\w+;base64,/, ''),
          'base64'
        );
        const formData = new FormData();
        formData.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), 'ref.jpg');

        const encRes = await fetch(`${AI_URL}/encode-face`, { method: 'POST', body: formData });
        if (encRes.ok) {
          const encData = await encRes.json();
          if (encData.status === 'SUCCESS' && encData.encoding) {
            faceEncoding = encData.encoding;
            console.log(`[ORCHESTRATOR] Face encoded: ${encData.dimensions} dims`);
          } else {
            console.warn('[ORCHESTRATOR] Encode warning:', encData.message);
          }
        }
      } catch (e) {
        console.warn('[ORCHESTRATOR] Face encoding failed — demo mode:', e);
      }
    }

    // ── Step 2: Call /track-child — Graph DFS traversal ──
    console.log(`[ORCHESTRATOR] Tracking from camera ${startCameraId}...`);

    const trackRes = await fetch(`${AI_URL}/track-child`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference_encoding: faceEncoding,
        start_camera_id:    startCameraId || 1,
        last_known_time:    timeStr || '',
        frame_skip:         5,
        max_cameras:        15,
      }),
    });

    if (!trackRes.ok) {
      throw new Error(`AI tracking service returned ${trackRes.status}`);
    }

    const trackData = await trackRes.json();

    if (trackData.status !== 'SUCCESS') {
      return NextResponse.json({
        success: false,
        message: trackData.message || 'Tracking failed',
      });
    }

    // ── Step 3: Load camera graph + metadata for frontend ──
    // Graph format: { "1": [2, 3], "3": [1, 4, 5], ... } — plain integer arrays
    let cameraGraph: Record<string, number[]> = {};
    let allCameras: CameraMetadata[] = [];

    try {
      const graphPath    = path.join(process.cwd(), '..', 'data', 'cameras', 'camera_graph.json');
      const metadataPath = path.join(process.cwd(), '..', 'data', 'cameras', 'camera_metadata.json');

      if (fs.existsSync(graphPath)) {
        const raw = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
        delete raw['_comment'];
        // Normalise: ensure values are number arrays
        for (const [k, v] of Object.entries(raw)) {
          cameraGraph[k] = (v as any[]).map(Number);
        }
      }

      if (fs.existsSync(metadataPath)) {
        allCameras = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      }
    } catch (metaErr) {
      console.warn('[ORCHESTRATOR] Could not load metadata:', metaErr);
    }

    // ── Step 4: Format response ──
    const trackingPath: TrackingHit[] = trackData.tracking_path || [];
    const pathSequence: number[]      = trackData.path_sequence  || [];
    const matchedIds = new Set(trackingPath.map((h) => String(h.camera_id)));

    return NextResponse.json({
      success:          true,
      tracking_path:    trackingPath,
      path_sequence:    pathSequence,
      cameras_scanned:  trackData.cameras_scanned,
      total_detections: trackData.total_detections,
      message:          trackData.message,
      camera_graph:     cameraGraph,
      all_cameras:      allCameras.map((c) => ({
        id:     String(c.camera_id),
        label:  c.label,
        status: matchedIds.has(String(c.camera_id)) ? 'matched' : 'scanned',
        timestamp_set: c.video_start_timestamp !== 'USER_DEFINED',
      })),
    });

  } catch (err: any) {
    console.error('[ORCHESTRATOR] Fatal:', err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
