import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

import { BadRequestError, ValidationError } from '../errors.js';

type RequestPart = 'body' | 'query' | 'params';

interface ValidatedRequestPart {
  field: string;
  message: string;
}

export interface ValidateOptions {
  rangeFields?: readonly string[];
}

export function validate<const S extends Partial<Record<RequestPart, ZodType>>>(
  schemas: S,
  options: ValidateOptions = {},
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.valid = {};

    for (const part of ['body', 'query', 'params'] as const) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (!result.success) {
        const details: ValidatedRequestPart[] = result.error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : '(корень)',
          message: issue.message,
        }));
        const rangeFields = options.rangeFields ?? [];
        const outOfRange = rangeFields.length > 0 && details.every((detail) => rangeFields.includes(detail.field));
        next(
          outOfRange
            ? new BadRequestError('Параметры пагинации вне допустимого диапазона', { details })
            : new ValidationError(details),
        );
        return;
      }

      req.valid[part] = result.data;
    }

    next();
  };
}
