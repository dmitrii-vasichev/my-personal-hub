import type { Metadata } from "next";
import { Unbounded, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { QueryProvider } from "@/lib/query-provider";
import "./globals.css";

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Personal Hub",
  description: "Centralized personal dashboard and productivity system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${unbounded.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <QueryProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </QueryProvider>
          <Toaster theme="dark" position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
