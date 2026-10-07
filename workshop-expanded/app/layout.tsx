import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "不在辦公室，也能辦公事｜手機、平板與 AI Agent 工作坊",
  description: "蔡濬帆，2026/10/07，致理科技大學 K53。手機、平板加 Agent，是你的好助手。六小時最新工具應用工作坊，包含行動辦公、影音製作、教學遊戲與成果驗收。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
