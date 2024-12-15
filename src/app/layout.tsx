// RootLayout.tsx
import { ReactNode } from 'react';
import '../styles/global.css';

export const metadata = {
  title: 'money nerds',
  description: 'money nerds money nerds money nerds online',
    icons: '/icon.svg',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-size-screen items-center justify-items-center align-center bg-gradient-to-b from-blue-900 via-blue-600 to-blue-300">
        {children}
      </body>
    </html>
  );
}
