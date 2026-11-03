import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OUTPOST // EXODUS — Mission Start Sequence",
  description:
    "A recreation of Sierra's Outpost (1994) mission start screens — destination star select, seed-ship payload manifest, and VLBI probe planet survey — styled after the instrument displays of the Discovery One from 2001: A Space Odyssey. Data-heavy, clean lines, elegant arcs, beautiful math.",
  keywords: [
    "Outpost",
    "Sierra",
    "1994",
    "2001: A Space Odyssey",
    "Discovery One",
    "sci-fi UI",
    "mission start sequence",
    "retro computer interface",
  ],
  icons: {
    icon: "/logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#030304] font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
