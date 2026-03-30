import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/pilotage',
        '/commerce',
        '/projets',
        '/technicien',
        '/chef-projet',
        '/rh',
        '/api',
      ],
    },
    sitemap: 'https://oxiflow.fr/sitemap.xml',
  };
}
