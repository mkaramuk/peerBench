import { Prompt } from "@peerbench/sdk";
import { useEffect, useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "@radix-ui/react-icons";

interface PromptFilePreviewProps {
  prompts: Prompt[];
  initialVisibleCount?: number;
  showCorrectAnswer?: boolean;
}

export default function PromptFilePreview({
  prompts,
  initialVisibleCount = 5,
  showCorrectAnswer = true,
}: PromptFilePreviewProps) {
  const [visiblePrompts, setVisiblePrompts] = useState(initialVisibleCount);

  const loadMorePrompts = () => {
    setVisiblePrompts((prev) => Math.min(prev + 10, prompts.length));
  };

  useEffect(() => {
    setVisiblePrompts(initialVisibleCount);
  }, [prompts]);

  return (
    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
      <Accordion.Root type="single" collapsible className="w-full">
        <Accordion.Item value="preview" className="border-none">
          <Accordion.Trigger className="w-full flex justify-between items-center text-left group">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              File Preview
            </h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {prompts.length} prompts
              </span>
              <ChevronDownIcon
                className="w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform duration-300 group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </div>
          </Accordion.Trigger>
          <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="mt-4 space-y-4 max-h-96 overflow-y-auto">
              {prompts.slice(0, visiblePrompts).map((prompt, index) => (
                <div
                  key={index}
                  className="border rounded p-3 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                >
                  <p className="font-medium text-gray-800 dark:text-gray-200">
                    {prompt.question.data}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {Object.entries(prompt.options).map(([key, value]) => (
                      <div
                        key={key}
                        className={`text-sm p-2 rounded ${
                          showCorrectAnswer && prompt.answerKey === key
                            ? "bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700"
                            : "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                        }`}
                      >
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {key}:
                        </span>{" "}
                        <span
                          className={`${
                            showCorrectAnswer && prompt.answerKey === key
                              ? "text-green-700 dark:text-green-400"
                              : "text-blue-700 dark:text-blue-400"
                          }`}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                  {showCorrectAnswer && (
                    <p className="mt-2 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-2 rounded border border-green-300 dark:border-green-700">
                      Correct answer: {prompt.answerKey} ({prompt.answer})
                    </p>
                  )}
                </div>
              ))}
              {prompts.length > visiblePrompts && (
                <button
                  onClick={loadMorePrompts}
                  type="button"
                  className="w-full text-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200 hover:cursor-pointer"
                >
                  +{prompts.length - visiblePrompts} more prompts...
                </button>
              )}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  );
}
