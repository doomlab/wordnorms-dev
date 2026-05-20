const { withBlitz } = require("@blitzjs/next")

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  serverExternalPackages: ["sodium-native", "secure-password"],
}

module.exports = withBlitz(nextConfig)
