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
  // Do not bundle native addons; we avoid node binding on Vercel by using onnxruntime-web
  serverExternalPackages: [],
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL
    if (!base) return []
    return [
      { source: '/api/:path*', destination: `${base}/api/:path*` },
    ]
  },
}

export default nextConfig
