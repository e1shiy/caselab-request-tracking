import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { config } from '../../src/config.js';

export interface ForecastDayInput {
  precipitationMm: number;
  windMaxKmph: number;
  tempMax?: number;
  tempMin?: number;
}

export type WeatherScenario =
  | { kind: 'ok'; days: ForecastDayInput[] }
  | { kind: 'http-error'; status: number }
  | { kind: 'garbage' };

let server: Server | undefined;
let scenario: WeatherScenario = { kind: 'ok', days: [] };

/**
 * Стаб погодного сервиса. Настоящий open-meteo в тестах не вызывается:
 * проверки должны быть детерминированными и не зависеть от сети.
 */
export async function startWeatherStub(): Promise<string> {
  if (server !== undefined) return stubUrl();

  scenario = { kind: 'ok', days: defaultDays() };

  server = createServer((req, res) => {
    if (scenario.kind === 'http-error') {
      res.writeHead(scenario.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'stub' }));
      return;
    }

    if (scenario.kind === 'garbage') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ unexpected: true }));
      return;
    }

    const count = scenario.days.length;
    const body = {
      daily: {
        time: scenario.days.map((_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`),
        precipitation_sum: scenario.days.map((day) => day.precipitationMm),
        wind_speed_10m_max: scenario.days.map((day) => day.windMaxKmph),
        temperature_2m_max: scenario.days.map((day) => day.tempMax ?? 12),
        temperature_2m_min: scenario.days.map((day) => day.tempMin ?? 4),
      },
    };
    void count;

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });

  await new Promise<void>((resolve) => {
    server!.listen(0, '127.0.0.1', resolve);
  });

  return stubUrl();
}

function stubUrl(): string {
  const address = server!.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}/v1/forecast`;
}

/** Переключает ответ стаба и подставляет его адрес в конфигурацию. */
export function setWeatherScenario(next: WeatherScenario): void {
  scenario = next;
  config.WEATHER_API_URL = stubUrl();
}

function defaultDays(): ForecastDayInput[] {
  return Array.from({ length: config.WEATHER_FORECAST_DAYS }, () => ({
    precipitationMm: 0,
    windMaxKmph: 5,
    tempMax: 14,
    tempMin: 5,
  }));
}

export async function stopWeatherStub(): Promise<void> {
  if (server === undefined) return;
  await new Promise<void>((resolve) => {
    server!.close(() => resolve());
  });
  server = undefined;
}