import { asyncHandler } from '../lib/async-handler.js';
import type { IdParams } from '../schemas/equipment.js';
import type { WeatherService } from '../services/weather-service.js';

export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  getForecast = asyncHandler(async (req, res) => {
    const { id } = req.valid.params as IdParams;

    res.json(await this.weather.getForecastForEquipment(id));
  });
}
