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
  // Externalize onnxruntime-node from server bundles
  serverExternalPackages: ['onnxruntime-node'],
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL
    if (!base) return []
    return [
      { source: '/api/:path*', destination: `${base}/api/:path*` },
    ]
  },
}

export default nextConfig
