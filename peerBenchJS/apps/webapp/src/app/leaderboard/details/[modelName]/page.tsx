import { EvaluationsTable } from "./components/EvaluationsTable";
import { EvaluationService } from "@/services/evaluation.service";
import Filters from "./components/Filters";
import { PageContextProvider } from "./context";
import { LeaderboardService } from "@/services/leaderboard.service";
import { DateTime } from "luxon";

export default async function Page(props: {
  params: Promise<{ modelName: string }>;
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    protocol?: string;
    promptSet?: string;
    provider?: string;
  }>;
}) {
  const { modelName } = await props.params;
  const model = decodeURIComponent(modelName);

  const awaitedSearchParams = await props.searchParams;
  const page = Number(awaitedSearchParams.page) || 1;
  const pageSize = Number(awaitedSearchParams.pageSize) || 10;
  const protocolName =
    awaitedSearchParams.protocol !== undefined
      ? decodeURIComponent(awaitedSearchParams.protocol)
      : undefined;
  const promptSetId =
    awaitedSearchParams.promptSet !== undefined
      ? Number(awaitedSearchParams.promptSet)
      : undefined;
  const provider =
    awaitedSearchParams.provider !== undefined
      ? decodeURIComponent(awaitedSearchParams.provider)
      : undefined;

  const [evaluations, filters, leaderboardItem] = await Promise.all([
    EvaluationService.getEvaluationsList({
      model,
      page,
      pageSize,
      promptSetId,
      protocolName,
      provider,
    }),
    EvaluationService.getEvaluationsListFilterValues({
      model,
    }),
    LeaderboardService.getLeaderboardItem({
      model,
      promptSetId,
      context: protocolName,
    }),
  ]);

  const providers = filters.providers.map((provider) => ({
    value: provider,
    label: provider,
  }));
  const contexts = [
    ...filters.promptSets.map((promptSet) => ({
      value: promptSet.id.toString(),
      label: promptSet.title,
      type: "promptSet" as const,
    })),
    ...filters.protocols.map((protocol) => ({
      // NOTE: We assume that the protocol name is unique
      value: protocol.name,
      label: protocol.name,
      type: "protocol" as const,
    })),
  ];

  const initialProviderFilter = providers.find((p) => p.value === provider);
  const initialContext = contexts.find(
    (context) =>
      (context.type === "promptSet" &&
        context.value === promptSetId?.toString()) ||
      (context.type === "protocol" && context.value === protocolName)
  );

  const availableLeaderboards = Object.keys(leaderboardItem);
  const leaderboardName =
    availableLeaderboards.length > 1 ? undefined : availableLeaderboards[0];
  const leaderboardInfo = leaderboardName
    ? leaderboardItem[leaderboardName]
    : undefined;
  const renderLeaderboardInfo = () => {
    if (!initialContext || !leaderboardInfo) {
      return null;
    }

    const accuracyAvgScoreText =
      leaderboardInfo.accuracy !== null ? "Accuracy" : "Avg. Score";
    const accuracyAvgScoreValue =
      leaderboardInfo.accuracy !== null
        ? `${(leaderboardInfo.accuracy * 100).toFixed(2)}%`
        : leaderboardInfo.avgScore?.toFixed(2);
    const recentEvaluation = DateTime.fromJSDate(
      leaderboardInfo.recentEvaluation
    );
    const totalTestsPerformedText =
      leaderboardInfo.accuracy !== null
        ? "Total Prompts Sent"
        : "Total Tests Performed";

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                {accuracyAvgScoreText}
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {accuracyAvgScoreValue}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Last Updated
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {recentEvaluation.toFormat("MMM DD")}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {recentEvaluation.toRelative()}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Total Evaluations
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {leaderboardInfo.totalEvaluations}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-600 dark:text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                {totalTestsPerformedText}
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {leaderboardInfo.totalTestsPerformed}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-amber-600 dark:text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  };

  console.log(providers);

  return (
    <PageContextProvider
      contexts={contexts}
      providers={providers}
      initialContextFilter={initialContext?.value}
      initialProviderFilter={initialProviderFilter?.value}
    >
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          {model}
        </h1>
        <div className="mb-8">{renderLeaderboardInfo()}</div>
        <Filters />
        <EvaluationsTable
          evaluations={evaluations.results}
          currentPage={page}
          currentPageSize={pageSize}
          total={evaluations.total}
        />
      </div>
    </PageContextProvider>
  );
}
