// RootLayout.tsx

import {ReactNode} from "react";
import "../styles/global.css";
import {ClientProvider} from "./ClientProvider";

// src/app/layout.tsx or src/app/page.tsx (wherever you currently export metadata)

export const metadata = {
    title: "money nerds",
    description: "money nerds money nerds money nerds online",
    // icons can stay here
    icons: "/icon.svg",
};

// Then define a separate export for the viewport:
export const viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
};

export default function RootLayout({children}: { children: ReactNode }) {
    return (
        <html lang="en" className="bg-[#1e3a8a]">
        <body
            className="min-h-screen w-full bg-gradient-to-b from-blue-900 via-blue-600 to-blue-300 bg-fixed pt-[env(safe-area-inset-top)] items-center justify-items-center align-center">
        <ClientProvider>
            {children}
        </ClientProvider>
        </body>
        </html>
    );
}
