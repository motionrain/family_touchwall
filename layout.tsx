import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import CookieBanner from './CookieBanner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HR Touchwall • Familien-Planer',
  description: 'Haus Richter Familien-Touchwall, Speisekammer, Kalender & Scanner',
  manifest: '/manifest.json',
  themeColor: '#111418',
  icons: {
    icon: '/icon-512.png',
    shortcut: '/icon-512.png',
    apple: '/icon-512.png',
  },
    verification: {
    google: 'y2OaPBwehEoUY3u83wDCGA-Mjo2tCuWiNXnOxcmTdAM',
  },
  openGraph: {
    title: 'HR Touchwall • Familien-Planer',
    description: 'Haus Richter Familien-Touchwall & Pocket-Scanner',
    images: [
      {
        url: '/icon-512.png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HR Touchwall • Familien-Planer',
    images: [
      {
        url: '/icon-512.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={inter.className}>{children}
  <CookieBanner />
</body>
    </html>
  );
}
