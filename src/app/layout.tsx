import { Barlow, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/app/components/Toast";
import type { Metadata, Viewport } from "next";

const barlow = Barlow({
  weight: ['400', '500', '700'],
  subsets: ["latin"],
  display: 'swap',
  variable: "--font-barlow",
});

const notoSansThai = Noto_Sans_Thai({
  weight: ['400', '500', '700'],
  subsets: ["thai"],
  display: 'swap',
  variable: "--font-noto-sans-thai",
});

export const metadata: Metadata = {
  title: "Booking System",
  description: "ระบบจองห้องพัก",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${barlow.variable} ${notoSansThai.variable} antialiased bg-background text-foreground`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
