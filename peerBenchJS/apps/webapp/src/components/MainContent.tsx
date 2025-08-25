"use client";

import { twMerge } from "tailwind-merge";

export default function MainContent({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className={twMerge("flex-1 bg-gray-50 transition-all duration-300")}>
      {children}
    </main>
  );
}
