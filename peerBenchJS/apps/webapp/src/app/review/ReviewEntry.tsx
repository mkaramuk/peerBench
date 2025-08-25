"use client";

import { useState } from "react";
import { PromptSet } from "@/services/prompt.service";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function ReviewEntry({ items }: { items: PromptSet[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="w-full space-y-4">
      {items.map((set, idx) => (
        <div
          key={set.id}
          className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-950"
        >
          <button
            className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900 hover:cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            onClick={() => toggle(idx)}
            aria-expanded={openIndex === idx}
            aria-controls={`accordion-content-${set.id}`}
            id={`accordion-header-${set.id}`}
            type="button"
          >
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {set.title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {set.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                {set.questionCount !== undefined && (
                  <span>Questions: {set.questionCount}</span>
                )}
                {set.totalAnswers !== undefined && (
                  <span>Total Answers: {set.totalAnswers}</span>
                )}
                {set.createdAt && (
                  <span>
                    Created: {new Date(set.createdAt).toLocaleDateString()}
                  </span>
                )}
                {set.updatedAt && (
                  <span>
                    Updated: {new Date(set.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <span
              className={`ml-2 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                openIndex === idx ? "rotate-180" : ""
              }`}
            >
              ▼
            </span>
          </button>
          <div
            id={`accordion-content-${set.id}`}
            role="region"
            aria-labelledby={`accordion-header-${set.id}`}
            className={`border-t border-gray-200 dark:border-gray-800 overflow-hidden transition-all duration-200 ${
              openIndex === idx ? "max-h-96 p-4" : "max-h-0 p-0"
            }`}
            style={{
              transitionProperty: "max-height, padding",
            }}
          >
            {openIndex === idx && (
              <div className="space-y-4">
                <Button asChild variant="default" size="default">
                  <Link href={`/review/${set.id}/${set.firstPromptId}`}>
                    Start Review
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
