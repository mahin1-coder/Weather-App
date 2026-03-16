"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { formatForecastDate, formatLocalDateTime } from "@/lib/date";
import { reportClientError } from "@/lib/monitoring";
import { getWeatherCodeInfo } from "@/lib/weather-codes";
import type { WeatherData } from "@/types/weather";

type Units = "celsius" | "fahrenheit";
type SpeedUnits = "kmh" | "mph";
type Theme = "dark" | "light";

// Countries that use Fahrenheit (US and a few territories)
const FAHRENHEIT_COUNTRIES = new Set(["US", "USA", "United States", "PR", "GU", "VI", "AS", "FM", "MH", "PW"]);

function detectUserCountry(): string | null {
  try {
    // Try to get country from timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone.startsWith("America/")) {
      // Most America/ timezones are US, but not all
      const usTimezones = [
        "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
        "America/Anchorage", "America/Phoenix", "America/Detroit", "America/Indianapolis",
        "America/Boise", "America/Juneau", "America/Honolulu"
      ];
      if (usTimezones.some(tz => timezone.includes(tz.split("/")[1]))) {
        return "US";
      }
    }
    // Try navigator.language (e.g., "en-US", "ur-PK")
    const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || "";
    const parts = lang.split("-");
    if (parts.length >= 2) {
      return parts[1].toUpperCase();
    }
    return null;
  } catch {
    return null;
  }
}

function getDefaultUnits(): { temp: Units; speed: SpeedUnits } {
  const country = detectUserCountry();
  const useImperial = country !== null && FAHRENHEIT_COUNTRIES.has(country);
  return {
    temp: useImperial ? "fahrenheit" : "celsius",
    speed: useImperial ? "mph" : "kmh",
  };
}

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

function toMph(kmh: number): number {
  return kmh * 0.621371;
}

function displaySpeed(kmh: number, speedUnits: SpeedUnits): string {
  const value = speedUnits === "mph" ? toMph(kmh) : kmh;
  const label = speedUnits === "mph" ? "mph" : "km/h";
  return `${Math.round(value)} ${label}`;
}

function displayPrecip(mm: number, speedUnits: SpeedUnits): string {
  // Use inches for imperial (mph) users
  if (speedUnits === "mph") {
    const inches = mm * 0.03937;
    return `${inches.toFixed(2)} in`;
  }
  return `${mm.toFixed(1)} mm`;
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
  const [speedUnits, setSpeedUnits] = useState<SpeedUnits>("kmh");
  const [savedLocations, setSavedLocations] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>("dark");
  const [selectedDay, setSelectedDay] = useState("");
  const [unitsInitialized, setUnitsInitialized] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("weather-saved-locations");
    const storedTheme = window.localStorage.getItem("weather-theme");
    const storedUnits = window.localStorage.getItem("weather-units");
    const storedSpeedUnits = window.localStorage.getItem("weather-speed-units");

    // Auto-detect units based on country if not previously set
    if (!storedUnits || !storedSpeedUnits) {
      const defaults = getDefaultUnits();
      setUnits(storedUnits === "celsius" || storedUnits === "fahrenheit" ? storedUnits : defaults.temp);
      setSpeedUnits(storedSpeedUnits === "kmh" || storedSpeedUnits === "mph" ? storedSpeedUnits : defaults.speed);
    } else {
      if (storedUnits === "celsius" || storedUnits === "fahrenheit") {
        setUnits(storedUnits);
      }
      if (storedSpeedUnits === "kmh" || storedSpeedUnits === "mph") {
        setSpeedUnits(storedSpeedUnits);
      }
    }
    setUnitsInitialized(true);

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

  // Save units preference when changed
  useEffect(() => {
    if (unitsInitialized) {
      window.localStorage.setItem("weather-units", units);
      window.localStorage.setItem("weather-speed-units", speedUnits);
    }
  }, [units, speedUnits, unitsInitialized]);

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

  const selectedDayIndex = useMemo(() => {
    if (!weatherData || !selectedDay) {
      return 0;
    }

    const index = weatherData.forecast.daily.time.indexOf(selectedDay);
    return index >= 0 ? index : 0;
  }, [weatherData, selectedDay]);

  const selectedDayForecast = useMemo(() => {
    if (!weatherData) {
      return null;
    }

    const date = weatherData.forecast.daily.time[selectedDayIndex];
    const weatherCode = weatherData.forecast.daily.weather_code[selectedDayIndex];
    const info = getWeatherCodeInfo(weatherCode);

    return {
      date,
      info,
      high: weatherData.forecast.daily.temperature_2m_max[selectedDayIndex],
      low: weatherData.forecast.daily.temperature_2m_min[selectedDayIndex],
      rainChance: weatherData.forecast.daily.precipitation_probability_max[selectedDayIndex],
      rainTotal: weatherData.forecast.daily.precipitation_sum[selectedDayIndex],
      sunrise: weatherData.forecast.daily.sunrise[selectedDayIndex],
      sunset: weatherData.forecast.daily.sunset[selectedDayIndex],
    };
  }, [weatherData, selectedDayIndex]);

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
      setSelectedDay(data.forecast.daily.time[0] ?? "");
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
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            const newUnit = event.target.value as Units;
            setUnits(newUnit);
            // Sync speed units with temperature preference
            setSpeedUnits(newUnit === "fahrenheit" ? "mph" : "kmh");
          }}
        >
          <option value="celsius">°C / km/h</option>
          <option value="fahrenheit">°F / mph</option>
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
              <p>Wind: {displaySpeed(currentWeather.wind_speed_10m, speedUnits)}</p>
              <p>Clouds: {Math.round(currentWeather.cloud_cover)}%</p>
              <p>Rain now: {displayPrecip(currentWeather.precipitation, speedUnits)}</p>
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
                    <p className="muted">{displayPrecip(hourData.precipitation, speedUnits)}</p>
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

          {selectedDayForecast ? (
            <section className="panel" aria-label="Selected day forecast">
              <div className="day-selector-row">
                <h3>Selected Day Forecast</h3>
                <input
                  type="date"
                  value={selectedDayForecast.date}
                  min={weatherData.forecast.daily.time[0]}
                  max={weatherData.forecast.daily.time[weatherData.forecast.daily.time.length - 1]}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setSelectedDay(event.target.value)}
                />
              </div>

              <div className="selected-day-grid">
                <p>
                  <strong>{formatForecastDate(selectedDayForecast.date)}</strong>
                </p>
                <p>
                  <span aria-hidden="true">{selectedDayForecast.info.icon}</span> {selectedDayForecast.info.label}
                </p>
                <p>High: {displayTemp(selectedDayForecast.high, units)}</p>
                <p>Low: {displayTemp(selectedDayForecast.low, units)}</p>
                <p>Rain chance: {selectedDayForecast.rainChance}%</p>
                <p>Total rain: {displayPrecip(selectedDayForecast.rainTotal, speedUnits)}</p>
                <p>Sunrise: {formatHour(selectedDayForecast.sunrise, weatherData.forecast.timezone)}</p>
                <p>Sunset: {formatHour(selectedDayForecast.sunset, weatherData.forecast.timezone)}</p>
              </div>
            </section>
          ) : null}

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
                    <p>Total: {displayPrecip(weatherData.forecast.daily.precipitation_sum[index], speedUnits)}</p>
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
