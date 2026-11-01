import './globals.css';

export const metadata = { title: 'Lite Chat' };
export const viewport = { width: 'device-width', initialScale: 1, interactiveWidget: 'resizes-content' };
export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
