import { NextResponse } from 'next/server';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lat, lng, timeStr, imageEncodingBase64 } = body;
    
    // 1. Ask our cameras API to filter by spatial/temporal physics
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host") || "localhost:3000";
    const origin = `${protocol}://${host}`;

    const cameraRes = await fetch(`${origin}/api/cameras`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, timeStr, speedLimitKmph: 60 })
    });
    
    if (!cameraRes.ok) {
        throw new Error("Failed to filter cameras");
    }
    
    const cameraData = await cameraRes.json();
    const candidates = cameraData.cameras;
    
    if (!candidates || candidates.length === 0) {
        return NextResponse.json({ success: true, path: [], message: "No feasible cameras found." });
    }
    
    // 2. Call python AI backend in parallel for all feasible cameras
    console.log(`Executing Parallel Scans on ${candidates.length} cameras...`);
    const aiPromises = candidates.map(async (cam: any) => {
        const formData = new FormData();
        const absoluteVideoPath = `/app/${cam.video_path}`;
        
        formData.append("video_path", absoluteVideoPath);
        formData.append("fps_to_process", "1");
        formData.append("start_time", cam.start_time);
        if (imageEncodingBase64) {
            formData.append("target_encoding", imageEncodingBase64);
        }
        
        try {
            const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
            const res = await fetch(`${AI_URL}/scan-video`, {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            return { cam_id: cam.id, data, cam_meta: cam };
        } catch (e) {
            console.error("AI Service Error on", cam.id, e);
            return { cam_id: cam.id, error: true, cam_meta: cam };
        }
    });
    
    const aiResults = await Promise.all(aiPromises);
    
    // 3. Build chronological tracking path from successful hits
    const hitList: any[] = [];
    aiResults.forEach(result => {
        if (!result.error && result.data && result.data.matches && result.data.matches.length > 0) {
            // Find strongest match
            const bestMatch = result.data.matches.reduce((max: any, m: any) => m.confidence > max.confidence ? m : max, result.data.matches[0]);
            
            // Calculate exact world time
            const startTimeEpoch = new Date(result.cam_meta.start_time).getTime();
            const hitTimeEpoch = startTimeEpoch + (bestMatch.time_offset_sec * 1000);
            
            hitList.push({
                camera_id: result.cam_id,
                lat: result.cam_meta.lat,
                lng: result.cam_meta.lng,
                label: result.cam_meta.label,
                confidence: bestMatch.confidence,
                frame_base64: bestMatch.frame,
                timestamp: hitTimeEpoch
            });
        }
    });
    
    // Sort chronologically to build movement path
    hitList.sort((a, b) => a.timestamp - b.timestamp);
    
    return NextResponse.json({
        success: true,
        path: hitList,
        scannedCameras: candidates
    });

  } catch(err: any) {
    console.error(err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
