/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Keep serverless bundles small
  serverExternalPackages: [],
  outputFileTracingExcludes: {
    "**/*": [
      "data/**",
      "**/*.onnx",
      "**/*.bin",
      "**/*.gguf",
      "**/*.pth",
      "**/*.pt"
    ]
  },
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL
    if (!base) return []
    return [
      { source: '/api/:path*', destination: `${base}/api/:path*` },
    ]
  },
}

export default nextConfig
