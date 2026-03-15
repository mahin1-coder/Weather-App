"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { formatForecastDate, formatLocalDateTime } from "@/lib/date";
import { reportClientError } from "@/lib/monitoring";
import { getWeatherCodeInfo } from "@/lib/weather-codes";
import type { WeatherData } from "@/types/weather";

type Units = "celsius" | "fahrenheit";
type Theme = "dark" | "light";

const RadarMap = dynamic(
  () => import("@/components/RadarMap").then((module) => module.RadarMap),
  {
    ssr: false,
    loading: () => <section className="panel radar-panel">Loading radar map...</section>,
  },
);

function toFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

function displayTemp(valueC: number, units: Units): string {
  const value = units === "fahrenheit" ? toFahrenheit(valueC) : valueC;
  const symbol = units === "fahrenheit" ? "°F" : "°C";
  return `${Math.round(value)}${symbol}`;
}

function getCloudLabel(cloudCover: number): string {
  if (cloudCover < 20) {
    return "Crystal clear";
  }

  if (cloudCover < 50) {
    return "Partly cloudy";
  }

  if (cloudCover < 80) {
    return "Cloud deck";
  }

  return "Heavy overcast";
}

function getDrynessLabel(humidity: number): string {
  if (humidity < 30) {
    return "Very dry";
  }

  if (humidity < 45) {
    return "Dry";
  }

  if (humidity < 65) {
    return "Balanced";
  }

  return "Humid";
}

function getRainAlert(probability: number, precipitation: number): string {
  if (precipitation >= 2 || probability >= 80) {
    return "Rain burst likely";
  }

  if (precipitation > 0 || probability >= 45) {
    return "Light rain chance";
  }

  return "Dry window";
}

function formatHour(dateTimeStr: string, timezone?: string): string {
  return new Date(dateTimeStr).toLocaleTimeString(undefined, {
    hour: "numeric",
    hour12: true,
    timeZone: timezone,
  });
}

function getAqiDescription(aqi: number): string {
  if (aqi <= 1) {
    return "Good";
  }

  if (aqi === 2) {
    return "Fair";
  }

  if (aqi === 3) {
    return "Moderate";
  }

  if (aqi === 4) {
    return "Poor";
  }

  return "Very poor";
}

function getWeatherClass(weatherCode: number): string {
  if ([95, 96, 99].includes(weatherCode)) {
    return "weather-storm";
  }

  if ([71, 73, 75].includes(weatherCode)) {
    return "weather-snow";
  }

  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode)) {
    return "weather-rain";
  }

  if ([1, 2, 3, 45, 48].includes(weatherCode)) {
    return "weather-cloud";
  }

  return "weather-clear";
}

