import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";
import Script from "next/script";

const rethinkSans = localFont({
  src: [
    {
      path: "../../public/fonts/RethinkSans-Medium.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/RethinkSans-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-rethink-sans",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#FF5000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Eletromidia | Campo Digital",
  description: "Sistema de Gestão de Ordens de Serviço e Vistorias em Campo - Eletromidia",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Campo Digital",
  },
  icons: {
    icon: "/eletromidia/logo-mobile.png",
    apple: "/eletromidia/logo-mobile.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={rethinkSans.variable}>
      <body className={`${rethinkSans.className} font-sans min-h-screen bg-[#F8FAFC] text-slate-900 antialiased`}>
        <ConvexClientProvider>{children}</ConvexClientProvider>

        {/* Registro do Service Worker para PWA e Suporte Offline */}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('Service Worker Eletromidia registrado com sucesso:', registration.scope);
                  },
                  function(err) {
                    console.log('Falha ao registrar Service Worker:', err);
                  }
                );
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}

