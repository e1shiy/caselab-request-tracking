import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { config } from '../config.js';
import { openApiDocument } from '../docs/openapi.js';

// Swagger UI сам умеет хранить Bearer-токен (persistAuthorization), но
// вставлять его приходится через модальное окно Authorize. Небольшой скрипт
// добавляет поле прямо на странице: токен кладётся в тот же ключ localStorage,
// который читает Swagger UI, поэтому «Try it out» сразу уходит авторизованным.
const tokenInjectorScript = `
(function () {
  var STORAGE_KEY = 'authorized';

  function readState() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function saveToken(value) {
    var state = readState();
    if (value) {
      state.bearerAuth = {
        name: 'bearerAuth',
        schema: { type: 'http', scheme: 'bearer' },
        value: value,
      };
    } else {
      delete state.bearerAuth;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  window.addEventListener('load', function () {
    var saved = readState();
    var field = document.createElement('div');
    field.style.cssText =
      'margin:16px 0;padding:12px;border:1px solid #d9d9d9;border-radius:4px;' +
      'font-family:system-ui,sans-serif;font-size:13px;background:#fafafa';
    field.innerHTML =
      '<strong>access-токен для Try it out</strong><br>' +
      '<small>Получите токен запросом POST /api/auth/login и вставьте поле accessToken ' +
      'из ответа. Значение сохраняется в localStorage браузера этого домена.</small><br>' +
      '<input id="caselab-token" size="72" style="margin-top:8px;padding:4px" ' +
      'placeholder="eyJhbGciOiJIUzI1NiIs..."> ' +
      '<button id="caselab-apply" style="padding:4px 10px">Применить</button> ' +
      '<button id="caselab-clear" style="padding:4px 10px">Сбросить</button>';

    var anchor = document.querySelector('.swagger-ui .info') || document.body;
    anchor.insertBefore(field, anchor.firstChild);

    var input = document.getElementById('caselab-token');
    input.value = (saved.bearerAuth && saved.bearerAuth.value) || '';

    document.getElementById('caselab-apply').addEventListener('click', function () {
      saveToken(input.value.trim());
      window.location.reload();
    });
    document.getElementById('caselab-clear').addEventListener('click', function () {
      saveToken('');
      window.location.reload();
    });
  });
})();
`;

export function createDocsRouter(): Router {
  const router = Router();

  router.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  // swaggerUi.serve — это пара middleware (инициализация и статика), её
  // нужно подключать через router.use: иначе статические файлы UI
  // (swagger-ui-init.js, swagger-ui.css) попадали бы в 404 и в authenticate().
  router.use(swaggerUi.serve);

  router.get(
    '/',
    swaggerUi.setup(openApiDocument as never, {
      customJs: tokenInjectorScript,
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 1,
        tryItOutEnabled: true,
      },
    }),
  );

  return router;
}

export const docsEnabled = config.DOCS_ENABLED;