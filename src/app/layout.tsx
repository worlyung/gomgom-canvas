import type { Metadata } from "next";
import "./globals.css";
import { CoreProviders } from "./core-providers";
import { focal, hal, halMono, commitMono, inconsolata } from "@/lib/fonts";
import { BotIdClient } from "botid/client";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: {
    default: "곰곰 캔버스 — AI 디자인 캔버스",
    template: "%s | 곰곰 캔버스",
  },
  description:
    "제안서를 끌어다 놓으면 포스터가 나오는 AI 디자인 캔버스. 생성·참조·부분수정·일괄 다운로드.",
  keywords: ["AI 이미지 생성", "디자인 캔버스", "gpt-image-2"],
  authors: [{ name: "곰곰" }],
  creator: "곰곰",
  publisher: "곰곰",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL!),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "곰곰 캔버스 — AI 디자인 캔버스",
    description: "제안서를 끌어다 놓으면 포스터가 나오는 AI 디자인 캔버스",
    siteName: "곰곰 캔버스",
    images: [
      {
        url: "/og-img-compress.png",
        width: 1200,
        height: 630,
        alt: "Flux Kontext Dev - AI Style Transfer Demo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "곰곰 캔버스 — AI 디자인 캔버스",
    description: "제안서를 끌어다 놓으면 포스터가 나오는 AI 디자인 캔버스",
    creator: "@gomgom",
    site: "@gomgom",
    images: [
      {
        url: "/og-img-compress.png",
        width: 1200,
        height: 630,
        alt: "Flux Kontext Dev - AI Style Transfer Demo",
        type: "image/png",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={[
        hal.variable,
        halMono.variable,
        focal.variable,
        inconsolata.variable,
        commitMono.variable,
      ].join(" ")}
      suppressHydrationWarning
    >
      <head>
        {/* 캔버스 텍스트 레이어용 한글 폰트 (모두 OFL — 상업 사용 자유) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Black+Han+Sans&family=Nanum+Myeongjo:wght@400;700&family=Nanum+Pen+Script&display=swap"
        />
        <meta name="color-scheme" content="dark" />
        <BotIdClient
          protect={[
            {
              path: "/api/trpc/*",
              method: "POST",
            },
            {
              path: "/api/fal",
              method: "POST",
            },
          ]}
        />
      </head>
      <body className={`font-sans bg-background text-foreground min-h-screen`}>
        <CoreProviders>{children}</CoreProviders>
      </body>
      <Analytics />
    </html>
  );
}
