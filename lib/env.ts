const requiredEnv = ['DATABASE_URL'] as const;

export function assertServerEnv(): void {
  for (const key of requiredEnv) {
    if (!process.env[key] || process.env[key]?.trim().length === 0) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
