"use client";

import { useState, useMemo } from "react";
import { EvaluationData } from "@/services/evaluation.service";
import EvaluationItem from "./EvaluationItem";
import Select, { type SingleValue } from "react-select";
import dynamic from "next/dynamic";

type OptionType = {
  value: number;
  label: string;
};

// Create a client-only Select component
const ClientSelect = dynamic(() => Promise.resolve(Select), {
  ssr: false,
}) as typeof Select;

export default function Evaluations(props: { evaluations: EvaluationData[] }) {
  const { evaluations } = props;

  // Extract unique provider IDs from evaluations
  const providerOptions = useMemo(() => {
    const ids = Array.from(
      new Set(
        evaluations
          .map((ev) => (ev.providerId !== undefined ? ev.providerId : null))
          .filter((id): id is number => id !== null && id !== undefined)
      )
    );
    return ids.map((id) => ({ value: id, label: `Provider ${id}` }));
  }, [evaluations]);

  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(
    null
  );
  return (
    <>
      {providerOptions.length > 0 && (
        <div>
          <label
            htmlFor="provider-filter"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Filter by Provider ID
          </label>
          <ClientSelect<OptionType>
            inputId="provider-filter"
            options={providerOptions}
            isClearable
            value={
              providerOptions.find((o) => o.value === selectedProviderId) ||
              null
            }
            onChange={(option: SingleValue<OptionType>) => {
              setSelectedProviderId(option ? option.value : null);
            }}
            className="mt-1"
            classNamePrefix="react-select"
            placeholder="Select Provider ID..."
          />
        </div>
      )}

      <div className="space-y-4">
        {evaluations.map((evaluation, index) => {
          if (
            selectedProviderId !== null &&
            evaluation.providerId !== selectedProviderId
          ) {
            return null; // Skip this session if it doesn't match the filter
          }

          return (
            <EvaluationItem
              key={evaluation.id}
              index={index}
              evaluation={evaluation}
            />
          );
        })}
      </div>
    </>
  );
}
