"use client";

import { PromptSet, PromptSetFeedback } from "@/services/prompt.service";
import { InfoIcon } from "@/components/ui/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useState } from "react";
import { FeedbackFlag } from "@/types/feedback";

interface DataContentProps {
  promptSets: PromptSet[];
  feedbacks: PromptSetFeedback[];
  analytics: {
    totalPromptSets: number;
    totalPrompts: number;
    totalAnswers: number;
    averageAccuracy: number;
    feedbackStats: {
      flag: FeedbackFlag;
      count: number;
    }[];
  };
}

const FEEDBACK_COLORS: Record<string, string> = {
  incorrect: "#ef4444",
  unclear: "#eab308",
  typo: "#f97316",
  other: "#6b7280",
};

export function DataContent({
  promptSets,
  feedbacks,
  analytics,
}: DataContentProps) {
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null);

  const questionsData = promptSets.map((set) => ({
    name: set.title,
    questions: set.questionCount,
  }));

  const answersData = promptSets.map((set) => ({
    name: set.title,
    answers: set.totalAnswers,
  }));

  const feedbackData = analytics.feedbackStats.map((stat) => ({
    name: stat.flag,
    value: stat.count,
  }));

  return (
    <main className="flex flex-col items-center justify-center p-4 h-full">
      <div className="w-full max-w-7xl space-y-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6">Your Prompt Sets</h1>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-3 px-4">Title</th>
                  <th className="text-left py-3 px-4">Description</th>
                  <th className="text-right py-3 px-4">Questions</th>
                  <th className="text-right py-3 px-4">Answers</th>
                </tr>
              </thead>
              <tbody>
                {promptSets.map((promptSet) => (
                  <tr
                    key={promptSet.id}
                    className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="py-3 px-4 font-medium">{promptSet.title}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      <div
                        className="max-w-md truncate"
                        title={promptSet.description}
                      >
                        {promptSet.description}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {promptSet.questionCount}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {promptSet.totalAnswers}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {promptSets.length === 0 && (
            <div className="text-center py-12">
              <InfoIcon className="w-12 h-12 mx-auto text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                No prompt sets found
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Upload your first prompt set to get started.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-6">Statistics</h2>
            <div className="grid grid-cols-2 gap-6">
              <StatCard
                title="Total Prompt Sets"
                value={analytics.totalPromptSets}
              />
              <StatCard title="Total Prompts" value={analytics.totalPrompts} />
              <StatCard title="Total Answers" value={analytics.totalAnswers} />
              <StatCard
                title="Average Accuracy"
                value={`${(analytics.averageAccuracy * 100).toFixed(1)}%`}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-6">
              Feedback Distribution
            </h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={feedbackData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {feedbackData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={FEEDBACK_COLORS[entry.name]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-6">Questions by Set</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={questionsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="questions" fill="#8884d8" name="Questions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-6">Answers by Set</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={answersData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="answers" fill="#82ca9d" name="Answers" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6">Feedbacks</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-3 px-4">Prompt Set</th>
                  <th className="text-left py-3 px-4">Question</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((feedback, index) => (
                  <>
                    <tr
                      key={`${feedback.createdAt?.getDate()}-${index}`}
                      className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="py-3 px-4 font-medium">
                        {feedback.promptSetTitle}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                        <div
                          className="max-w-md truncate"
                          title={feedback.question}
                        >
                          {feedback.question}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-medium ${
                            feedback.flag ? FEEDBACK_COLORS[feedback.flag] : ""
                          }`}
                        >
                          {feedback.flag || "N/A"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {feedback.createdAt
                          ? new Date(feedback.createdAt).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() =>
                            setExpandedFeedback(
                              expandedFeedback ===
                                `${feedback.createdAt?.getDate()}-${index}`
                                ? null
                                : `${feedback.createdAt?.getDate()}-${index}`
                            )
                          }
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {expandedFeedback ===
                          `${feedback.createdAt?.getDate()}-${index}`
                            ? "Hide Details"
                            : "Show Details"}
                        </button>
                      </td>
                    </tr>
                    {expandedFeedback ===
                      `${feedback.createdAt?.getDate()}-${index}` && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-4 px-4 bg-gray-50 dark:bg-gray-700"
                        >
                          <div className="space-y-2">
                            <h4 className="font-medium">Feedback Details</h4>
                            <p className="text-gray-600 dark:text-gray-300">
                              {feedback.feedback || "No feedback provided"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-gray-100 dark:bg-gray-600 rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
        {title}
      </h3>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
