"use client";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Create custom tactical icons
const createTacticalIcon = (isMatch: boolean) => {
  return L.divIcon({
    className: "bg-transparent border-0",
    html: `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        ${isMatch 
          ? `<div style="position: absolute; inset: 0; background-color: rgba(225, 29, 72, 0.4); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
             <div style="position: relative; width: 12px; height: 12px; background-color: #ef4444; border-radius: 50%; box-shadow: 0 0 10px #ef4444, 0 0 20px #ef4444; border: 2px solid white;"></div>` 
          : `<div style="position: absolute; inset: 0; border: 1px solid rgba(59, 130, 246, 0.5); border-radius: 50%;"></div>
             <div style="position: relative; width: 8px; height: 8px; background-color: #3b82f6; border-radius: 50%; box-shadow: 0 0 8px #3b82f6;"></div>`
        }
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

export default function MapComponent({ cameras, onSelectCamera }: { cameras: any[], onSelectCamera: (cam: any) => void }) {
  if (cameras.length === 0) return (
    <div className="h-full w-full bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden text-slate-400 font-mono text-sm tracking-widest">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
      <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(59,130,246,0.3)]"></div>
      ESTABLISHING GEO-SPATIAL UPLINK...
    </div>
  );

  const center = [cameras[0].lat, cameras[0].lng] as [number, number];
  
  // Calculate a fake "path" of matched cameras
  const matchingCams = cameras.filter(c => c.lastMatch);
  const pathCoordinates = matchingCams.map(c => [c.lat, c.lng] as [number, number]);

  return (
    <MapContainer 
      center={center} 
      zoom={14} 
      style={{ height: "100%", width: "100%", background: "#020617" }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
      />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
      />
      
      {cameras.map((cam, idx) => (
        <Marker 
          key={cam.id} 
          position={[cam.lat, cam.lng]} 
          icon={createTacticalIcon(cam.lastMatch)}
          eventHandlers={{
            click: () => onSelectCamera(cam)
          }}
        >
          <Popup className="tactical-popup">
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 text-slate-300 p-3 rounded-lg shadow-xl font-mono text-xs w-48">
              <div className="border-b border-slate-700 pb-2 mb-2 flex items-center justify-between">
                 <b className="text-white tracking-widest bg-slate-950 px-1 py-0.5 rounded">{cam.id}</b>
                 {cam.lastMatch && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_red]"></span>}
              </div>
              <div className="text-slate-400 mb-1 tracking-wide">{cam.label}</div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                 STATUS: <span className="text-emerald-400">{cam.status.toUpperCase()}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {pathCoordinates.length > 1 && (
         <Polyline 
            positions={pathCoordinates} 
            color="#ef4444" 
            weight={3} 
            dashArray="8, 12" 
            className="animate-pulse"
         />
      )}
    </MapContainer>
  );
}