export function WeatherClient() {
  const [query, setQuery] = useState("New York");
  const [statusMessage, setStatusMessage] = useState("Search for a city to load weather.");
  const [isLoading, setIsLoading] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [units, setUnits] = useState<Units>("celsius");
  const [savedLocations, setSavedLocations] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("weather-saved-locations");
    const storedTheme = window.localStorage.getItem("weather-theme");

    if (!stored) {
      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
      }
    } else {
      try {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed)) {
          setSavedLocations(parsed.slice(0, 5));
        }
      } catch {
        window.localStorage.removeItem("weather-saved-locations");
      }

      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
      }
    }
  }, []);

  useEffect(() => {
    const themeClass = theme === "light" ? "theme-light" : "theme-dark";
    document.body.classList.remove("theme-light", "theme-dark");
    document.body.classList.add(themeClass);
    window.localStorage.setItem("weather-theme", theme);
  }, [theme]);

  const currentWeather = weatherData?.forecast.current;

  useEffect(() => {
    const weatherClassNames = [
      "weather-clear",
      "weather-cloud",
      "weather-rain",
      "weather-snow",
      "weather-storm",
    ];

    document.body.classList.remove(...weatherClassNames);

    if (!currentWeather) {
      return;
    }

    document.body.classList.add(getWeatherClass(currentWeather.weather_code));
  }, [currentWeather]);
  const currentCodeInfo = useMemo(() => {
    if (!currentWeather) {
      return null;
    }

    return getWeatherCodeInfo(currentWeather.weather_code);
  }, [currentWeather]);

  const nextHours = useMemo(() => {
    if (!weatherData) {
      return [];
    }

    return weatherData.forecast.hourly.time.slice(0, 24).map((time, index) => ({
      time,
      temperature: weatherData.forecast.hourly.temperature_2m[index],
      probability: weatherData.forecast.hourly.precipitation_probability[index],
      precipitation: weatherData.forecast.hourly.precipitation[index],
      code: weatherData.forecast.hourly.weather_code[index],
    }));
  }, [weatherData]);

  const quickSignals = useMemo(() => {
    if (!weatherData || !currentWeather) {
      return [];
    }

    const maxRainChance = Math.max(...weatherData.forecast.hourly.precipitation_probability.slice(0, 24));
    const nextRainAmount = weatherData.forecast.hourly.precipitation[0] ?? 0;
    const humidity = currentWeather.relative_humidity_2m;
    const dryness = Math.max(0, 100 - humidity);

    return [
      {
        label: "Cloud Layer",
        value: `${Math.round(currentWeather.cloud_cover)}%`,
        detail: getCloudLabel(currentWeather.cloud_cover),
      },
      {
        label: "Rain Signal",
        value: `${Math.round(maxRainChance)}%`,
        detail: getRainAlert(maxRainChance, nextRainAmount),
      },
      {
        label: "Dryness Index",
        value: `${Math.round(dryness)}%`,
        detail: getDrynessLabel(humidity),
      },
      {
        label: "Humidity",
        value: `${Math.round(humidity)}%`,
        detail: "Air moisture",
      },
    ];
  }, [weatherData, currentWeather]);

  function saveCurrentLocation(): void {
    if (!weatherData) {
      return;
    }

    const value = `${weatherData.location.name}, ${weatherData.location.country}`;
    const updated = [value, ...savedLocations.filter((item) => item !== value)].slice(0, 5);
    setSavedLocations(updated);
    window.localStorage.setItem("weather-saved-locations", JSON.stringify(updated));
    setStatusMessage(`Saved ${value} for quick access.`);
  }

  function toggleTheme(): void {
    setTheme((previous) => (previous === "dark" ? "light" : "dark"));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      setStatusMessage("Enter a location first.");
      return;
    }

    if (normalizedQuery.length < 2 || !/^[a-zA-Z\s,'-]+$/.test(normalizedQuery)) {
      setStatusMessage("Please enter a valid city name (letters, spaces, comma, apostrophe, hyphen).");
      return;
    }

    setIsLoading(true);
    setStatusMessage("Fetching forecast and air quality...");

    try {
      const response = await fetch(`/api/weather?q=${encodeURIComponent(normalizedQuery)}`);

      if (!response.ok) {
        const message =
          response.status === 404
            ? "Location not found. Please try another city."
            : "Unable to fetch data. Please try again.";
        throw new Error(message);
      }

      const data = (await response.json()) as WeatherData;

      if (!data.forecast?.current) {
        throw new Error("No current data available for this location.");
      }

      setWeatherData(data);
      setStatusMessage(`Showing forecast for ${data.location.name}, ${data.location.country}.`);
    } catch (error) {
      reportClientError("weather-fetch", error);
      const message = error instanceof Error ? error.message : "Unexpected error occurred.";
      if (message.includes("Location not found")) {
        setStatusMessage("Location not found. Please try another city.");
      } else if (message.includes("Failed to fetch") || message.includes("Unable to fetch")) {
        setStatusMessage("Unable to fetch data. Please check your connection and try again later.");
      } else {
        setStatusMessage(message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="grid weather-shell" aria-live="polite">
      <form className="search-row" onSubmit={handleSubmit}>
        <label htmlFor="location" className="muted" style={{ alignSelf: "center" }}>
          Location
        </label>
        <input
          id="location"
          name="location"
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
          placeholder="Search city (e.g., London)"
          autoComplete="off"
        />
        <select
          aria-label="Temperature unit"
          value={units}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => setUnits(event.target.value as Units)}
        >
          <option value="celsius">°C</option>
          <option value="fahrenheit">°F</option>
        </select>
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Loading..." : "Get Weather"}
        </button>
        <button type="button" className="secondary-btn" onClick={toggleTheme}>
          {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
        </button>
      </form>

      {savedLocations.length > 0 ? (
        <div className="saved-row" aria-label="Saved locations">
          {savedLocations.map((locationName) => (
            <button
              key={locationName}
              type="button"
              className="chip"
              onClick={() => setQuery(locationName)}
            >
              {locationName}
            </button>
          ))}
        </div>
      ) : null}

      <p className="status" role="status">
        {statusMessage}
      </p>

      {weatherData && currentWeather && currentCodeInfo ? (
        <>
          <article className="panel hero-panel">
            <div className="hero-heading">
              <div>
                <h2>
                  {weatherData.location.name}, {weatherData.location.country}
                </h2>
                <p className="muted">
                  {formatLocalDateTime(currentWeather.time, weatherData.forecast.timezone)} · {currentCodeInfo.label}
                </p>
              </div>
              <button type="button" className="secondary-btn" onClick={saveCurrentLocation}>
                Save Place
              </button>
            </div>

            <p className="temp hero-temp">
              <span aria-hidden="true">{currentCodeInfo.icon}</span> {displayTemp(currentWeather.temperature_2m, units)}
            </p>

            <div className="hero-stats">
              <p>Feels like: {displayTemp(currentWeather.apparent_temperature, units)}</p>
              <p>Wind: {Math.round(currentWeather.wind_speed_10m)} km/h</p>
              <p>Clouds: {Math.round(currentWeather.cloud_cover)}%</p>
              <p>Rain now: {currentWeather.precipitation.toFixed(1)} mm</p>
            </div>
          </article>

          <section className="signal-grid" aria-label="Live weather signals">
            {quickSignals.map((signal) => (
              <article className="panel signal-card" key={signal.label}>
                <p className="signal-label">{signal.label}</p>
                <p className="signal-value">{signal.value}</p>
                <p className="muted">{signal.detail}</p>
              </article>
            ))}
          </section>

          <section className="panel">
            <h3>Next 24 Hours</h3>
            <div className="hourly-strip" role="list" aria-label="Hourly weather strip">
              {nextHours.map((hourData) => {
                const codeInfo = getWeatherCodeInfo(hourData.code);

                return (
                  <article key={hourData.time} role="listitem" className="hourly-item">
                    <p className="muted">{formatHour(hourData.time, weatherData.forecast.timezone)}</p>
                    <p className="hourly-icon" aria-hidden="true">
                      {codeInfo.icon}
                    </p>
                    <p>{displayTemp(hourData.temperature, units)}</p>
                    <p className="muted">Rain {Math.round(hourData.probability)}%</p>
                    <p className="muted">{hourData.precipitation.toFixed(1)} mm</p>
                  </article>
                );
              })}
            </div>
          </section>

          {weatherData.airQuality ? (
            <section className="panel aqi-panel" aria-label="Air quality index">
              <h3>Air Quality</h3>
              <div className="grid grid-2">
                <p>
                  AQI: <strong>{weatherData.airQuality.us_aqi}</strong> ({getAqiDescription(weatherData.airQuality.us_aqi)})
                </p>
                <p>PM2.5: {weatherData.airQuality.pm2_5.toFixed(1)} µg/m³</p>
                <p>PM10: {weatherData.airQuality.pm10.toFixed(1)} µg/m³</p>
              </div>
            </section>
          ) : null}

          <RadarMap
            latitude={weatherData.location.latitude}
            longitude={weatherData.location.longitude}
            locationLabel={`${weatherData.location.name}, ${weatherData.location.country}`}
          />

          <section className="panel">
            <h3>7-Day Forecast</h3>
            <div className="forecast-grid">
              {weatherData.forecast.daily.time.map((date, index) => {
                const code = weatherData.forecast.daily.weather_code[index];
                const info = getWeatherCodeInfo(code);

                return (
                  <article key={date} className="panel">
                    <p>{formatForecastDate(date)}</p>
                    <p>
                      <span aria-hidden="true">{info.icon}</span> {info.label}
                    </p>
                    <p>
                      H: {displayTemp(weatherData.forecast.daily.temperature_2m_max[index], units)}
                    </p>
                    <p>
                      L: {displayTemp(weatherData.forecast.daily.temperature_2m_min[index], units)}
                    </p>
                    <p>Rain: {weatherData.forecast.daily.precipitation_probability_max[index]}%</p>
                    <p>Total: {weatherData.forecast.daily.precipitation_sum[index].toFixed(1)} mm</p>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
