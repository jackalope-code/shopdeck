/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy /api/* requests to the Express backend on port 4000 during development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
