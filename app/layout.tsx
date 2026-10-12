import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grizzlies Game Tracker",
  description: "Who's going to which Memphis Grizzlies home game.",
};

export const viewport: Viewport = { themeColor: "#12173F", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
