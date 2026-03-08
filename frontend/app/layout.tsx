import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TechBuddy AI — Phone Help for Everyone",
  description:
    "Real-time AI assistant that helps elderly users navigate smartphone apps through voice guidance and screen analysis.",
  keywords: ["elderly", "phone help", "AI assistant", "accessibility", "TechBuddy"],
  authors: [{ name: "TechBuddy AI" }],
  openGraph: {
    title: "TechBuddy AI — Phone Help for Everyone",
    description: "Real-time AI phone navigation assistant",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0e1a" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
