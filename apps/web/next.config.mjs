/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@runground/shared-types", "@runground/db"],
  
  // API 프록시 설정 (CORS 해결)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*",
      },
    ];
  },
};

export default nextConfig;
