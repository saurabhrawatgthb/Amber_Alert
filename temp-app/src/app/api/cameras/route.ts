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
    
    // Parse Real Metadata
    const metadataPath = path.join(process.cwd(), '..', 'data', 'cameras', 'camera_metadata.json');
    if (!fs.existsSync(metadataPath)) {
        return NextResponse.json({ success: false, message: "No real camera metadata found" }, { status: 404 });
    }
    
    const camerasRaw = fs.readFileSync(metadataPath, 'utf8');
    const cameras = JSON.parse(camerasRaw);
    
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
