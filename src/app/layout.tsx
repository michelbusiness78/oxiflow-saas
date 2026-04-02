import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | OxiFlow — Gestion PME avec IA',
    default:  'OxiFlow — Gestion PME avec IA',
  },
  description:
    'OxiFlow simplifie la gestion de votre PME : devis, factures, interventions terrain, RH. Avec un assistant vocal IA qui vous comprend.',
  metadataBase: new URL('https://oxiflow.fr'),
  openGraph: {
    siteName: 'OxiFlow',
    locale:   'fr_FR',
    type:     'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />

        {/* Apple / iOS */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="OxiFlow" />

        {/* Android / Chrome */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#1a56db" />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
