"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";

interface RadarMapProps {
  latitude: number;
  longitude: number;
  locationLabel: string;
}

interface RainViewerResponse {
  host?: string;
  radar?: {
    past?: Array<{ path: string }>;
    nowcast?: Array<{ path: string }>;
  };
}

export function RadarMap({ latitude, longitude, locationLabel }: RadarMapProps) {
  const [radarTemplate, setRadarTemplate] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadRadar(): Promise<void> {
      try {
        const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as RainViewerResponse;
        const host = data.host;
        const frames = [...(data.radar?.past ?? []), ...(data.radar?.nowcast ?? [])];
        const latest = frames[frames.length - 1];

        if (!host || !latest?.path || isCancelled) {
          return;
        }

        setRadarTemplate(`${host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`);
      } catch {
        setRadarTemplate(null);
      }
    }

    loadRadar();

    return () => {
      isCancelled = true;
    };
  }, [latitude, longitude]);

  const position = useMemo<[number, number]>(() => [latitude, longitude], [latitude, longitude]);

  return (
    <section className="panel radar-panel" aria-label="Weather radar map">
      <h3>Live Radar</h3>
      <p className="muted">{locationLabel}</p>
      <div className="radar-wrap">
        <MapContainer center={position} zoom={8} scrollWheelZoom className="radar-map">
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {radarTemplate ? (
            <TileLayer
              attribution='Radar: &copy; RainViewer'
              url={radarTemplate}
              opacity={0.6}
              zIndex={5}
            />
          ) : null}
          <CircleMarker center={position} radius={8} pathOptions={{ color: "#60a5fa", fillOpacity: 0.7 }} />
        </MapContainer>
      </div>
      <p className="muted radar-note">Radar overlay updates from RainViewer public frames.</p>
    </section>
  );
}
