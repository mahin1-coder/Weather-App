# Weather Now

A modern weather dashboard built with Next.js and TypeScript.

![Weather Now Screenshot](docs/screenshot.png)

It lets users search any city and view:
- Current weather
- 24-hour forecast
- 7-day forecast
- Air quality (AQI)
- Live radar map overlay

The project is built to be fast, clean, and production-ready.

## Live demo

https://weather-app-mahin.vercel.app

## Author

**Mahin** – [Portfolio](https://github.com/mahin1-coder/About-me)

## Why this project is strong for interviews

- Full-stack flow: client UI + server API route
- Real API integration with error handling and timeouts
- Strong UX: responsive design, dark/light mode, animated weather states
- Accessibility support (`role="status"`, focus-visible styles, reduced motion)
- Clean TypeScript structure and build/lint checks

## Tech stack

- Next.js (App Router)
- TypeScript
- React
- Open-Meteo (weather + air quality)
- Leaflet + RainViewer (radar layer)
- Optional OpenWeather radar tiles for higher zoom support

## Quick start

1. Install packages

```bash
npm install
```

2. Start development server

```bash
npm run dev
```

3. Open in browser

```text
http://localhost:3000
```

## Scripts

- `npm run dev` – start local dev server
- `npm run typecheck` – run TypeScript checks
- `npm run lint` – run ESLint
- `npm run build` – create production build

## Project structure

- `src/app` – routes, layout, global styles, API route
- `src/components` – UI components (weather dashboard + radar map)
- `src/lib` – utility helpers (date, fetch, monitoring)
- `src/types` – shared TypeScript models

## Notes

- Copy `.env.example` to `.env.local` if you want to customize API base URLs.
- Add `NEXT_PUBLIC_OPENWEATHERMAP_API_KEY` in `.env.local` to enable higher-zoom radar tiles.
- For monetization, confirm your weather/radar data licensing terms first.

## Portfolio pitch (copy-ready)

Built a full-stack weather web app using Next.js and TypeScript with a focus on production quality UX.

Key outcomes:
- Integrated real-time weather, hourly and daily forecasts, AQI, and live radar overlays.
- Implemented a server-side API proxy with caching, timeout handling, and user-friendly error states.
- Designed a modern responsive interface with dark/light mode, animated weather backgrounds, and accessibility support.
- Maintained code quality with strict TypeScript, linting, and successful production builds.

What this demonstrates:
- Strong frontend + backend integration skills
- API design and reliability engineering basics
- Practical UI/UX and accessibility implementation
- Ability to ship polished, maintainable features end-to-end

Use case statement:
This project shows I can take a simple prototype and transform it into a feature-rich, user-focused product using modern engineering standards.
