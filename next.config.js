/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    if (process.env.VERCEL === '1') {
      return [
        {
          source: '/api/:path*',
          destination: '/api/proxy/:path*',
        },
      ];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
