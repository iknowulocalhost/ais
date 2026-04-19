/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: { instrumentationHook: false },
};

module.exports = nextConfig;
