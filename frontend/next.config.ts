import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy all /api/* and /ws/* calls to the local FastAPI backend.
  // This means only ONE ngrok URL (the frontend) is needed — the Next.js
  // server forwards requests to the backend running on localhost:8000.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/:path*",
      },
      {
        source: "/ws/:path*",
        destination: "http://localhost:8000/ws/:path*",
      },
    ];
  },
};

export default nextConfig;
