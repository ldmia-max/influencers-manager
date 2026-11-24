import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empaqueta el servidor y solo las dependencias que realmente usa en
  // .next/standalone, para que la imagen de Docker no lleve node_modules
  // entero. Lo consume el Dockerfile del despliegue en Dokploy.
  output: "standalone",
  // pptxgenjs y sharp (el informe en PowerPoint) se cargan tal cual
  // desde node_modules: sharp trae binarios nativos y pptxgenjs decide
  // en tiempo de ejecucion si esta en Node o en un navegador.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pptxgenjs", "sharp"],
  experimental: {
    webpackMemoryOptimizations: true
  },
  cacheComponents: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
        ]
      }
    ]
  }
};

export default nextConfig;
