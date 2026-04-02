import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/Portfolio') {
    return NextResponse.redirect(new URL('/portfolio', request.url), 308);
  }

  return NextResponse.next();
}
