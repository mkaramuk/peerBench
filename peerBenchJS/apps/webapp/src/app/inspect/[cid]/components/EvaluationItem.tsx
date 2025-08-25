"use client";

import { EvaluationData } from "@/services/evaluation.service";
import { ChevronDown } from "lucide-react";
import { DateTime } from "luxon";
import { useState } from "react";
import TestResult from "./TestResults";

export default function EvaluationItem(props: {
  evaluation: EvaluationData;
  index: number;
  onClick?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { evaluation, index, onClick } = props;
  return (
    <div key={evaluation.id} id={index.toString()} className={`space-y-6`}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <button
          onClick={() => {
            setIsExpanded(!isExpanded);
            onClick?.();
          }}
          className="w-full p-6 flex items-center justify-between hover:cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        >
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
            Evaluation #{index + 1}
          </h2>
          <ChevronDown
            className={`w-6 h-6 text-gray-500 dark:text-gray-400 transition-transform ${
              isExpanded ? "transform rotate-180" : ""
            }`}
          />
        </button>

        {isExpanded && (
          <div className="p-6 pt-0 space-y-6">
            <div
              id={`validation-session-${index}-test-info`}
              className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6"
            >
              <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
                Metadata
              </h3>
              <div className="space-y-4">
                {evaluation.sessionId && (
                  <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      Session ID
                    </span>
                    <code className="text-gray-800 dark:text-gray-200">
                      {evaluation.sessionId}
                    </code>
                  </div>
                )}
                {evaluation.promptSetId && (
                  <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      Prompt Set
                    </span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {evaluation.promptSetName} (id: {evaluation.promptSetId})
                    </span>
                  </div>
                )}
                {typeof evaluation.score !== "undefined" &&
                  evaluation.score !== null && (
                    <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="font-medium text-gray-600 dark:text-gray-300">
                        Score
                      </span>
                      <span className="text-gray-800 dark:text-gray-200">
                        {evaluation.score}
                      </span>
                    </div>
                  )}
                {evaluation.startedAt && (
                  <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      Started
                    </span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {DateTime.fromJSDate(evaluation.startedAt).toFormat(
                        "DD TTT"
                      )}
                    </span>
                  </div>
                )}
                {evaluation.finishedAt && (
                  <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      Finished
                    </span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {DateTime.fromJSDate(evaluation.finishedAt).toFormat(
                        "DD TTT"
                      )}
                    </span>
                  </div>
                )}
                {evaluation.startedAt && evaluation.finishedAt && (
                  <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      Duration
                    </span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {DateTime.fromJSDate(evaluation.finishedAt)
                        .diff(DateTime.fromJSDate(evaluation.startedAt))
                        .toFormat("hh:mm:ss")}
                    </span>
                  </div>
                )}
                {evaluation.uploaderId && (
                  <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      Uploader ID
                    </span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {evaluation.uploaderId}
                    </span>
                  </div>
                )}
                {typeof evaluation.agreementId !== "undefined" &&
                  evaluation.agreementId !== null && (
                    <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="font-medium text-gray-600 dark:text-gray-300">
                        Agreement ID
                      </span>
                      <span className="text-gray-800 dark:text-gray-200">
                        {evaluation.agreementId}
                      </span>
                    </div>
                  )}
                {typeof evaluation.offerId !== "undefined" &&
                  evaluation.offerId !== null && (
                    <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="font-medium text-gray-600 dark:text-gray-300">
                        Offer ID
                      </span>
                      <span className="text-gray-800 dark:text-gray-200">
                        {evaluation.offerId}
                      </span>
                    </div>
                  )}
                {typeof evaluation.providerId !== "undefined" &&
                  evaluation.providerId !== null && (
                    <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="font-medium text-gray-600 dark:text-gray-300">
                        Provider ID
                      </span>
                      <span className="text-gray-800 dark:text-gray-200">
                        {evaluation.providerId}
                      </span>
                    </div>
                  )}
              </div>
            </div>

            <div
              id={`validation-session-${index}-test-results`}
              className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6"
            >
              <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
                Test Results
              </h3>
              <div className="space-y-6">
                {evaluation.testResults.map((test, index) => (
                  <TestResult key={index} index={index} test={test} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
