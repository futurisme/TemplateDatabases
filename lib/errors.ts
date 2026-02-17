import { Prisma } from '@prisma/client';

export class AppError extends Error {
  status: number;
  expose: boolean;

  constructor(message: string, status = 500, expose = true) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.expose = expose;
  }
}

function getPrismaAvailabilityIssue(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return 'Database initialization failed';
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return 'Database engine panic';
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (['P1000', 'P1001', 'P1002', 'P1017'].includes(error.code)) {
      return `Database connectivity issue (${error.code})`;
    }

    if (['P2021', 'P2022'].includes(error.code)) {
      return `Database schema issue (${error.code}). Run migrations.`;
    }
  }

  return null;
}

export function toErrorPayload(error: unknown): { status: number; message: string } {
  if (error instanceof AppError) {
    return { status: error.status, message: error.message };
  }

  const issue = getPrismaAvailabilityIssue(error);
  if (issue) {
    return {
      status: 503,
      message: `${issue} Verify Railway/Vercel settings and migration status, then retry.`
    };
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (error instanceof Error) {
    return {
      status: 500,
      message: isProd ? 'Internal server error' : error.message
    };
  }

  return { status: 500, message: 'Unknown internal error' };
}
