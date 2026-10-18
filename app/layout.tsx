import type { Metadata } from "next";
import { Providers } from "@/components/shared/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Newtonite Ops",
  description: "Internal operations work item tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="font-sans antialiased bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}