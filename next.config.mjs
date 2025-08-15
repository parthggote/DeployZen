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
  // Externalize onnxruntime-node CPU package from server bundles
  serverExternalPackages: ['onnxruntime-node'],
  // Ensure proper handling of native addons in Vercel environment
  experimental: {
    serverComponentsExternalPackages: ['onnxruntime-node']
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
