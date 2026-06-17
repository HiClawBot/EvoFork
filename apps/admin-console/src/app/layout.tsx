import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EvoFork Admin",
  description: "Local EvoFork admin console"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
