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

function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ['P1000', 'P1001', 'P1002', 'P1017'].includes(error.code);
  }

  return false;
}

export function toErrorPayload(error: unknown): { status: number; message: string } {
  if (error instanceof AppError) {
    return { status: error.status, message: error.message };
  }

  const isProd = process.env.NODE_ENV === 'production';

  if (isDatabaseUnavailable(error)) {
    return {
      status: 503,
      message: 'Database unavailable. Verify Railway/Vercel connection settings and retry.'
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      message: isProd ? 'Internal server error' : error.message
    };
  }

  return { status: 500, message: 'Unknown internal error' };
}
