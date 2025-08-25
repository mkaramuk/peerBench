import { EvaluationSource } from "@/types/evaluation-source";
import { TestResult as TestResultType } from "@/validation/test-result";
import { DateTime } from "luxon";

export default function TestResult(props: {
  index: number;
  test: TestResultType;
}) {
  const { index, test } = props;

  return (
    <div
      id={`validation-session-${index}-test-${index}`}
      className={`border-2 rounded-xl p-6 transition-all duration-300 ${
        test.isSuccess
          ? "border-green-200 bg-white dark:bg-gray-800"
          : "border-red-200 bg-white dark:bg-gray-800"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200">
          {test.testName}
        </h4>
        <span
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            test.isSuccess
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }`}
        >
          {test.isSuccess ? "Success" : "Failed"}
        </span>
      </div>
      {test.raw && (
        <div className="mt-4">
          <h5 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Raw:
          </h5>
          <div className="text-sm font-mono whitespace-pre-wrap break-words mb-4 bg-gray-50 border dark:bg-gray-700 p-4 rounded-lg">
            {test.raw}
          </div>
        </div>
      )}
      {test.result && (
        <div className="mt-4">
          <h5 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Result Details:
          </h5>
          <div className="bg-gray-50 border dark:bg-gray-700 p-4 rounded-lg overflow-x-auto text-sm">
            {typeof test.result === "object" && test.result !== null ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {Object.entries(test.result).map(([key, value]) => {
                  const isString = typeof value === "string";
                  const isObject = typeof value === "object";
                  const isLong = isString ? value.length > 40 : false;

                  let formattedValue = String(value);

                  if (
                    isString &&
                    (key === "startedAt" || key === "finishedAt")
                  ) {
                    formattedValue = DateTime.fromISO(String(value)).toFormat(
                      "TTT, DD"
                    );
                  } else if (isObject) {
                    formattedValue = JSON.stringify(value, null, 2);
                  }

                  return (
                    <div
                      key={key}
                      className="py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4"
                    >
                      <span className="w-48 capitalize text-gray-700 dark:text-gray-300 shrink-0">
                        {key
                          .replace(/([A-Z])/g, " $1")
                          .replace(/^./, (s) => s.toUpperCase())}
                      </span>
                      {isLong ? (
                        <pre className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 w-full overflow-x-auto text-xs whitespace-pre-wrap">
                          {formattedValue}
                        </pre>
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100 break-all">
                          {formattedValue}
                        </span>
                      )}
                    </div>
                  );
                })}
                {test.result?.startedAt &&
                  test.result?.finishedAt &&
                  test.result.source === EvaluationSource.PeerBench && (
                    <div className="py-2 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <span className="w-48 capitalize text-gray-700 dark:text-gray-300 shrink-0">
                        Duration
                      </span>
                      <span className="text-gray-900 dark:text-gray-100 break-all">
                        {DateTime.fromISO(test.result.finishedAt)
                          .diff(DateTime.fromISO(test.result.startedAt))
                          .toFormat("hh:mm:ss")}
                      </span>
                    </div>
                  )}
              </div>
            ) : (
              <span>{String(test.result)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
