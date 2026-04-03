import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/Portfolio') {
    return NextResponse.redirect(new URL('/portfolio', request.url), 308);
  }

  if (pathname === '/portfolio') {
    return NextResponse.rewrite(new URL('/portfolio-clone/index.html', request.url));
  }

  if (pathname === '/testing') {
    return NextResponse.rewrite(new URL('/portfolio-clone/testing/index.html', request.url));
  }

  if (pathname.startsWith('/testing/')) {
    const assetPath = pathname.replace('/testing/', '/portfolio-clone/testing/');
    return NextResponse.rewrite(new URL(assetPath, request.url));
  }

  if (pathname.startsWith('/public/images/')) {
    const imagePath = pathname.replace('/public/images/', '/portfolio-clone/public/images/');
    return NextResponse.rewrite(new URL(imagePath, request.url));
  }

  return NextResponse.next();
}
