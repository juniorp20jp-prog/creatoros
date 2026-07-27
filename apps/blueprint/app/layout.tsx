import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@repo/ui/styles/globals.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CreatorOS Blueprint",
    template: "%s | CreatorOS Blueprint",
  },
  description:
    "Living product, architecture, roadmap, and decision system for CreatorOS.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
