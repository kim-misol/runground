/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@runground/shared-types", "@runground/db"],
  
  // API 프록시 설정 (CORS 해결)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        // 변경 전: "http://localhost:3001/api/:path*"
        // 변경 후: 127.0.0.1로 명시
        destination: "http://127.0.0.1:3001/api/:path*",
      },
    ];
  },
};

export default nextConfig;
