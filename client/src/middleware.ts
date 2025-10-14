import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const accessToken = req.cookies.get('access_token');
  const { pathname } = req.nextUrl;

  // Allow requests for auth pages, static files, and public assets
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') || // Exclude API routes from redirection
    pathname.includes('.') // Assume files with extensions are static assets
  ) {
    return NextResponse.next();
  }

  // If trying to access a protected route without a token, redirect to login
  if (!accessToken) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // If authenticated, allow access
  return NextResponse.next();
}

export const config = {
  // Match all paths except for the ones that start with /api/, /_next/static/, /_next/image/, and /favicon.ico
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
