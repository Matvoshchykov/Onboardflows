import { WhopApp } from "@whop/react/components";
import type { Metadata, Viewport } from "next";
import { Inter } from 'next/font/google';
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FlowBuilder - Professional Onboarding Flow Builder",
  description: "Create beautiful, data-driven onboarding flows for your SAAS product",
  generator: 'v0.dev',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <WhopApp>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster
              position="bottom-left"
              richColors
              closeButton
            />
          </ThemeProvider>
        </WhopApp>
      </body>
    </html>
  );
}
