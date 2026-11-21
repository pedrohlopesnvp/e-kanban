import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O estoque e o Kanban precisam ser lidos do banco a cada requisição.
  // O cache de componentes do template deixaria saldos e permissões sujeitos a uma casca estática.
  cacheComponents: false,
  partialPrefetching: false,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
