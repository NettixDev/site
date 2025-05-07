import './globals.css';

export const metadata = {
  title: 'NettyHost - Premium Hosting Solutions',
  description: 'Fast, reliable, and secure hosting solutions for your business',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
} 