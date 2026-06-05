/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: { instrumentationHook: false },
  async rewrites() {
    // /api/* → AIS backend. Внутри docker-сети ais_net — по имени сервиса.
    // Для локальной разработки можно переопределить через BACKEND_INTERNAL_URL.
    const backend = process.env.BACKEND_INTERNAL_URL || 'http://backend:3001';
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
