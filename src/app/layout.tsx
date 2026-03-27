import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OxiFlow — Gestion PME intelligente',
  description: 'Pilotez votre entreprise avec OxiFlow : commerce, projets, RH et agent vocal IA.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
