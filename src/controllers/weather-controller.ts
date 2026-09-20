import { NotFoundError } from '../errors.js';
import { asyncHandler } from '../lib/async-handler.js';
import type { EquipmentRepository } from '../repositories/equipment-repository.js';
import type { IdParams } from '../schemas/equipment.js';
import type { WeatherService } from '../services/weather-service.js';

export class WeatherController {
  constructor(
    private readonly equipmentRepo: EquipmentRepository,
    private readonly weather: WeatherService,
  ) {}

  getForecast = asyncHandler(async (req, res) => {
    const { id } = req.valid.params as IdParams;

    const equipment = await this.equipmentRepo.findById(id);
    if (!equipment) throw new NotFoundError('Оборудование не найдено');

    const forecast = await this.weather.getForecast(equipment.location.lat, equipment.location.lon);

    res.json({
      equipmentId: equipment.id,
      location: equipment.location,
      rule: forecast.rule,
      forecast: forecast.days,
    });
  });
}