"use client";
import { useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface CameraNode {
  id: string;
  label: string;
  lat: number;
  lng: number;
  status?: "pending" | "scanning" | "matched" | "clear";
  neighbors?: string[];
}

interface TrackingHit {
  camera_id: string;
  label: string;
  timestamp: string;
  confidence: number;
  lat: number;
  lng: number;
}

interface MapComponentProps {
  cameras?: CameraNode[];
  trackingPath?: TrackingHit[];
  onSelectCamera?: (camera: CameraNode) => void;
}

// ─────────────────────────────────────────────
// Leaflet Map Component (Client-Only)
// ─────────────────────────────────────────────
export default function MapComponent({ cameras = [], trackingPath = [], onSelectCamera }: MapComponentProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const polylinesRef = useRef<any[]>([]);

  // ── Initialize Map ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mapInstanceRef.current) return; // Already initialized

    const L = require("leaflet");
    require("leaflet/dist/leaflet.css");

    // Custom dark tile layer
    const map = L.map(mapRef.current, {
      center: [28.6315, 77.2167],  // Connaught Place, Delhi
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark tactical map theme
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── Update Camera Markers ──
  useEffect(() => {
    const L = require("leaflet");
    const map = mapInstanceRef.current;
    if (!map || !L) return;

    // Remove old markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current.clear();

    if (cameras.length === 0) return;

    cameras.forEach((cam) => {
      const isMatched = cam.status === "matched" || trackingPath.some(h => h.camera_id === cam.id);
      const isScanning = cam.status === "scanning";
      const hitIdx = trackingPath.findIndex(h => h.camera_id === cam.id);
      const hit = hitIdx >= 0 ? trackingPath[hitIdx] : null;

      // Custom SVG marker
      const color = isMatched ? "#ef4444" : isScanning ? "#eab308" : "#64748b";
      const glow = isMatched ? "drop-shadow(0 0 8px #ef4444)" : "";
      const size = isMatched ? 36 : 28;

      const svgIcon = L.divIcon({
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `
          <div style="
            width: ${size}px; height: ${size}px;
            border-radius: 50%;
            background: ${color}22;
            border: 2px solid ${color};
            display: flex; align-items: center; justify-content: center;
            filter: ${glow};
            position: relative;
          ">
            ${isMatched ? `
              <div style="
                position: absolute; inset: -6px;
                border-radius: 50%;
                border: 1.5px solid ${color}55;
                animation: ping 1.5s ease-in-out infinite;
              "></div>
            ` : ""}
            <span style="color: ${color}; font-size: ${isMatched ? 16 : 13}px; line-height: 1;">
              ${isMatched ? "📍" : "📷"}
            </span>
            ${hitIdx >= 0 ? `
              <div style="
                position: absolute; top: -8px; right: -8px;
                background: #ef4444; color: white;
                border-radius: 50%; width: 16px; height: 16px;
                font-size: 9px; font-weight: bold; font-family: monospace;
                display: flex; align-items: center; justify-content: center;
                border: 1.5px solid #020617;
              ">${hitIdx + 1}</div>
            ` : ""}
          </div>
        `,
      });

      const popupContent = hit
        ? `
          <div style="font-family: monospace; font-size: 11px; color: #e2e8f0; background: #0f172a; padding: 10px; border-radius: 8px; min-width: 200px; border: 1px solid #ef444440;">
            <div style="color: #ef4444; font-weight: bold; font-size: 12px; margin-bottom: 6px;">⚠ TARGET DETECTED</div>
            <div style="color: #94a3b8; margin-bottom: 2px;">${cam.label}</div>
            <div style="color: #64748b;">${cam.id}</div>
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #1e293b;">
              <div>🕐 ${new Date(hit.timestamp).toLocaleTimeString()}</div>
              <div>📊 Confidence: ${(hit.confidence * 100).toFixed(1)}%</div>
              <div>📍 Step ${hitIdx + 1} of ${trackingPath.length}</div>
            </div>
          </div>
        `
        : `
          <div style="font-family: monospace; font-size: 11px; color: #94a3b8; background: #0f172a; padding: 10px; border-radius: 8px; min-width: 160px; border: 1px solid #1e293b;">
            <div style="color: #e2e8f0; font-weight: bold; margin-bottom: 4px;">${cam.label}</div>
            <div style="color: #64748b;">${cam.id}</div>
            <div style="color: #475569; margin-top: 4px;">No detection</div>
          </div>
        `;

      const marker = L.marker([cam.lat, cam.lng], { icon: svgIcon })
        .addTo(map)
        .bindPopup(popupContent, {
          className: "dark-popup",
          maxWidth: 250,
        });

      marker.on("click", () => {
        if (onSelectCamera) onSelectCamera(cam);
      });

      markersRef.current.set(cam.id, marker);
    });

    // Auto-fit bounds to all cameras
    if (cameras.length > 1) {
      const bounds = L.latLngBounds(cameras.map(c => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameras, trackingPath]);

  // ── Draw Tracking Path Polylines ──
  useEffect(() => {
    const L = require("leaflet");
    const map = mapInstanceRef.current;
    if (!map || !L) return;

    // Remove old polylines
    polylinesRef.current.forEach(p => map.removeLayer(p));
    polylinesRef.current = [];

    if (trackingPath.length < 2) return;

    // Draw animated path between matched cameras
    for (let i = 0; i < trackingPath.length - 1; i++) {
      const from = trackingPath[i];
      const to = trackingPath[i + 1];

      // Dashed glow line
      const polyline = L.polyline(
        [[from.lat, from.lng], [to.lat, to.lng]],
        {
          color: "#ef4444",
          weight: 2,
          opacity: 0.7,
          dashArray: "8 6",
        }
      ).addTo(map);

      // Outer glow
      const glowLine = L.polyline(
        [[from.lat, from.lng], [to.lat, to.lng]],
        {
          color: "#ef4444",
          weight: 8,
          opacity: 0.1,
        }
      ).addTo(map);

      polylinesRef.current.push(polyline, glowLine);
    }
  }, [trackingPath]);

  return (
    <>
      <style>{`
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
        }
        .leaflet-popup-tip {
          background: #0f172a !important;
        }
        .leaflet-control-zoom {
          border: 1px solid #1e293b !important;
          border-radius: 8px !important;
          overflow: hidden;
        }
        .leaflet-control-zoom a {
          background: #0f172a !important;
          color: #64748b !important;
          border-color: #1e293b !important;
        }
        .leaflet-control-zoom a:hover {
          background: #1e293b !important;
          color: #e2e8f0 !important;
        }
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
      <div
        ref={mapRef}
        style={{ width: "100%", height: "100%", background: "#020617" }}
      />
    </>
  );
}
