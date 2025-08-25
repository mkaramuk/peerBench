"use client";

import dynamic from "next/dynamic";

import { usePageContext } from "../context";
import Select from "react-select";

const ClientSelect = dynamic(() => Promise.resolve(Select), {
  ssr: false,
}) as typeof Select;

export default function Filters() {
  const pageContext = usePageContext();

  return (
    <div className="bg-white rounded-lg shadow-md border p-3 my-2 flex flex-col gap-3">
      <h3 className="text-lg font-medium">Filters</h3>
      <div className="flex gap-3">
        {/*  <label
          htmlFor="context-filter"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Filter by Provider ID
        </label> */}
        <ClientSelect
          isDisabled={pageContext.isRouting}
          inputId="context-filter"
          options={pageContext.contexts}
          isClearable
          value={pageContext.initialContextFilter}
          onChange={(option) => pageContext.applyContextFilter(option)}
          className="w-[30%]"
          classNamePrefix="react-select"
          placeholder="Context"
        />
        <ClientSelect
          isDisabled={pageContext.isRouting}
          inputId="provider-filter"
          options={pageContext.providers}
          isClearable
          value={pageContext.initialProviderFilter}
          onChange={(option) => pageContext.applyProviderFilter(option)}
          className="w-[30%]"
          classNamePrefix="react-select"
          placeholder="Provider"
        />
      </div>
    </div>
  );
}
