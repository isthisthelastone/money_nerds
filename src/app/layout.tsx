// RootLayout.tsx
import { ReactNode } from 'react';
import '../styles/global.css';

export const metadata = {
title: 'money nerds',
description: 'money nerds money nerds money nerds online',
icons: '/icon.svg',
viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
},
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
      <html lang="en">
      <body
        className="min-h-screen w-full bg-gradient-to-b from-blue-900 via-blue-600 to-blue-300 bg-fixed p-safe-top p-safe-bottom items-center justify-items-center align-center">
      {children}
      </body>
      </html>
  );
}
