"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { readTaskFromContent, SchemaName, Task } from "@peerbench/sdk";
import LoadingSpinner from "@/components/LoadingSpinner";
import { z } from "zod";
import {
  addPromptsToPromptSet,
  createPromptSet,
} from "@/app/actions/prompt-set";
import PromptFilePreview from "@/components/PromptFilePreview";
import { InfoIcon } from "@/components/ui/icons";
import ValidSchemas from "./components/ValidSchemas";
import PromptSetSelector, {
  PromptSetOption,
} from "@/components/PromptSetSelector";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";

export const fetchCache = "force-no-store";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPredefinedSet, setSelectedPredefinedSet] =
    useState<PromptSetOption>();
  const [detectedSchema, setDetectedSchema] = useState<string>("");
  const [isNonPeerbenchSchema, setIsNonPeerbenchSchema] = useState(false);
  const [convertedFile, setConvertedFile] = useState<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);

  const cleanUp = () => {
    setFile(null);
    setError("");
    setTask(null);
    setDetectedSchema("");
    setSelectedPredefinedSet(undefined);
    setIsNonPeerbenchSchema(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (
        selectedFile.type !== "application/json" &&
        !selectedFile.name.endsWith(".jsonl")
      ) {
        setError("Please upload a JSON or JSONL file");
        return;
      }
      setFile(selectedFile);
      setIsUploading(true);
      setIsNonPeerbenchSchema(false);

      try {
        const content = await selectedFile.arrayBuffer();
        const { task: taskResult, schema } = await readTaskFromContent(
          content,
          selectedFile.name
        );

        setTask(taskResult);
        setDetectedSchema(schema.name);

        // Check if the file is not in peerbench schema

        if (schema.name !== SchemaName.pb) {
          setConvertedFile(JSON.stringify(taskResult.prompts));
          setIsNonPeerbenchSchema(true);
        }
      } catch (err) {
        if (err instanceof z.ZodError) {
          setError(
            err.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("\n")
          );
        } else {
          setError(err instanceof Error ? err.message : "Invalid file format");
        }
        setFile(null);
        setTask(null);
        setDetectedSchema("");
        setIsNonPeerbenchSchema(false);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleDownloadConverted = () => {
    if (!task || !convertedFile) {
      return;
    }

    try {
      const blob = new Blob([convertedFile], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${task.fileName.replace(/\.[^/.]+$/, "")}.peerbench.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading converted file:", error);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || (task?.prompts.length || 0) === 0) {
      setError("Please select a valid file");
      return;
    }

    if (!selectedPredefinedSet) {
      setError("Please select or create a prompt set");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      // If the file is converted, then use it.
      const fileContent = convertedFile || (await file.text());
      let promptSetId: number;

      // If the chosen prompt set is new, then create it.
      if (selectedPredefinedSet.__isNew__) {
        const promptSet = await createPromptSet({
          title: selectedPredefinedSet.label,
          description: selectedPredefinedSet.description,
        });
        promptSetId = promptSet.id;
      } else {
        promptSetId = Number(selectedPredefinedSet.value);
      }

      await addPromptsToPromptSet({
        promptSetId,
        fileContent,
        fileName: file.name,
      });

      setSuccessMessage(`File uploaded successfully!`);
      cleanUp();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center p-4 h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl relative"
      >
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 rounded-2xl z-10 flex items-center justify-center">
            <div className="text-center">
              <LoadingSpinner position="block" />
              <p className="mt-4 text-gray-700 dark:text-gray-300">
                Uploading your prompts...
              </p>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-400 rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gray-800 dark:bg-gray-200 p-6 text-center">
            <h1 className="text-2xl font-bold text-gray-100 dark:text-gray-800">
              Upload Prompts
            </h1>
            <p className="text-gray-300 dark:text-gray-800 mt-2">
              Upload your JSON or JSONL file containing prompts
            </p>
          </div>
          <div className="p-8">
            <form onSubmit={onSubmit} className="space-y-6">
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-green-600 dark:text-green-400 font-bold text-xl text-center"
                >
                  {successMessage}
                </motion.div>
              )}

              {isNonPeerbenchSchema && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
                >
                  <div className="flex items-start space-x-3">
                    <InfoIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                        Your file was detected as{" "}
                        <strong>{detectedSchema}</strong> format and will be
                        converted to the peerbench schema for use. The converted
                        version maintains all your data while ensuring
                        compatibility. If you want you can download this
                        converted version.
                      </p>
                      <Button
                        type="button"
                        disabled={isLoading}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDownloadConverted();
                        }}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-800 rounded-md hover:bg-amber-200 dark:hover:bg-amber-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-4 h-4 mr-1"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Download Converted File
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {selectedPredefinedSet && !selectedPredefinedSet.__isNew__ && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start space-x-3"
                >
                  <InfoIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    New prompts from your file will be appended to the selected
                    prompt set.
                  </p>
                </motion.div>
              )}

              <PromptSetSelector
                selectedPredefinedSet={selectedPredefinedSet}
                onPredefinedSetChange={setSelectedPredefinedSet}
                disabled={isLoading}
              />

              <div>
                {!file && <ValidSchemas />}
                <FileInput
                  accept={["application/json", "application/jsonl"]}
                  onChange={handleFileChange}
                  buttonClassName="w-full"
                  variant="outline"
                  size="lg"
                />
              </div>

              {isUploading && (
                <div className="text-center">
                  <LoadingSpinner />
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Validating file contents...
                  </p>
                </div>
              )}

              {task && task.prompts.length > 0 && (
                <PromptFilePreview prompts={task.prompts} />
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-500 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800 whitespace-pre-line"
                >
                  <div className="flex items-start gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5 mt-0.5 flex-shrink-0"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div>{error}</div>
                  </div>
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={
                  isLoading ||
                  !file ||
                  (task?.prompts.length || 0) === 0 ||
                  !selectedPredefinedSet
                }
                className="w-full"
                size="lg"
              >
                {isLoading ? "Uploading..." : "Upload"}
              </Button>
            </form>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
