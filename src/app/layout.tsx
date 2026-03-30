import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCProvider } from "@/lib/trpc-provider";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "GPretire.com",
  description: "Financial independence planning for GP/LP investors",
  icons: {
    icon: "/logo.jpeg",
    apple: "/logo.jpeg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider dynamic>
      <html lang="en">
        <body className={`${dmSans.className} antialiased`} style={{ background: "var(--background)", color: "var(--foreground)" }}>
          <TRPCProvider>
            {children}
          </TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
