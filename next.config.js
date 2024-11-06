/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  // Add this section to copy Python scripts
  experimental: {
    outputFileTracingIncludes: {
      "/api/**/*": ["./scripts/**/*"],
    },
  },
  output: "standalone",
};

module.exports = nextConfig;
