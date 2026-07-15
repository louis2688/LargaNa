import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "LargaNa | Your ride is ready",
  description: "Book rides across the Philippines with LargaNa."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
