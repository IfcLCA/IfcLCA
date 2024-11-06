/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Allow production builds to complete even with type errors
    ignoreBuildErrors: true,
  },
  experimental: {
    outputFileTracingIncludes: {
      "/api/**/*": ["./scripts/**/*"],
    },
  },
  output: "standalone",
};

module.exports = nextConfig;
