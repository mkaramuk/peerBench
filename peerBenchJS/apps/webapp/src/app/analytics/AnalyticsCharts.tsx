"use client";

import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { PromptSetAnalytics } from "@/services/prompt.service";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

interface AnalyticsChartsProps {
  analytics: PromptSetAnalytics;
}

export default function AnalyticsCharts({ analytics }: AnalyticsChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Prompt Sets Over Time */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Prompt Sets Over Time
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics.promptSetsByDate}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#8884d8"
                name="Prompt Sets"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top Prompt Sets by Answers */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Top Prompt Sets by Answers
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.topPromptSets}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="title"
                angle={-45}
                textAnchor="end"
                height={70}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {label}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Total Answers: {data.answerCount}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Accuracy: {(data.accuracy * 100).toFixed(1)}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="answerCount" fill="#8884d8" name="Answers" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top Prompt Sets by Prompts */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Top Prompt Sets by Prompts
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.topPromptSets}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="title"
                angle={-45}
                textAnchor="end"
                height={70}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {label}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Total Prompts: {data.promptCount}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Total Answers: {data.answerCount}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="promptCount" fill="#82ca9d" name="Prompts" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Correct Answers Distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Correct Answers by Prompt Set
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.answerDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="title"
                angle={-45}
                textAnchor="end"
                height={70}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {label}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Correct Answers: {data.correctAnswers}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Accuracy: {(data.accuracy * 100).toFixed(1)}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="correctAnswers"
                fill="#82ca9d"
                name="Correct Answers"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Total Answers Distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Total Answers by Prompt Set
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.answerDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="title"
                angle={-45}
                textAnchor="end"
                height={70}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {label}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Total Answers: {data.totalAnswers}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Prompts: {data.promptCount}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="totalAnswers" fill="#8884d8" name="Total Answers" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Feedback Distribution */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Feedback Distribution
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={analytics.feedbackStats}
                dataKey="count"
                nameKey="flag"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {analytics.feedbackStats.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
