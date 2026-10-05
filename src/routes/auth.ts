import { Router } from 'express';

import { AuthController } from '../controllers/auth-controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { loginRateLimiter } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import type { Storage } from '../repositories/index.js';
import { loginSchema, registerSchema } from '../schemas/auth.js';
import { AuthService } from '../services/auth-service.js';

export function createAuthRouter(storage: Storage): Router {
  const controller = new AuthController(new AuthService(storage.users, storage.transaction));

  const router = Router();

  router.post('/register', validate({ body: registerSchema }), controller.register);
  router.post('/login', loginRateLimiter(), validate({ body: loginSchema }), controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/me', authenticate(), controller.me);

  return router;
}