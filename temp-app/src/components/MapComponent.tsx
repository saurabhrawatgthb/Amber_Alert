"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Leaflet icon fix
const iconDefault = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = iconDefault;

const matchIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function MapComponent({ cameras, onSelectCamera }: { cameras: any[], onSelectCamera: (cam: any) => void }) {
  if (cameras.length === 0) return <div className="h-full w-full bg-slate-900 flex items-center justify-center">Loading Geospatial Data...</div>;

  const center = [cameras[0].lat, cameras[0].lng] as [number, number];
  
  // Calculate a fake "path" of matched cameras
  const matchingCams = cameras.filter(c => c.lastMatch);
  const pathCoordinates = matchingCams.map(c => [c.lat, c.lng] as [number, number]);

  return (
    <MapContainer 
      center={center} 
      zoom={14} 
      style={{ height: "100%", width: "100%", background: "#0f172a" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      
      {cameras.map((cam, idx) => (
        <Marker 
          key={cam.id} 
          position={[cam.lat, cam.lng]} 
          icon={cam.lastMatch ? matchIcon : iconDefault}
          eventHandlers={{
            click: () => onSelectCamera(cam)
          }}
        >
          <Popup className="bg-slate-900 text-white border-0">
            <b className="text-white">{cam.label}</b><br/>
            ID: {cam.id}<br/>
            Status: {cam.status}
          </Popup>
        </Marker>
      ))}

      {pathCoordinates.length > 1 && (
         <Polyline positions={pathCoordinates} color="#ef4444" weight={3} dashArray="5, 10" />
      )}
    </MapContainer>
  );
}
