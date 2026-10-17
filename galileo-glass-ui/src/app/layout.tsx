import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Galileo — The Glass Observatory",
  description:
    "An interactive Galileo Glass UI component atlas, physics laboratory, and PostGIS-powered hello world.",
  icons: { icon: "/orbit.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
