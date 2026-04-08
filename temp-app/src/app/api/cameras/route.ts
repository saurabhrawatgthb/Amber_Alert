import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Haversine formula
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180)
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lat, lng, timeStr, speedLimitKmph = 60 } = body;
    
    // Parse Real Metadata - Try multiple paths to support Vercel and Local
    let metadataPath = path.join(process.cwd(), '..', 'data', 'cameras', 'camera_metadata.json');
    if (!fs.existsSync(metadataPath)) {
        metadataPath = path.join(process.cwd(), 'data', 'cameras', 'camera_metadata.json');
    }
    
    let cameras = [];
    if (!fs.existsSync(metadataPath)) {
        // Fallback for Vercel if data dir is lost
        console.warn("No real camera metadata found, using inline fallback");
        cameras = [
          {
            "camera_id": "cam_1",
            "video_path": "data/cameras/cam_1.mp4",
            "location": { "lat": 28.6100, "lon": 77.2000 },
            "area_name": "Connaught Place Junction",
            "fps": 30,
            "start_time": "2026-04-08T10:00:00",
            "end_time": "2026-04-08T10:05:00"
          },
          {
            "camera_id": "cam_2",
            "video_path": "data/cameras/cam_2.mp4",
            "location": { "lat": 28.6110, "lon": 77.2010 },
            "area_name": "Janpath Road",
            "fps": 30,
            "start_time": "2026-04-08T10:02:00",
            "end_time": "2026-04-08T10:10:00"
          },
          {
            "camera_id": "cam_3",
            "video_path": "data/cameras/cam_3.mp4",
            "location": { "lat": 28.6150, "lon": 77.2050 },
            "area_name": "Rajiv Chowk Gate 4",
            "fps": 30,
            "start_time": "2026-04-08T10:10:00",
            "end_time": "2026-04-08T10:20:00"
          }
        ];
    } else {
        const camerasRaw = fs.readFileSync(metadataPath, 'utf8');
        cameras = JSON.parse(camerasRaw);
    }
    
    const userTime = new Date(timeStr || "2026-04-08T10:00:00").getTime();
    const feasibleCameras = [];
    
    for (const cam of cameras) {
        const distKm = getDistanceFromLatLonInKm(lat, lng, cam.location.lat, cam.location.lon);
        const camStartTime = new Date(cam.start_time).getTime();
        
        // Time diff in hours
        const timeDiffHours = (camStartTime - userTime) / (1000 * 60 * 60);
        
        let feasible = false;
        if (timeDiffHours > 0) {
           const requiredSpeed = distKm / timeDiffHours;
           if (requiredSpeed <= speedLimitKmph) {
               feasible = true;
           }
        } else if (distKm < 0.5) {
           feasible = true; // Close enough to just be in the area
        }
        
        if (feasible) {
           // Append physical distance and expected time to the camera data
           feasibleCameras.push({
               ...cam,
               distance: distKm.toFixed(2),
               status: 'analyzing', // Ready for AI scan
               label: cam.area_name,
               lat: cam.location.lat,
               lng: cam.location.lon,
               id: cam.camera_id
           });
        }
    }
    
    // Sort by distance (Smart Selection strategy)
    feasibleCameras.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    
    return NextResponse.json({ 
        success: true, 
        message: "Smart Camera Selection applied using Spatio-Temporal constraints.",
        cameras: feasibleCameras 
    });
    
  } catch(err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
