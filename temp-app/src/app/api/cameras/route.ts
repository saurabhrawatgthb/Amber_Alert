import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/cameras
 * 
 * Returns the full camera network graph and metadata for frontend visualization.
 * Called on page load to immediately render all 15 nodes in "pending" state
 * before any tracking begins.
 * 
 * Response:
 * {
 *   graph:    { "1": [2, 3], "3": [1, 4, 5], ... }   ← unweighted adjacency list
 *   cameras:  [{ camera_id, label, timestamp_set }, ...] ← 15 cameras
 * }
 */
export async function GET() {
  try {
    const dataRoot    = path.join(process.cwd(), '..', 'data', 'cameras');
    const graphPath   = path.join(dataRoot, 'camera_graph.json');
    const metaPath    = path.join(dataRoot, 'camera_metadata.json');

    // ── Load graph ──────────────────────────────────────────────
    let graph: Record<string, number[]> = {};
    if (fs.existsSync(graphPath)) {
      const raw = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
      delete raw['_comment'];
      // Normalise values to number arrays
      for (const [k, v] of Object.entries(raw)) {
        graph[k] = (v as any[]).map(Number);
      }
    } else {
      // Fallback: built-in 15-node graph (matches specification exactly)
      graph = {
        "1":  [2, 3],  "2":  [1],          "3":  [1, 4, 5],
        "4":  [3, 6],  "5":  [3, 6],       "6":  [4, 5, 7],
        "7":  [6, 8, 9], "8": [7],          "9":  [7, 10, 11],
        "10": [9],     "11": [9, 12, 13],   "12": [11],
        "13": [11, 14, 15], "14": [13],     "15": [13],
      };
    }

    // ── Load camera metadata ─────────────────────────────────────
    let cameras: any[] = [];
    if (fs.existsSync(metaPath)) {
      const raw: any[] = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      cameras = raw.map(c => ({
        id:            String(c.camera_id),
        label:         c.label || `Camera ${c.camera_id}`,
        timestamp_set: c.video_start_timestamp !== 'USER_DEFINED' && !!c.video_start_timestamp,
        fps:           c.fps || 30,
      }));
    } else {
      // Fallback: generate 15 camera stubs
      cameras = Array.from({ length: 15 }, (_, i) => ({
        id:            String(i + 1),
        label:         `Camera ${i + 1}`,
        timestamp_set: false,
        fps:           30,
      }));
    }

    return NextResponse.json({
      success:    true,
      graph,
      cameras,
      node_count: Object.keys(graph).length,
      edge_count: Object.values(graph).reduce((s, v) => s + v.length, 0),
    });

  } catch (err: any) {
    console.error('[CAMERAS] Error loading camera network:', err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
