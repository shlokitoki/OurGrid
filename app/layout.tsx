import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'OurGrid — Keep the lights on', description: "Keep the lights on for the neighbors who can't afford to lose them. A live demo on one Burbank street during a heat wave." };
export default function RootLayout({ children }: {children: React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
