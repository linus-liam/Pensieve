import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pensieve — Structured Reflection",
  description:
    "An AI-guided thinking companion that helps you explore, clarify, and reframe your thoughts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
