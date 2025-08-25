"use client";

import { motion } from "framer-motion";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  OpenRouterProvider,
  Task,
  Prompt,
  prompt,
  score,
  ModelInfo,
  NearAIProvider,
  readTaskFromContent,
  aggregate,
  PromptScore,
  AggregatedResult,
  readableTime,
  SchemaName,
  bufferToString,
  LargeLanguageModelOwner,
  LargeLanguageModel,
  LargeLanguageModelType,
  LargeLanguageModelOwnerType,
} from "@peerbench/sdk";
import { twMerge } from "tailwind-merge";
import { toast } from "react-toastify";
import Select from "react-select";
import Image from "next/image";
import PromptFilePreview from "@/components/PromptFilePreview";
import { Button } from "@/components/ui/button";
import { User } from "@supabase/supabase-js";
import { getPromptSets, getPeerAggregations } from "./actions";
import { PeerAggregation, PromptSet } from "@/services/prompt.service";
import { FileInput } from "@/components/ui/file-input";
import PromptSetSelect from "./components/PromptSetSelect";
import dynamic from "next/dynamic";
import { AreaChart } from "./components/AreaChart";
import { savePeerBenchResults } from "../actions/save-results";
import { BenchmarkScore, EvaluationFile } from "@/services/evaluation.service";
import { EvaluationSource } from "@/types/evaluation-source";

const CreatableSelect = dynamic(() => import("react-select/creatable"), {
  ssr: false,
});

export const fetchCache = "force-no-store";

export type BenchmarkResult = AggregatedResult & {
  promptsSent: number;
  promptsTotal: number;
};

type LogEntry = {
  message: string;
  type: "info" | "error" | "prompt";
};

type Provider = {
  id: string;
  name: string;
  available: boolean;
  models: ModelInfo[];
  icon?: string;
  loading?: boolean;
};

type SelectOption = {
  value: string;
  label: LargeLanguageModelType;
  owner: LargeLanguageModelOwnerType;
  provider: string;
};

type PromptSetOption = {
  value: number;
  label: string;
  description?: string;
  questionCount?: number;
  __isNew__?: boolean;
};

