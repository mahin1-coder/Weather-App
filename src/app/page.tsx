import { WeatherClient } from "@/components/WeatherClient";

export default function HomePage() {
  return (
    <main>
      <div className="container grid">
        <header>
          <h1>Weather Now</h1>
          <p className="muted">Current conditions and 7-day forecast</p>
        </header>
        <WeatherClient />
      </div>
    </main>
  );
}
