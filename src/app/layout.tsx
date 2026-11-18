import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "유학생 공가 대체 과제 제출",
  description: "입국 지연 유학생의 공가 대체 과제 제출·승인",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
