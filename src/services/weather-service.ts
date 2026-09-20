import { z } from 'zod';

import { config } from '../config.js';
import { ExternalServiceError } from '../errors.js';

export interface ForecastDay {
  date: string;
  tempMax: number | null;
  tempMin: number | null;
  precipitationMm: number;
  windMaxKmph: number;
  suitable: boolean;
}

export interface WeatherRule {
  maxWindKmph: number;
  allowedPrecipitationMm: number;
  forecastDays: number;
}

export interface Forecast {
  rule: WeatherRule;
  days: ForecastDay[];
}

const weatherResponseSchema = z
  .object({
    daily: z.object({
      time: z.array(z.string()),
      temperature_2m_max: z.array(z.number().nullable()).default([]),
      temperature_2m_min: z.array(z.number().nullable()).default([]),
      precipitation_sum: z.array(z.number().nullable()).default([]),
      wind_speed_10m_max: z.array(z.number().nullable()).default([]),
    }),
  })
  .passthrough();

const DAILY_PARAMS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'wind_speed_10m_max',
] as const;

export class WeatherService {
  rule(): WeatherRule {
    return {
      maxWindKmph: config.WEATHER_MAX_WIND_MS,
      allowedPrecipitationMm: config.WEATHER_ALLOWED_PRECIPITATION_MM,
      forecastDays: config.WEATHER_FORECAST_DAYS,
    };
  }

  async getForecast(lat: number, lon: number): Promise<Forecast> {
    const url = new URL(config.WEATHER_API_URL);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('daily', DAILY_PARAMS.join(','));
    url.searchParams.set('forecast_days', String(config.WEATHER_FORECAST_DAYS));
    url.searchParams.set('timezone', 'auto');

    let body: unknown;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(config.REQUEST_TIMEOUT_MS) });
      if (!response.ok) {
        throw new Error(`погодный сервис вернул HTTP ${response.status}`);
      }
      body = await response.json();
    } catch (cause) {
      throw new ExternalServiceError('Погодный сервис временно недоступен, повторите попытку позже', { cause });
    }

    const parsed = weatherResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new ExternalServiceError('Погодный сервис вернул некорректные данные');
    }

    const { daily } = parsed.data;
    const days: ForecastDay[] = daily.time.map((date, index) => {
      const precipitationMm = daily.precipitation_sum[index] ?? 0;
      const windMaxKmph = daily.wind_speed_10m_max[index] ?? 0;
      return {
        date,
        tempMax: daily.temperature_2m_max[index] ?? null,
        tempMin: daily.temperature_2m_min[index] ?? null,
        precipitationMm,
        windMaxKmph,
        suitable:
          precipitationMm <= config.WEATHER_ALLOWED_PRECIPITATION_MM &&
          windMaxKmph < config.WEATHER_MAX_WIND_MS,
      };
    });

    return { rule: this.rule(), days };
  }
}