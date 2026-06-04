import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ValidationProvider } from "@/components/ValidationProvider";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter", 
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "ExcelAudit - Hospital Porter Management Data",
  description: "Validate and audit hospital operational Excel data powered by AI and Rule Engine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-slate-50 text-slate-900`}>
        <ValidationProvider>
          {children}
        </ValidationProvider>
      </body>
    </html>
  );
}