export default function BenchmarkPage(props: { user: User }) {
  const { user } = props;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [promptPreviews, setPromptPreviews] = useState<Prompt[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedModels, setSelectedModels] = useState<ModelInfo[]>([]);
  const [isStandardFormat, setIsStandardFormat] = useState(true);
  const [promptSets, setPromptSets] = useState<PromptSet[]>([]);
  const [selectedPromptSetId, setSelectedPromptSetId] = useState<number | null>(
    null
  );
  const [promptSetSource, setPromptSetSource] = useState<
    "file" | "existing" | null
  >(null);
  const [selectedPromptSetForSave, setSelectedPromptSetForSave] =
    useState<PromptSetOption | null>(null);
  const [newPromptSetDescription, setNewPromptSetDescription] = useState("");
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const task = useRef<Task | null>(null);
  const taskFileContent = useRef<ArrayBuffer | null>(null);
  const scores = useRef<PromptScore[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [resultsUploaded, setResultsUploaded] = useState(false);
  const [peerAggregations, setPeerAggregations] = useState<PeerAggregation[]>(
    []
  );
  const [isPromptSetLocked, setIsPromptSetLocked] = useState(false);

  // Load prompt sets when component mounts
  useEffect(() => {
    const loadPromptSets = async () => {
      try {
        const result = await getPromptSets();
        if (result.success && result.data) {
          setPromptSets(result.data);
        } else {
          console.error("Failed to load prompt sets:", result.error);
        }
      } catch (error) {
        console.error("Failed to load prompt sets:", error);
      }
    };
    loadPromptSets();
  }, []);

  const handlePromptSetSelect = async (
    newTask: Task,
    fileName: string,
    promptSetId: number
  ) => {
    try {
      setError(null);
      setPromptPreviews([]);
      setIsStandardFormat(true);

      // Create a virtual file for display purposes
      const taskFile = new File(
        [JSON.stringify(newTask.prompts, null, 2)],
        fileName,
        {
          type: "application/json",
        }
      );
      setSelectedFile(taskFile);
      task.current = newTask;
      setPromptPreviews(newTask.prompts);
      setPromptSetSource("existing");
      setSelectedPromptSetId(promptSetId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load prompt set"
      );
      setPromptPreviews([]);
      setSelectedPromptSetId(null);
    }
  };

  const addLog = useCallback((message: string, type: LogEntry["type"]) => {
    setLog((prevLog) => [...prevLog, { message, type }]);
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [log]);

  // Initialize providers and load models
  useEffect(() => {
    const openRouterApiKey = localStorage.getItem("openrouter_api_key");
    const nearAiToken = localStorage.getItem("nearai_auth_token");

    setProviders([
      {
        id: "openrouter.ai",
        name: "OpenRouter",
        available: true,
        models: [],
        icon: "/openrouter.svg",
        loading: true,
      },
      {
        id: "near.ai",
        name: "Near AI",
        available: true,
        models: [],
        icon: "/nearai.png",
        loading: true,
      },
    ]);

    const updateProviderState = (
      providerId: string,
      state: Partial<Provider>
    ) => {
      setProviders((prev) =>
        prev.map((provider) =>
          provider.id === providerId ? { ...provider, ...state } : provider
        )
      );
    };

    if (openRouterApiKey) {
      const provider = new OpenRouterProvider({ apiKey: openRouterApiKey });
      provider
        .getSupportedModels()
        .then((models) =>
          updateProviderState("openrouter.ai", {
            models: models.filter((model) => model !== undefined),
          })
        )
        .catch((e) => console.error(e))
        .finally(() =>
          updateProviderState("openrouter.ai", { loading: false })
        );
    } else {
      updateProviderState("openrouter.ai", {
        available: false,
        loading: false,
      });
    }

    if (nearAiToken) {
      const provider = new NearAIProvider({ apiKey: nearAiToken });
      const providerName = provider.name.toLowerCase();

      updateProviderState(providerName, { loading: true });
      provider
        .getSupportedModels()
        .then((models) =>
          updateProviderState(providerName, {
            models: models.filter((model) => model !== undefined),
          })
        )
        .catch((e) => {
          console.error(e);

          // Fallback to the hardcoded models
          updateProviderState(providerName, {
            models: [
              {
                id: "fireworks::accounts/fireworks/models/qwq-32b",
                name: LargeLanguageModel[LargeLanguageModelOwner.Qwen].QwQ_32b,
                owner: LargeLanguageModelOwner.Qwen,
                provider: providerName,
                host: "fireworks",
              },
              {
                id: "fireworks::accounts/fireworks/models/deepseek-v3",
                name: LargeLanguageModel[LargeLanguageModelOwner.Deepseek].V3,
                owner: LargeLanguageModelOwner.Deepseek,
                provider: providerName,
                host: "fireworks",
              },
              {
                id: "fireworks::accounts/fireworks/models/llama-v3p1-8b-instruct",
                name: LargeLanguageModel[LargeLanguageModelOwner.Meta]
                  .Llama_3_1_8b_Instruct,
                owner: LargeLanguageModelOwner.Meta,
                provider: providerName,
                host: "fireworks",
              },
            ],
          });
        })
        .finally(() => updateProviderState("near.ai", { loading: false }));
    } else {
      updateProviderState("near.ai", { available: false, loading: false });
    }
  }, []);

  /**
   * Aggregates the given scores and updates the results state.
   */
  const aggregateScores = async () => {
    const aggregation = await aggregate(scores.current);
    setResults((old) => {
      const newData = old.map((result) => {
        const newResult = aggregation.results.find(
          (r) => r.modelId === result.modelId
        );

        if (!newResult) {
          return result;
        }

        return {
          ...newResult,
          promptsSent: scores.current.filter(
            (s) => s.modelId === result.modelId
          ).length,
          promptsTotal: result.promptsTotal,
        };
      });

      console.log("newData", newData);
      return newData;
    });
  };

  const handleModelSelection = (
    selectedOptions: SelectOption[],
    providerName: string
  ) => {
    setSelectedModels((prev) => {
      // Remove previous selections for this provider
      const filtered = prev.filter((m) => m.provider !== providerName);

      // Add new selections for this provider
      const newSelections: ModelInfo[] = selectedOptions.map((option) => ({
        provider: providerName,
        id: option.value,
        name: option.label,
        owner: option.owner,
        host: "auto",
      }));
      return [...filtered, ...newSelections];
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setSelectedFile(selectedFile);
      setError(null);
      setPromptPreviews([]);
      setIsStandardFormat(true);

      try {
        taskFileContent.current = await selectedFile.arrayBuffer();
        const { task: taskResult, schema } = await readTaskFromContent(
          taskFileContent.current,
          selectedFile.name
        );

        if (schema.name !== SchemaName.pb) {
          setError(
            "Your task file doesn't follow standard PeerBench format. Please use the 'Convert to PB Format' button to convert it. Then use the converted file for benchmarking."
          );
          // Store the task temporarily for conversion
          task.current = taskResult;
          setPromptPreviews(task.current.prompts);
          setIsStandardFormat(false);
          return;
        }

        task.current = taskResult;
        setPromptPreviews(task.current.prompts);
        setPromptSetSource("file");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid file format");
        setPromptPreviews([]);
        setSelectedFile(null);
      }
    }
  };

  const handleConvertToPB = async () => {
    if (!task.current) {
      toast.error("No task file selected");
      return;
    }

    try {
      const blob = new Blob([JSON.stringify(task.current.prompts)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${task.current.fileName.replace(/\.[^/.]+$/, "")}.peerbench.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to convert file");
      console.error("Error converting file:", error);
    }
  };

  const handleAbort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addLog("Benchmark aborted by user", "error");
      setIsLoading(false);
    }
  }, [addLog]);

  const loadAnalysis = async (promptSetId: number) => {
    const peerAggregations = await getPeerAggregations(promptSetId);
    if (peerAggregations.success && peerAggregations.data) {
      console.log("peerAggregations", peerAggregations.data);
      setPeerAggregations(peerAggregations.data);
      setShowComparison(true);
    } else {
      console.error(
        "Failed to fetch peer aggregations:",
        peerAggregations.error
      );
    }
  };

  const handleBenchmark = useCallback(async () => {
    if (!selectedFile && !selectedPromptSetId) {
      setError("Please select a task file or prompt set first");
      addLog("Please select a task file or prompt set first", "error");
      return;
    }

    if (selectedModels.length === 0) {
      setError("Please select at least one model");
      addLog("Please select at least one model", "error");
      return;
    }

    if (!promptSetSource) {
      setError("Please select a prompt set source first");
      addLog("Please select a prompt set source first", "error");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResultsUploaded(false);
    setShowComparison(false);
    setPeerAggregations([]);
    setIsPromptSetLocked(true);
    setResults(
      selectedModels.map((sel) => ({
        promptsSent: 0,
        promptsTotal: task.current?.prompts.length || 0,
        provider: sel.provider,
        modelId: sel.id,
        modelName: sel.name,
        modelOwner: sel.owner,
        modelHost: sel.host || "auto",
        totalResponses: 0,
        totalLatency: 0,
        avgLatency: 0,
        avgScore: 0,
        missingAnswers: 0,
        runIds: [],
        score: 0,
        taskFiles: {},
        wrongAnswers: 0,
      }))
    );

    scores.current = [];
    addLog("Benchmark started", "info");

    // Create new AbortController for this benchmark run
    abortControllerRef.current = new AbortController();

    try {
      const openRouterApiKey = localStorage.getItem("openrouter_api_key");
      const nearAiToken = localStorage.getItem("nearai_auth_token");

      if (!openRouterApiKey && !nearAiToken) {
        toast.error("Please set your API keys in the settings.");
        return;
      }

      // Create one provider instance per provider type
      const openRouterProvider = openRouterApiKey
        ? new OpenRouterProvider({ apiKey: openRouterApiKey })
        : undefined;
      const nearAiProvider = nearAiToken
        ? new NearAIProvider({ apiKey: nearAiToken })
        : undefined;

      // Map model id to the correct provider instance
      const providerMap: Record<string, OpenRouterProvider | NearAIProvider> =
        {};
      providers.forEach((provider) => {
        if (provider.id === "openrouter.ai" && openRouterProvider) {
          provider.models.forEach((model) => {
            providerMap[model.id] = openRouterProvider;
          });
        }
        if (provider.id === "near.ai" && nearAiProvider) {
          provider.models.forEach((model) => {
            providerMap[model.id] = nearAiProvider;
          });
        }
      });

      await prompt({
        tasks: [task.current!],
        providerAndModels: selectedModels.map((sel) => ({
          provider: providerMap[sel.id],
          modelId: sel.id,
        })),
        systemPrompt:
          "You are an knowledge expert, you are supposed to answer the multi-choice question to derive your final answer as `The answer is ...` without any other additional text or explanation.",
        abortSignal: abortControllerRef.current.signal,
        onPromptSending: (prompt, details) => {
          addLog(
            `Prompt "${prompt.question.data.slice(0, 30)}..." (${
              prompt.did
            } sending to "${details.modelId}"`,
            "prompt"
          );
        },
        onPromptResponse: async (response, details) => {
          const [processedScore] = await score([response]);
          scores.current.push(processedScore);

          await aggregateScores();

          addLog(
            `Response of prompt ${response.prompt!.did} received from model: ${
              details.modelId
            } with score: ${processedScore.score !== undefined ? processedScore.score : "N/A"} and latency: ${(response.finishedAt
              ? response.finishedAt - response.startedAt
              : 0
            ).toFixed(2)} ms`,
            "info"
          );
        },
        onPromptError: async (err, details) => {
          // If the benchmark was aborted, don't log the error
          if (abortControllerRef.current?.signal.aborted) {
            return;
          }

          console.error("Error during benchmarking:", err);
          addLog(
            `Error benchmarking model ${details.modelId}: ${err.message}`,
            "error"
          );

          scores.current.push(details.failedResponse);
          await aggregateScores();
        },
      });
      console.log("scores.current", scores.current);
      console.log("results", results);

      const promptSetId =
        selectedPromptSetId || selectedPromptSetForSave?.value;
      if (!selectedPromptSetForSave?.__isNew__ && promptSetId) {
        await loadAnalysis(promptSetId);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(`Error processing file: ${errorMessage}`);
      addLog(`Error: ${errorMessage}`, "error");
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      addLog("Benchmark completed", "info");
    }
  }, [
    selectedFile,
    selectedPromptSetId,
    selectedModels,
    addLog,
    providers,
    results,
    promptSetSource,
    selectedPromptSetForSave,
  ]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleExportConfig = async () => {
    if (selectedModels.length === 0) {
      toast.error("Please select at least one model first");
      return;
    }

    try {
      const config = {
        selectedModels,
      };

      const blob = new Blob([JSON.stringify(config, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `benchmark-config-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Configuration exported successfully");
    } catch (error) {
      toast.error("Failed to export configuration");
      console.error("Error exporting config:", error);
    }
  };

  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const config = JSON.parse(content);

      // Validate the config structure
      if (!config.selectedModels || !Array.isArray(config.selectedModels)) {
        toast.error("Invalid configuration format");
        return;
      }

      // Set the selected models
      setSelectedModels(config.selectedModels);

      toast.success("Configuration imported successfully");
    } catch (error) {
      toast.error("Failed to import configuration");
      console.error("Error importing config:", error);
    }
  };

  const handleUploadResults = async () => {
    if (!user?.id || !task.current || scores.current.length === 0) {
      toast.error("Cannot save results: missing user or task data");
      return;
    }

    if (promptSetSource === "file" && !selectedPromptSetForSave) {
      toast.error("Please select a prompt set to save the results");
      return;
    }

    if (selectedPromptSetForSave?.__isNew__ && !newPromptSetDescription) {
      toast.error("Please provide a description for the new prompt set");
      return;
    }

    try {
      setIsSaving(true);

      // If a prompt file is uploaded, then
      const promptFileName = selectedFile ? task.current.fileName : undefined;
      const promptFileContent = taskFileContent.current
        ? bufferToString(taskFileContent.current!)
        : undefined;

      const validScores = scores.current.filter(
        (score) => score.score !== undefined && score.finishedAt !== undefined
      ) as BenchmarkScore[];

      const evaluationFile: EvaluationFile = {
        runId: validScores[0].runId,
        scores: validScores,
        startedAt: Math.min(...validScores.map((s) => s.startedAt)),
        finishedAt: Math.max(...validScores.map((s) => s.finishedAt)),
        source: EvaluationSource.PeerBench,
        score: validScores.reduce((acc, s) => acc + s.score, 0),
      };

      const result = await savePeerBenchResults({
        evaluationFileContent: JSON.stringify(evaluationFile),
        evaluationFileName: `evaluation-${new Date()}.json`,
        promptFileName,
        promptFileContent,
        promptSet: {
          id:
            selectedPromptSetForSave?.value || selectedPromptSetId || undefined,
          title: selectedPromptSetForSave?.label,
          description: selectedPromptSetForSave?.__isNew__
            ? newPromptSetDescription
            : undefined,
        },
      });

      toast.success(`${result.count} results saved successfully`);
      setResultsUploaded(true);
    } catch (error) {
      console.error("Error saving results:", error);
      toast.error("Failed to save results");
    } finally {
      setIsSaving(false);
    }
  };

  const totalPrompts =
    (task.current?.prompts.length || 0) * selectedModels.length;
  const promptsSent = results.reduce(
    (acc, result) => acc + result.promptsSent,
    0
  );

  return (
    <main className="max-w-[calc(100vw-5rem)] mx-auto px-4 py-8 bg-gray-50 text-gray-800">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-8"
      >
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-700">Benchmark</h1>
          <div className="flex gap-4">
            <Button
              onClick={handleExportConfig}
              disabled={selectedModels.length === 0}
              title="Export current task file and selected models configuration"
            >
              Export Config
            </Button>
            <Button
              onClick={() => document.getElementById("import-config")?.click()}
              title="Import a previously exported benchmark configuration"
            >
              Import Config
              <input
                id="import-config"
                type="file"
                accept=".json"
                onChange={handleImportConfig}
                className="hidden"
              />
            </Button>
          </div>
        </div>

        {/* Provider and Model Selection */}
        <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Select Models
          </h2>
          <div className="space-y-6">
            {providers.map((provider) => (
              <div key={provider.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {provider.icon && (
                      <div className="w-8 h-8 relative">
                        <Image
                          src={provider.icon}
                          alt={`${provider.name} logo`}
                          fill
                          className="object-contain"
                        />
                      </div>
                    )}
                    <h3 className="text-lg font-medium text-gray-700">
                      {provider.name}
                    </h3>
                  </div>
                  {!provider.available && (
                    <span className="text-sm text-red-500">
                      API key not configured
                    </span>
                  )}
                </div>
                {provider.available && (
                  <div className="relative">
                    {provider.loading ? (
                      <div className="w-full flex just gap-3 py-4">
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
                        <span className="text-gray-500">Loading models...</span>
                      </div>
                    ) : (
                      <Select
                        isMulti
                        options={provider.models.map((model) => ({
                          value: model.id,
                          label: model.name,
                          owner: model.owner,
                          provider: provider.id,
                        }))}
                        value={provider.models
                          .filter((model) =>
                            selectedModels.some(
                              (sel) =>
                                sel.provider === provider.id &&
                                sel.id === model.id
                            )
                          )
                          .map((model) => ({
                            value: model.id,
                            label: model.name,
                            owner: model.owner,
                            provider: provider.id,
                          }))}
                        onChange={(selected) =>
                          handleModelSelection(
                            selected as SelectOption[],
                            provider.id
                          )
                        }
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Select models..."
                        noOptionsMessage={() => "No models available"}
                        closeMenuOnSelect={false}
                        hideSelectedOptions={false}
                        blurInputOnSelect={false}
                        isSearchable={true}
                        formatOptionLabel={(option: SelectOption) => (
                          <div className="flex flex-col">
                            <span className="font-medium">{option.label}</span>
                            <span className="text-sm text-gray-500">
                              {option.owner}
                            </span>
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
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* File Upload and Controls */}
        <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
          <div className="space-y-5">
            <div className="flex flex-col">
              <h2 className="text-xl font-semibold text-gray-700">
                Select Prompt Set
              </h2>
            </div>

            <div className="flex gap-8">
              {/* Left side - File Upload */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  A) Upload Task File
                  <div className="text-xs text-gray-500 my-1">
                    Upload a task file that contains the prompts that are going
                    to be used in the benchmark.
                  </div>
                </label>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-3 items-center">
                    <FileInput
                      accept=".json,.jsonl"
                      onChange={handleFileChange}
                      disabled={isLoading || isPromptSetLocked}
                    />
                    {selectedFile && promptSetSource === "file" && (
                      <span className="text-sm text-gray-500">
                        {selectedFile.name}
                      </span>
                    )}
                  </div>

                  {!isStandardFormat && (
                    <Button
                      onClick={handleConvertToPB}
                      className="w-fit"
                      variant="secondary"
                      title="Convert the current file to PeerBench format"
                      disabled={isPromptSetLocked}
                    >
                      Convert to PB Format
                    </Button>
                  )}

                  {promptSetSource === "file" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Select or Create Prompt Set
                          <div className="text-xs text-gray-500 my-1">
                            Select or create the prompt set that your task file
                            belongs to.
                          </div>
                        </label>
                        <CreatableSelect
                          instanceId="prompt-set-save-select"
                          options={promptSets.map((set) => ({
                            value: set.id,
                            label: set.title,
                            description: set.description,
                            questionCount: set.questionCount,
                          }))}
                          value={selectedPromptSetForSave}
                          onChange={(selected: unknown) => {
                            const option = selected as PromptSetOption;
                            setSelectedPromptSetForSave(option);
                            if (option?.__isNew__) {
                              setNewPromptSetDescription("");
                            } else {
                              setSelectedPromptSetId(option.value);
                            }
                          }}
                          className="react-select-container"
                          classNamePrefix="react-select"
                          placeholder="Select a prompt set or create a new one..."
                          noOptionsMessage={() => "No prompt sets available"}
                          isSearchable={true}
                          isDisabled={
                            isSaving || resultsUploaded || isPromptSetLocked
                          }
                          formatCreateLabel={(inputValue) =>
                            `Create new prompt set "${inputValue}"`
                          }
                          formatOptionLabel={(option: unknown) => {
                            const opt = option as PromptSetOption;
                            return (
                              <div className="flex flex-col">
                                <span className="font-medium">{opt.label}</span>
                                <span className="text-sm text-gray-500">
                                  {opt.questionCount
                                    ? `${opt.questionCount} questions`
                                    : "New prompt set"}
                                </span>
                                {opt.description && (
                                  <span className="text-sm text-gray-500">
                                    {opt.description}
                                  </span>
                                )}
                              </div>
                            );
                          }}
                        />
                      </div>

                      {selectedPromptSetForSave?.__isNew__ && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <textarea
                            value={newPromptSetDescription}
                            onChange={(e) =>
                              setNewPromptSetDescription(e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={3}
                            placeholder="Enter prompt set description"
                            disabled={isPromptSetLocked}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="relative flex items-center">
                <div className="h-32 w-px bg-gray-300"></div>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-gray-500 text-sm font-medium">
                  OR
                </div>
              </div>

              {/* Right side - Prompt Set Selection */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  B) Select Existing Prompt Set
                  <div className="text-xs text-gray-500 my-1">
                    Select one of the existing Prompt sets that already uploaded
                    by users
                  </div>
                </label>
                <PromptSetSelect
                  promptSets={promptSets}
                  isLoading={isLoading}
                  onPromptSetSelect={handlePromptSetSelect}
                  disabled={isPromptSetLocked}
                />
              </div>
            </div>

            {/* Prompt Preview Section */}
            {promptPreviews.length > 0 && isStandardFormat && (
              <PromptFilePreview
                prompts={promptPreviews}
                showCorrectAnswer={true}
              />
            )}

            {error && (
              <div className="text-red-500 text-sm bg-red-50 p-4 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleBenchmark}
                disabled={
                  isLoading ||
                  (!selectedFile && !selectedPromptSetId) ||
                  promptPreviews.length === 0 ||
                  !isStandardFormat
                }
                className="flex-1 py-2 px-4 rounded-md text-white font-medium
                bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                title={
                  !isStandardFormat
                    ? "Please convert the task file to standard PeerBench format first"
                    : !selectedFile && !selectedPromptSetId
                      ? "Please select a task file or prompt set first"
                      : promptPreviews.length === 0
                        ? "No valid prompts found in the task file"
                        : "Run benchmark with selected models"
                }
              >
                {isLoading ? "Running Benchmark..." : "Run Benchmark"}
              </button>

              {isLoading && (
                <button
                  onClick={handleAbort}
                  className="py-2 px-4 rounded-md text-white font-medium
                  bg-red-600 hover:bg-red-700 transition-colors"
                >
                  Abort
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Table */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-700">
                Benchmark Results
              </h2>
              <div className="flex items-center space-x-4">
                {task.current?.prompts.length && (
                  <div className="flex items-center space-x-2">
                    <div className="text-sm text-gray-500">Total Progress:</div>
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-700 font-medium">
                        {promptsSent}
                      </span>
                      <span className="text-gray-500">/</span>
                      <span className="text-gray-500">{totalPrompts}</span>
                      <span className="text-gray-500">prompts</span>
                    </div>
                    {/* Status indicator */}
                    <div className="w-6 h-6 flex items-center justify-center">
                      {isLoading ? (
                        <svg
                          className="animate-spin text-yellow-500 w-5 h-5"
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
                      ) : error ||
                        abortControllerRef?.current?.signal.aborted ? (
                        <svg
                          className="text-red-500 w-5 h-5"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : promptsSent === totalPrompts && totalPrompts > 0 ? (
                        <svg
                          className="text-green-500 w-5 h-5"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      title="The provider of the model"
                    >
                      Provider
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      title="The name of the model"
                    >
                      Model
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      title="Current progress of prompts processed for this model"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      title="Average time taken to process each prompt"
                    >
                      Avg. Latency
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      title="Average score across all prompts (0-1)"
                    >
                      Accuracy
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      title="Breakdown of correct (✓), wrong (✗), and missing (?) answers"
                    >
                      Results
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((result, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {result.provider}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {result.modelName}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        title={`${result.promptsSent} out of ${result.promptsTotal} prompts processed`}
                      >
                        <div className="flex items-center space-x-2">
                          {isLoading &&
                          result.promptsSent < result.promptsTotal ? (
                            <svg
                              className="animate-spin h-4 w-4 text-yellow-500"
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
                          ) : result.promptsSent === result.promptsTotal ? (
                            <svg
                              className="h-4 w-4 text-green-500"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : null}
                          <span>
                            {result.promptsSent} / {result.promptsTotal}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        title={`Total latency: ${readableTime(result.totalLatency)}`}
                      >
                        {readableTime(result.avgLatency)}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        title={`Total score: ${result.score}`}
                      >
                        {(result.avgScore * 100).toFixed(2)}%
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        title={`Total responses: ${result.totalResponses}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div
                            title={`${result.score} correct answers`}
                            className="flex items-center space-x-1"
                          >
                            <span className="text-green-600">✓</span>
                            <span>{result.score}</span>
                          </div>
                          <div
                            title={`${result.wrongAnswers} wrong answers`}
                            className="flex items-center space-x-1"
                          >
                            <span className="text-red-600">✗</span>
                            <span>{result.wrongAnswers}</span>
                          </div>
                          <div
                            title={`${result.missingAnswers} missing/failed prompts`}
                            className="flex items-center space-x-1"
                          >
                            <span className="text-yellow-600">?</span>
                            <span>{result.missingAnswers}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isLoading && promptsSent === totalPrompts && totalPrompts > 0 && (
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleUploadResults}
                  disabled={
                    isSaving ||
                    !user ||
                    resultsUploaded ||
                    (promptSetSource === "file" && !selectedPromptSetForSave)
                  }
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSaving
                    ? "Saving..."
                    : resultsUploaded
                      ? "Saved"
                      : "Save results to registry"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Score Deviation Analysis */}
        {showComparison && peerAggregations.length > 0 && !isLoading && (
          <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200 mb-[30px]">
            <div className="space-y-2 mb-6">
              <h2 className="text-xl font-semibold text-gray-700">
                Benchmark Analysis
              </h2>
              <p className="text-sm text-gray-500">
                The analysis below shows your the performance of the models that
                you&apos;ve selected compared to results that collected by other
                users. Each chart displays distribution of the scores for a
                particular model. The green line indicates your current
                accuracy. You can switch between Bell Curve (KDE) and Histogram
                views to better understand the distribution.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8">
              {results.map((result) => {
                return (
                  <AreaChart
                    key={result.modelId}
                    result={result}
                    peerAggregations={peerAggregations}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Log Output */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Logs</h2>
            <div
              ref={logContainerRef}
              className="h-[500px] overflow-y-auto border border-gray-300 rounded-md p-4 bg-gray-50 font-mono text-sm"
            >
              {log.map((entry, index) => (
                <div
                  key={index}
                  className={`text-black border text-md p-2 rounded-md mb-2 shadow-md transition-transform transform ${
                    entry.type === "error"
                      ? "border-red-500 bg-red-300"
                      : entry.type === "prompt"
                        ? "border-green-500 bg-green-300"
                        : "border-blue-500 bg-blue-300"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{entry.message}</span>
                    <button
                      onClick={() => handleCopy(entry.message)}
                      className={twMerge(
                        "ml-2 px-2 py-1 text-xs font-medium rounded hover:cursor-pointer",
                        entry.type === "error"
                          ? "bg-red-500 text-white hover:bg-red-600"
                          : entry.type === "prompt"
                            ? "bg-green-500 text-white hover:bg-green-600"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                      )}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path d="M7.5 3.375c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 013.75 3.75v1.875C13.5 8.161 14.34 9 15.375 9h1.875A3.75 3.75 0 0121 12.75v3.375C21 17.16 20.16 18 19.125 18h-9.75A1.875 1.875 0 017.5 16.125V3.375z" />
                        <path d="M15 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0017.25 7.5h-1.875A.375.375 0 0115 7.125V5.25zM4.875 6H6v10.125A3.375 3.375 0 009.375 19.5H16.5v1.125c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V7.875C3 6.839 3.84 6 4.875 6z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </main>
  );
}
