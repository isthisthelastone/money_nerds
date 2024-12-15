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
    viewportFit: 'cover',
},
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
    <body
    className="min-h-screen h-screen w-full overflow-hidden bg-gradient-to-b from-blue-900 via-blue-600 to-blue-300 bg-fixed safe-top safe-bottom safe-left safe-right flex flex-col items-center">
    <main className="flex-1 w-full px-safe">
    {children}
    </main>
    </body>
    </html>
  );
}
