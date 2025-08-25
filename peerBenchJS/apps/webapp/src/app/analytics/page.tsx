import { PromptSetService } from "@/services/prompt.service";
import { Card } from "@/components/ui/card";
import AnalyticsCharts from "./AnalyticsCharts";

export default async function DataPage() {
  const analytics = await PromptSetService.getAnalytics();

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Analytics Dashboard
      </h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Prompt Sets
          </h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {analytics.totalPromptSets}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Prompts
          </h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {analytics.totalPrompts}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Answers
          </h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {analytics.totalAnswers}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Average Accuracy
          </h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {(analytics.averageAccuracy * 100).toFixed(1)}%
          </p>
        </Card>
      </div>

      {/* Charts */}
      <AnalyticsCharts analytics={analytics} />
    </div>
  );
}
