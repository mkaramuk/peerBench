"use client";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalItemCount: number;
  isLoading?: boolean;
  onPageSizeChange?: (pageSize: number) => void;
  onPageChange?: (page: number, direction: "next" | "prev") => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function Pagination({
  currentPage,
  pageSize,
  totalItemCount,
  isLoading,
  onPageSizeChange,
  onPageChange,
}: PaginationProps) {
  const hasNextPage = currentPage * pageSize < totalItemCount;
  const hasPrevPage = currentPage > 1;

  return (
    <div
      className={cn(
        "bg-white rounded-lg border shadow-sm flex items-center justify-between px-4 py-3 border-t border-gray-200 sm:px-6",
        isLoading && "cursor-progress bg-gray-100"
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="pageSize" className="text-sm text-gray-700">
            Show
          </label>
          <select
            disabled={isLoading}
            id="pageSize"
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-700">entries</span>
        </div>
        <div className="text-sm text-gray-700">
          Showing{" "}
          <span className="font-medium">
            {(currentPage - 1) * pageSize + 1}
          </span>{" "}
          to{" "}
          <span className="font-medium">
            {Math.min(currentPage * pageSize, totalItemCount)}
          </span>{" "}
          of <span className="font-medium">{totalItemCount}</span> results
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => onPageChange?.(currentPage - 1, "prev")}
          disabled={!hasPrevPage || isLoading}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          onClick={() => onPageChange?.(currentPage + 1, "next")}
          disabled={!hasNextPage || isLoading}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
