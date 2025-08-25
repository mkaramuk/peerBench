import { useState } from "react";
import Select from "react-select";
import { PromptSet } from "@/services/prompt.service";
import { Task } from "@peerbench/sdk";
import { getPromptSetForBenchmark } from "../actions";

type PromptSetSelectProps = {
  promptSets: PromptSet[];
  isLoading: boolean;
  disabled: boolean;
  onPromptSetSelect: (
    task: Task,
    fileName: string,
    promptSetId: number
  ) => void;
};

export default function PromptSetSelect({
  promptSets,
  isLoading,
  onPromptSetSelect,
  disabled,
}: PromptSetSelectProps) {
  const [isLoadingPromptSet, setIsLoadingPromptSet] = useState(false);

  const handlePromptSetSelect = async (promptSetId: number) => {
    try {
      setIsLoadingPromptSet(true);

      const result = await getPromptSetForBenchmark(promptSetId);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to load prompt set");
      }

      const { prompts, fileName } = result.data;

      // Create a virtual task object
      const task: Task = {
        prompts,
        fileName,
        did: `did:task:${promptSetId}`,
        path: fileName,
        cid: "",
        sha256: "",
      };

      onPromptSetSelect(task, fileName, promptSetId);
    } catch (err) {
      console.error("Failed to load prompt set:", err);
    } finally {
      setIsLoadingPromptSet(false);
    }
  };

  return (
    <div className="relative">
      <Select
        instanceId="prompt-set-select"
        options={promptSets.map((set) => ({
          value: set.id,
          label: set.title,
          description: set.description,
          questionCount: set.questionCount,
        }))}
        onChange={(selected) =>
          selected && handlePromptSetSelect(selected.value)
        }
        className="react-select-container"
        classNamePrefix="react-select"
        placeholder="Select a prompt set..."
        noOptionsMessage={() => "No prompt sets available"}
        isSearchable={true}
        isDisabled={isLoadingPromptSet || isLoading || disabled}
        formatOptionLabel={(option) => (
          <div className="flex flex-col">
            <span className="font-medium">{option.label}</span>
            <span className="text-sm text-gray-500">
              {option.questionCount} questions
            </span>
            {option.description && (
              <span className="text-sm text-gray-500">
                {option.description}
              </span>
            )}
          </div>
        )}
        styles={{
          control: (base) => ({
            ...base,
            minHeight: "42px",
            borderColor: "#E5E7EB",
            "&:hover": {
              borderColor: "#9CA3AF",
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
            "&:active": {
              backgroundColor: "#EFF6FF",
            },
          }),
          menu: (base) => ({
            ...base,
            zIndex: 9999,
          }),
        }}
      />
      {isLoadingPromptSet && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <svg
            className="animate-spin h-5 w-5 text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
