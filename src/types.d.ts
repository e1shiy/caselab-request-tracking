declare global {
  namespace Express {
    interface Request {
      valid: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export {};