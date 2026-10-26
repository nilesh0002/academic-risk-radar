/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@academic-risk-radar/shared-types", "@academic-risk-radar/scoring-engine"],
  async rewrites() {
    const apiTarget = process.env.API_INTERNAL_URL || "http://localhost:4000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
