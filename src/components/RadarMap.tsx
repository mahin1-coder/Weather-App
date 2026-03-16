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

// Max zoom for RainViewer free tiles - locked at 6 to ensure coverage
const RAINVIEWER_MAX_ZOOM = 6;

export function RadarMap({ latitude, longitude, locationLabel }: RadarMapProps) {
  const [radarTemplate, setRadarTemplate] = useState<string | null>(null);
  const [radarAttribution, setRadarAttribution] = useState("Radar: © RainViewer");
  const [isOpenWeather, setIsOpenWeather] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const openWeatherKey = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;

    if (openWeatherKey) {
      setRadarTemplate(
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${openWeatherKey}`,
      );
      setRadarAttribution("Radar: © OpenWeather");
      setIsOpenWeather(true);
      return;
    }

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
        setRadarAttribution("Radar: © RainViewer");
        setIsOpenWeather(false);
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

  // Use lower zoom for RainViewer to avoid "Zoom Level Not Supported"
  const maxZoom = isOpenWeather ? 12 : RAINVIEWER_MAX_ZOOM;
  const initialZoom = isOpenWeather ? 7 : 5;

  return (
    <section className="panel radar-panel" aria-label="Weather radar map">
      <h3>Live Radar</h3>
      <p className="muted">{locationLabel}</p>
      <div className="radar-wrap">
        <MapContainer
          key={`radar-${maxZoom}-${latitude.toFixed(2)}-${longitude.toFixed(2)}`}
          center={position}
          zoom={initialZoom}
          scrollWheelZoom={false}
          className="radar-map"
          minZoom={2}
          maxZoom={maxZoom}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxNativeZoom={20}
            maxZoom={maxZoom}
          />
          {radarTemplate ? (
            <TileLayer
              attribution={radarAttribution}
              url={radarTemplate}
              opacity={0.6}
              zIndex={5}
              maxNativeZoom={RAINVIEWER_MAX_ZOOM}
              maxZoom={maxZoom}
              errorTileUrl=""
            />
          ) : null}
          <CircleMarker center={position} radius={10} pathOptions={{ color: "#60a5fa", fillOpacity: 0.8 }} />
        </MapContainer>
      </div>
      <p className="muted radar-note">
        {isOpenWeather ? "Radar: OpenWeather" : "Radar: RainViewer (zoom limited for coverage)"}
      </p>
    </section>
  );
}
