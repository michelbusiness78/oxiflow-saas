import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Supabase Storage — buckets publics (logos, photos, etc.)
        protocol: 'https',
        hostname: '*.supabase.co',
        port:     '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
