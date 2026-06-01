/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Type errors fail the build (CI gate). Do not re-enable ignoreBuildErrors.
    ignoreBuildErrors: false,
  },
}

export default nextConfig
