import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Blusk Leads", template: "%s · Blusk Leads" },
  description: "Encontre clientes reais, aborde pelo WhatsApp e acompanhe tudo num CRM simples. Feito para freelancers criativos.",
  applicationName: "Blusk Leads",
  appleWebApp: { capable: true, title: "Blusk Leads", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#3443d9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
