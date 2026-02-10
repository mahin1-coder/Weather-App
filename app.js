const form = document.getElementById("search-form");
const statusEl = document.getElementById("status");
const currentCard = document.getElementById("current-card");
const forecastCard = document.getElementById("forecast-card");
const forecastGrid = document.getElementById("forecast-grid");

const locationEl = document.getElementById("location");
const localTimeEl = document.getElementById("local-time");
const tempEl = document.getElementById("temp");
const summaryEl = document.getElementById("summary");
const feelsEl = document.getElementById("feels");
const windEl = document.getElementById("wind");
const humidityEl = document.getElementById("humidity");

const weatherCodes = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Heavy showers",
  82: "Violent showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ hail",
  99: "Thunderstorm w/ heavy hail"
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const city = formData.get("city").trim();
  const country = formData.get("country").trim();

  if (!city) {
    statusEl.textContent = "Please enter a city.";
    return;
  }

  try {
    setStatus("Searching location...");
    const location = await lookupCity(city, country);
    setStatus("Fetching forecast...");
    const forecast = await fetchForecast(location.latitude, location.longitude);
    renderCurrent(location, forecast);
    renderForecast(forecast);
    setStatus("Updated just now.");
  } catch (error) {
    console.error(error);
    setStatus("Couldn’t fetch data. Try another city.");
  }
});

function setStatus(message) {
  statusEl.textContent = message;
}

async function lookupCity(city, country) {
  const query = new URLSearchParams({
    name: city,
    count: 1,
    language: "en",
    format: "json"
  });
  if (country) {
    query.append("country", country);
  }
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${query}`);
  const data = await response.json();
  if (!data.results || !data.results.length) {
    throw new Error("No locations found");
  }
  return data.results[0];
}

async function fetchForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto"
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  return response.json();
}

function renderCurrent(location, forecast) {
  const current = forecast.current;
  const weatherLabel = weatherCodes[current.weather_code] || "Unknown";

  locationEl.textContent = `${location.name}, ${location.country}`;
  localTimeEl.textContent = `Local time: ${current.time}`;
  tempEl.textContent = formatTemp(current.temperature_2m);
  summaryEl.textContent = weatherLabel;
  feelsEl.textContent = formatTemp(current.apparent_temperature);
  windEl.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  humidityEl.textContent = `${Math.round(current.relative_humidity_2m)}%`;

  currentCard.hidden = false;
}

function renderForecast(forecast) {
  forecastGrid.innerHTML = "";
  const { time, temperature_2m_max, temperature_2m_min, weather_code } =
    forecast.daily;

  time.forEach((date, index) => {
    const card = document.createElement("div");
    card.className = "forecast-card";
    const label = weatherCodes[weather_code[index]] || "Unknown";
    const maxLabel = formatTemp(temperature_2m_max[index]);
    const minLabel = formatTemp(temperature_2m_min[index]);

    card.innerHTML = `
      <h4>${formatDate(date)}</h4>
      <p>${label}</p>
      <p><strong>High:</strong> ${maxLabel}</p>
      <p><strong>Low:</strong> ${minLabel}</p>
    `;
    forecastGrid.appendChild(card);
  });

  forecastCard.hidden = false;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatTemp(valueC) {
  const roundedC = Math.round(valueC);
  const roundedF = Math.round((valueC * 9) / 5 + 32);
  return `${roundedC}°C / ${roundedF}°F`;
}
