import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'GraceGrid AI — Keep the lights on', description: 'A smarter response to peak demand. Explore a 100-home battery fleet in Mueller, Austin.' };
export default function RootLayout({ children }: {children: React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
