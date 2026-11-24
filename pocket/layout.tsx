// @ts-nocheck
import React from 'react';

export const metadata = {
  title: 'Touchwall Pocket • Familien-App & Scanner',
  description: 'Mobiler Scanner, Kalender, Aufgaben & Einkaufsliste für die Familien-Touchwall',
  manifest: '/manifest.json',
  themeColor: '#111418',
  icons: {
    icon: '/icon-512.png',
    apple: '/icon-512.png'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TW Pocket'
  },
  // viewportFit: 'cover' aktiviert env(safe-area-inset-top/bottom) auf iPhone & iPad (auf Android = 0px)
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover'
  }
};

export default function PocketLayout({ children }) {
  return <>{children}</>;
}
