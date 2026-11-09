import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Next on Mom’s Plate",
  description: "A little imagination. A place in line.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
