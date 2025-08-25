"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { twMerge } from "tailwind-merge";
// import * as yup from "yup";
import { getPromptSetsAction } from "@/actions/getPromptSets";

const CreatableSelect = dynamic(() => import("react-select/creatable"), {
  ssr: false,
});

export interface PromptSetOption {
  label: string;
  description: string;

  // TODO: It should be number
  value?: string;

  __isNew__?: boolean;
  questionCount?: number;
}

// const schema = yup.object().shape({
//   name: yup
//     .string()
//     .required("Prompt set name is required")
//     .min(3, "Prompt set name must be at least 3 characters")
//     .max(100, "Prompt set name must not exceed 100 characters"),
//   description: yup
//     .string()
//     .required("Prompt set description is required")
//     .max(500, "Description must not exceed 500 characters"),
// });

export interface PromptSetSelectorProps {
  selectedPredefinedSet: PromptSetOption | undefined;
  onPredefinedSetChange: (value: PromptSetOption | undefined) => void;
  disabled?: boolean;
}

export default function PromptSetSelector({
  selectedPredefinedSet,
  onPredefinedSetChange,
  disabled,
}: PromptSetSelectorProps) {
  const [promptSets, setPromptSets] = useState<PromptSetOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    getPromptSetsAction()
      .then((sets) => {
        setPromptSets(
          sets.map((set) => ({
            value: set.id.toString(),
            label: set.title,
            description: set.description,
            questionCount: set.questionCount,
          }))
        );
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Failed to fetch prompt sets"
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  // const validateData = (name: string, description: string) => {
  //   try {
  //     schema.validateSync({ name, description }, { abortEarly: false });
  //     return true;
  //   } catch {
  //     return false;
  //   }
  // };

  const isDescriptionDisabled =
    selectedPredefinedSet !== undefined && !selectedPredefinedSet.__isNew__;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div>
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-24 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
        {error}
      </div>
    );
  }

  return (
    <>
      <div>
        <label
          htmlFor="predefinedSet"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Prompt Set Name
        </label>
        <CreatableSelect
          id="predefinedSet"
          value={selectedPredefinedSet}
          onChange={(newValue) => {
            const option = newValue as PromptSetOption | undefined;
            onPredefinedSetChange(option);
          }}
          options={promptSets}
          isDisabled={disabled}
          placeholder="Choose the prompt set that you want to upload to or create a new one"
          className="mt-1"
          classNamePrefix="react-select"
          formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
          formatOptionLabel={(data: unknown) => {
            const option = data as PromptSetOption;
            return (
              <div className="flex flex-col">
                <span className="font-medium">{option.label}</span>
                <div className="flex flex-col gap-0.5">
                  {option.questionCount !== undefined && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {option.questionCount} questions
                    </span>
                  )}
                  {!option.__isNew__ && option.description && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {option.description.length > 100
                        ? `${option.description.slice(0, 100)}...`
                        : option.description}
                    </span>
                  )}
                </div>
              </div>
            );
          }}
          styles={{
            control: (base) => ({
              ...base,
              minHeight: "42px",
              backgroundColor: "white",
              borderColor: "#d1d5db",
              "&:hover": {
                borderColor: "#9ca3af",
              },
            }),
            option: (base, state) => ({
              ...base,
              backgroundColor: state.isSelected
                ? "#EFF6FF"
                : state.isFocused
                  ? "#F3F4F6"
                  : "white",
              color: "#1F2937",
              padding: "8px 12px",
              "&:active": {
                backgroundColor: "#EFF6FF",
              },
            }),
            multiValue: (base) => ({
              ...base,
              backgroundColor: "#EFF6FF",
            }),
            multiValueLabel: (base) => ({
              ...base,
              color: "#1F2937",
            }),
            multiValueRemove: (base) => ({
              ...base,
              color: "#6B7280",
              "&:hover": {
                backgroundColor: "#DBEAFE",
                color: "#1F2937",
              },
            }),
            menu: (base) => ({
              ...base,
              zIndex: 9999,
            }),
          }}
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor="questionSetDescription"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Prompt Set Description
        </label>
        <div className="mt-1">
          <textarea
            id="questionSetDescription"
            value={selectedPredefinedSet?.description}
            onChange={(e) => {
              if (selectedPredefinedSet) {
                onPredefinedSetChange({
                  ...selectedPredefinedSet,
                  description: e.target.value,
                });
              }
            }}
            rows={4}
            disabled={isDescriptionDisabled}
            className={twMerge(
              "w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              "border-gray-300 dark:border-gray-600",
              isDescriptionDisabled ? "bg-gray-100 dark:bg-gray-800" : ""
            )}
            placeholder="Enter a description for your prompt set"
          />
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Provide details about this prompt set, its source, or any other
          relevant information.
        </p>
      </div>
    </>
  );
}
