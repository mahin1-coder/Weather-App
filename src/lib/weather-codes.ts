import { WEATHER_CODES } from "@/types/weather";

export function getWeatherCodeInfo(code: number): { label: string; icon: string } {
  return WEATHER_CODES[code] ?? { label: "Unknown", icon: "❔" };
}
