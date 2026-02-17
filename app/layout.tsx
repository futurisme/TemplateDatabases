import './globals.css';
import type { Metadata } from 'next';
import { VersionBadge } from '@/components/VersionBadge';

export const metadata: Metadata = {
  title: 'TemplateDatabase - Global Open Source Template Hub',
  description:
    'Platform global untuk menyimpan template open source universal: kode, ide, cerita, dan lainnya dengan smart search super cepat.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        {children}
        <VersionBadge />
      </body>
    </html>
  );
}
