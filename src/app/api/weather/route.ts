import { NextRequest, NextResponse } from "next/server";
import { fetchJsonWithTimeout } from "@/lib/http";
import { reportServerError } from "@/lib/monitoring";
import type { AirQuality, ForecastResponse, GeocodingResponse, GeoLocation } from "@/types/weather";

const GEOCODING_BASE =
  process.env.OPEN_METEO_GEOCODING_URL ?? "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_BASE = process.env.OPEN_METEO_FORECAST_URL ?? "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

interface AirQualityApiResponse {
  current?: {
    us_aqi?: number;
    pm2_5?: number;
    pm10?: number;
  };
}

function createBadRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return createBadRequest("Missing required query parameter: q");
  }

  try {
    const geoUrl = `${GEOCODING_BASE}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const geocoding = await fetchJsonWithTimeout<GeocodingResponse>(geoUrl, {
      timeoutMs: 10000,
      revalidateSeconds: 3600,
    });

    const location = geocoding.results?.[0];

    if (!location) {
      return NextResponse.json({ error: `No matching location for "${query}"` }, { status: 404 });
    }

    const forecastUrl = `${FORECAST_BASE}?latitude=${location.latitude}&longitude=${location.longitude}&timezone=auto&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,cloud_cover,precipitation&hourly=temperature_2m,precipitation_probability,precipitation,relative_humidity_2m,cloud_cover,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset&forecast_days=7`;

    const forecast = await fetchJsonWithTimeout<ForecastResponse>(forecastUrl, {
      timeoutMs: 10000,
      revalidateSeconds: 3600,
    });

    const airQualityUrl = `${AIR_QUALITY_BASE}?latitude=${location.latitude}&longitude=${location.longitude}&current=us_aqi,pm2_5,pm10&timezone=auto`;
    const airQualityResponse = await fetchJsonWithTimeout<AirQualityApiResponse>(airQualityUrl, {
      timeoutMs: 10000,
      revalidateSeconds: 1800,
    });

    const airQuality: AirQuality | undefined = airQualityResponse.current
      ? {
          us_aqi: airQualityResponse.current.us_aqi ?? 0,
          pm2_5: airQualityResponse.current.pm2_5 ?? 0,
          pm10: airQualityResponse.current.pm10 ?? 0,
        }
      : undefined;

    const payload: { location: GeoLocation; forecast: ForecastResponse; airQuality?: AirQuality } = {
      location,
      forecast,
      airQuality,
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    reportServerError("/api/weather", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data. Please try again." },
      { status: 502 },
    );
  }
}
