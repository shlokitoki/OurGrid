import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: "OurGrid — Protect patients before the outage", description: "OurGrid keeps older patients on home medical devices safe before the power goes out, not after. Live demo with fictional patients in Los Angeles and Delhi." };
export default function RootLayout({ children }: {children: React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
