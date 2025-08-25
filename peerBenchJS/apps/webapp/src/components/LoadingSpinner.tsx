import { twMerge } from "tailwind-merge";

interface LoadingSpinnerProps {
  position?: "fixed" | "block";
}

export default function LoadingSpinner({
  position = "fixed",
}: LoadingSpinnerProps) {
  const containerClasses =
    position === "fixed"
      ? "fixed inset-0 flex items-center justify-center z-50"
      : "relative flex items-center justify-center h-full w-full";

  return (
    <div className={twMerge("bg-opacity-75", containerClasses)}>
      <div className="flex items-center gap-4">
        <span className="text-md text-gray-700 dark:text-gray-200 tracking-wide">
          Loading...
        </span>
        <svg
          className="animate-spin h-8 w-8 text-blue-600 dark:text-gray-300"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    </div>
  );
}
