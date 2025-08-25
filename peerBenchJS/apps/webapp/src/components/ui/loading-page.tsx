"use client";

import { HTMLAttributes, forwardRef } from "react";
import { twMerge } from "tailwind-merge";

type LoadingPageProps = HTMLAttributes<HTMLDivElement>;

const LoadingPage = forwardRef<HTMLDivElement, LoadingPageProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          "flex min-h-screen items-center justify-center bg-white dark:bg-gray-950",
          className
        )}
        {...props}
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-800 dark:border-t-blue-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
);

LoadingPage.displayName = "LoadingPage";

export { LoadingPage };
