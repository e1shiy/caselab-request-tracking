import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';

import { config } from '../../src/config.js';
import type { Equipment } from '../../src/domain/equipment.js';
import { ExternalServiceError, NotFoundError } from '../../src/errors.js';
import type { EquipmentRepository } from '../../src/repositories/index.js';
import { WeatherService } from '../../src/services/weather-service.js';
import { setWeatherScenario, startWeatherStub, stopWeatherStub } from '../helpers/weather.js';

const equipment: Equipment = {
  id: '33333333-3333-4333-8333-333333333333',
  siteId: '44444444-4444-4444-8444-444444444444',
  name: 'Компрессор',
  type: 'inverter',
  serialNumber: 'TEST-COMP-0001',
  location: { lat: 55.75, lon: 37.62 },
  status: 'operational',
  installedAt: '2024-01-15',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function repositoryWith(equipmentOrNull: Equipment | null): EquipmentRepository {
  return {
    findById: async (id: string) => (equipmentOrNull?.id === id ? equipmentOrNull : null),
  } as unknown as EquipmentRepository;
}

beforeAll(async () => {
  // Стаб поднимается первым: адрес выдаётся случайный порт, и WEATHER_API_URL
  // должен указывать именно на него.
  config.WEATHER_API_URL = await startWeatherStub();
});

afterAll(async () => {
  await stopWeatherStub();
});

beforeEach(() => {
  setWeatherScenario({
    kind: 'ok',
    days: Array.from({ length: config.WEATHER_FORECAST_DAYS }, () => ({
      precipitationMm: 0,
      windMaxKmph: 5,
      tempMax: 14,
      tempMin: 5,
    })),
  });
});

describe('WeatherService.rule', () => {
  it('возвращает пороги из конфигурации', () => {
    const rule = new WeatherService(repositoryWith(equipment)).rule();

    expect(rule.maxWindKmph).toBe(config.WEATHER_MAX_WIND_KMPH);
    expect(rule.allowedPrecipitationMm).toBe(config.WEATHER_ALLOWED_PRECIPITATION_MM);
    expect(rule.forecastDays).toBe(config.WEATHER_FORECAST_DAYS);
  });
});

describe('WeatherService.getForecast', () => {
  const service = new WeatherService(repositoryWith(equipment));

  it('подходит день без осадков и при слабом ветре', async () => {
    const forecast = await service.getForecast(55.75, 37.62);

    expect(forecast.days).toHaveLength(config.WEATHER_FORECAST_DAYS);
    expect(forecast.days.every((day) => day.suitable)).toBe(true);
    expect(forecast.days[0]).toMatchObject({ precipitationMm: 0, windMaxKmph: 5, tempMax: 14 });
  });

  it('день не подходит при ветре выше порога', async () => {
    setWeatherScenario({
      kind: 'ok',
      days: [
        { precipitationMm: 0, windMaxKmph: config.WEATHER_MAX_WIND_KMPH - 1 },
        { precipitationMm: 0, windMaxKmph: config.WEATHER_MAX_WIND_KMPH },
      ],
    });

    const forecast = await service.getForecast(55.75, 37.62);

    // Сравнение строгое «меньше»: ровно порог уже считается непригодным.
    expect(forecast.days[0]?.suitable).toBe(true);
    expect(forecast.days[1]?.suitable).toBe(false);
  });

  it('день не подходит при осадках выше допустимых', async () => {
    setWeatherScenario({
      kind: 'ok',
      days: [
        { precipitationMm: config.WEATHER_ALLOWED_PRECIPITATION_MM, windMaxKmph: 3 },
        { precipitationMm: config.WEATHER_ALLOWED_PRECIPITATION_MM + 0.1, windMaxKmph: 3 },
      ],
    });

    const forecast = await service.getForecast(55.75, 37.62);

    expect(forecast.days[0]?.suitable).toBe(true);
    expect(forecast.days[1]?.suitable).toBe(false);
  });

  it('ошибка погодного сервиса превращается в 502, а не в 500', async () => {
    setWeatherScenario({ kind: 'http-error', status: 503 });

    await expect(service.getForecast(55.75, 37.62)).rejects.toThrow(ExternalServiceError);
    await expect(service.getForecast(55.75, 37.62)).rejects.toThrow(
      'Погодный сервис временно недоступен, повторите попытку позже',
    );
  });

  it('неожиданный формат ответа тоже даёт 502, а не 500', async () => {
    setWeatherScenario({ kind: 'garbage' });

    const error = await service.getForecast(55.75, 37.62).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as ExternalServiceError).message).toBe(
      'Погодный сервис вернул некорректные данные',
    );
  });
});

describe('WeatherService.getForecastForEquipment', () => {
  it('возвращает прогноз вместе с правилом и координатами', async () => {
    const result = await new WeatherService(repositoryWith(equipment)).getForecastForEquipment(
      equipment.id,
    );

    expect(result.equipmentId).toBe(equipment.id);
    expect(result.location).toEqual({ lat: 55.75, lon: 37.62 });
    expect(result.forecast).toHaveLength(config.WEATHER_FORECAST_DAYS);
    expect(result.rule.maxWindKmph).toBe(config.WEATHER_MAX_WIND_KMPH);
  });

  it('неизвестное оборудование даёт 404', async () => {
    await expect(
      new WeatherService(repositoryWith(null)).getForecastForEquipment(equipment.id),
    ).rejects.toThrow(NotFoundError);
  });
});