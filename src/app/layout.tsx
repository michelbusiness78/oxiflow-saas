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
  icons: {
    icon:     '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <head>
        <meta name="theme-color" content="#1B2A4A" />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
