import type { NextConfig } from "next";

const backendUrl = new URL(process.env.BACKEND_ORIGIN || 'http://localhost:8000');
if (!['http:', 'https:'].includes(backendUrl.protocol) || backendUrl.pathname !== '/') {
  throw new Error('BACKEND_ORIGIN must contain only an absolute HTTP(S) origin');
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [{
      source: '/backend/:path*',
      destination: `${backendUrl.origin}/:path*`,
    }];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ],
    }];
  },
};

export default nextConfig;
