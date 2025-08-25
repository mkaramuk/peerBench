import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import Navbar from "@/components/Navbar";
import MainContent from "@/components/MainContent";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "peerBench",
  description: "Decentralized AI benchmarking platform",
};

export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Navbar />
          <div className="min-h-[calc(100vh-64px)] flex overflow-y-auto">
            <MainContent>{children}</MainContent>
          </div>
          <ToastContainer position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
