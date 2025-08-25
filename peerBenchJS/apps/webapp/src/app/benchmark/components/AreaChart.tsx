"use client";

import { BenchmarkResult } from "../BenchmarkPage";
import { PeerAggregation } from "@/services/prompt.service";
import { formatOrdinal } from "@/string/format-ordinal";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type ChartDataPoint = {
  score: number;
  density?: number;
  count?: number;
  isYourScore: boolean;
};

// Determine z-score color based on value
function getZScoreColor(z: number) {
  if (z >= 1) return "text-green-600"; // Significantly above average
  if (z <= -1) return "text-red-600"; // Significantly below average
  return "text-gray-600"; // Around average
}

// Helper component for yellow info/warning box
function PeerInfoBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">{title}</h3>
          <div className="mt-2 text-sm text-yellow-700">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Helper component for statistics cards grid
function StatisticsCards({
  avgScore,
  stdDev,
  yourScore,
  totalRuns,
  zScore,
  percentile,
  deviation,
}: {
  avgScore: number;
  stdDev?: number;
  yourScore: number;
  totalRuns: number;
  zScore?: number;
  percentile?: number;
  deviation?: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
        <h4 className="text-sm font-medium text-blue-600 mb-1">
          Average Accuracy
        </h4>
        <p className="text-2xl font-bold text-gray-900">
          {(avgScore * 100).toFixed(2)}%
        </p>
      </div>
      {typeof yourScore === "number" && (
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <h4 className="text-sm font-medium text-blue-600 mb-1">
            Your Accuracy
          </h4>
          <p className="text-2xl font-bold text-gray-900">
            {(yourScore * 100).toFixed(2)}%
          </p>
        </div>
      )}
      <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
        <h4 className="text-sm font-medium text-gray-500 mb-1">Total Runs</h4>
        <p className="text-2xl font-bold text-gray-900">{totalRuns}</p>
      </div>
      {typeof stdDev === "number" && (
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <h4 className="text-sm font-medium text-gray-500 mb-1">
            Standard Deviation
          </h4>
          <p className="text-2xl font-bold text-blue-700">
            {(stdDev * 100).toFixed(2)}pp
          </p>
        </div>
      )}
      {typeof zScore === "number" && (
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <h4 className="text-sm font-medium text-gray-500 mb-1">
            Z-Score of Your Accuracy
          </h4>
          <p className={`text-2xl font-bold ${getZScoreColor(zScore)}`}>
            {zScore.toFixed(2)}
          </p>
        </div>
      )}
      {typeof percentile === "number" && (
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <h4 className="text-sm font-medium text-gray-500 mb-1">
            Percentile Placement
          </h4>
          <p className="text-2xl font-bold text-gray-900">
            {formatOrdinal(Math.round(percentile))}
          </p>
        </div>
      )}
      {typeof deviation === "number" && (
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <h4
            className="text-sm font-medium text-gray-500 mb-1"
            title="Deviation of your accuracy from peer average accuracy"
          >
            Deviation from Average
          </h4>
          <p
            className={`text-2xl font-bold ${deviation >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            {(deviation * 100).toFixed(2)}pp
          </p>
        </div>
      )}
    </div>
  );
}

export function AreaChart(props: {
  result: BenchmarkResult;
  peerAggregations: PeerAggregation[];
}) {
  const { result, peerAggregations } = props;

  // Find matching peer aggregation for this model and include current result
  const peerAggregation = peerAggregations.find(
    (agg) => agg.modelId === result.modelId
  );

  if (!peerAggregation) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between w-full">
          <h3 className="text-xl font-bold text-gray-900">
            Model - {result.provider} / {result.modelName}
          </h3>
        </div>
        <PeerInfoBox title="No Peer Data Available">
          <p>There is no peer aggregation data available for this model yet.</p>
          <p className="mt-1">This could be because:</p>
          <ul className="list-disc list-inside mt-1">
            <li>
              The model is new and hasn&apos;t been benchmarked by peers yet
            </li>
          </ul>
          <p className="mt-1">
            Your accuracy:{" "}
            <span className="text-green-600">
              {(result.avgScore * 100).toFixed(2)}%
            </span>
          </p>
        </PeerInfoBox>
      </div>
    );
  }

  // Create a modified peer aggregation that includes the current result
  const modifiedPeerAggregation = {
    ...peerAggregation,
    runs: [...peerAggregation.runs, result.avgScore],
    statistics: {
      avgScore:
        (peerAggregation.statistics.avgScore * peerAggregation.runs.length +
          result.avgScore) /
        (peerAggregation.runs.length + 1),
      stdDev: Math.sqrt(
        (peerAggregation.statistics.stdDev *
          peerAggregation.statistics.stdDev *
          peerAggregation.runs.length +
          Math.pow(result.avgScore - peerAggregation.statistics.avgScore, 2)) /
          (peerAggregation.runs.length + 1)
      ),
    },
  };

  // Error function approximation
  const erf = (x: number) => {
    const sign = Math.sign(x);
    x = Math.abs(x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1.0 / (1.0 + p * x);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  };

  // Calculate z-score using modified data
  const zScore =
    (result.avgScore - modifiedPeerAggregation.statistics.avgScore) /
    modifiedPeerAggregation.statistics.stdDev;

  // Calculate percentile (using normal distribution)
  const percentile = 0.5 * (1 + erf(zScore / Math.sqrt(2))) * 100;

  // Calculate deviation from mean
  const deviation =
    result.avgScore - modifiedPeerAggregation.statistics.avgScore;

  // Gaussian kernel function
  const gaussianKernel = (x: number, mean: number, bandwidth: number) => {
    return (
      (1 / (bandwidth * Math.sqrt(2 * Math.PI))) *
      Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(bandwidth, 2)))
    );
  };

  // Epanechnikov kernel function
  // const epanechnikovKernel = (x: number, mean: number, bandwidth: number) => {
  //   const u = (x - mean) / bandwidth;
  //   if (Math.abs(u) > 1) return 0;
  //   return (0.75 * (1 - u * u)) / bandwidth;
  // };

  // Generate data points for the bell curve using KDE
  const generateBellCurveData = () => {
    if (!modifiedPeerAggregation.runs.length) {
      return [];
    }

    const mean = modifiedPeerAggregation.statistics.avgScore;
    const stdDev = modifiedPeerAggregation.statistics.stdDev;
    // Use Silverman's rule of thumb for bandwidth selection
    const bandwidth =
      0.9 *
      Math.min(
        stdDev,
        modifiedPeerAggregation.runs.length ** (-1 / 5) * Math.sqrt(stdDev)
      );

    // Ensure bandwidth is positive and not too small
    const safeBandwidth = Math.max(bandwidth, 0.01);
    // Center the KDE range around the mean (μ ± 3σ)
    const min = mean - 3 * stdDev;
    const max = mean + 3 * stdDev;
    const points = 300;
    const step = (max - min) / points;
    const kdePoints = [];

    for (let x = min; x <= max; x += step) {
      let density = 0;
      for (const value of modifiedPeerAggregation.runs) {
        density += gaussianKernel(x, value, safeBandwidth);
      }
      density /= modifiedPeerAggregation.runs.length;

      kdePoints.push({
        score: x,
        density,
        isYourScore: Math.abs(x - result.avgScore) < step / 2,
      });
    }

    return kdePoints;
  };

  const bellCurveData = generateBellCurveData();
  const data = bellCurveData;

  // Check if we have enough data for meaningful analysis
  const hasEnoughData = modifiedPeerAggregation.runs.length >= 5;

  if (!hasEnoughData) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between w-full">
          <h3 className="text-xl font-bold text-gray-900">
            Model - {result.modelName}
          </h3>
          <div className="flex gap-3 items-center">
            <div>
              Total runs:{" "}
              <span className="text-blue-600">
                {modifiedPeerAggregation.runs.length}
              </span>
            </div>
            <div>
              Your accuracy:{" "}
              <span className="text-green-600">
                {(result.avgScore * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
        <PeerInfoBox title="Insufficient Data for Statistical Analysis">
          <p>
            We need at least 5 benchmark runs to provide meaningful statistical
            analysis. Currently, there are only{" "}
            {modifiedPeerAggregation.runs.length} runs available.
          </p>
          <p className="mt-1">
            Please run more benchmarks to get detailed statistical insights
            about your model&apos;s performance.
          </p>
        </PeerInfoBox>
        {/* Show basic statistics even with limited data */}
        <StatisticsCards
          avgScore={modifiedPeerAggregation.statistics.avgScore}
          yourScore={result.avgScore}
          totalRuns={modifiedPeerAggregation.runs.length}
        />
      </div>
    );
  }

  if (!data.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between w-full">
        <h3 className="text-xl font-bold text-gray-900">
          Model - {result.modelName}
        </h3>
        <div className="flex gap-3 items-center">
          <div>
            Total runs:{" "}
            <span className="text-blue-600">
              {modifiedPeerAggregation.runs.length}
            </span>
          </div>
          <div>
            Your accuracy:{" "}
            <span className="text-green-600">
              {(result.avgScore * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
      {/* Chart */}
      <div className="w-full h-[350px]">
        <Chart
          type="area"
          height={350}
          series={[
            {
              name: "Distribution Density",
              data: data.map((d: ChartDataPoint) => ({
                x: d.score,
                y: d.density,
              })),
            },
          ]}
          options={
            {
              chart: {
                type: "area",
                toolbar: {
                  show: false,
                },
                animations: {
                  enabled: true,
                  speed: 800,
                },
                zoom: {
                  enabled: false,
                },
                pan: {
                  enabled: false,
                },
              },
              dataLabels: {
                enabled: false,
              },
              stroke: {
                curve: "smooth",
                width: 2,
              },
              fill: {
                type: "solid",
                colors: ["#2563eb"],
                opacity: 0.4,
              },
              xaxis: {
                type: "numeric",
                title: {
                  text: "Score",
                },
                labels: {
                  formatter: (val: number) => val.toFixed(3),
                  style: {
                    fontSize: "16px",
                    fontWeight: 600,
                  },
                },
                min:
                  modifiedPeerAggregation.statistics.avgScore -
                  3 * modifiedPeerAggregation.statistics.stdDev,
                max:
                  modifiedPeerAggregation.statistics.avgScore +
                  3 * modifiedPeerAggregation.statistics.stdDev,
              },
              yaxis: {
                title: {
                  text: "Density",
                },
                labels: {
                  formatter: (val: number) => Math.round(val).toString(),
                  style: {
                    fontSize: "16px",
                    fontWeight: 600,
                  },
                },
              },
              tooltip: {
                y: {
                  formatter: (value: string) => Number(value).toFixed(4),
                },
                x: {
                  formatter: (value: string) => Number(value).toFixed(3),
                },
              },
              annotations: {
                xaxis: [
                  // Z-score annotation for user's score
                  {
                    x: result.avgScore,
                    borderColor: "#10B981",
                    label: {
                      text: `Your Accuracy (z = ${zScore.toFixed(2)})`,
                      style: {
                        color: "#fff",
                        background: "#10B981",
                        fontSize: "14px",
                        fontWeight: 700,
                      },
                      offsetY: -10,
                    },
                  },
                  // Zero stddev (mean)
                  {
                    x: modifiedPeerAggregation.statistics.avgScore,
                    borderColor: "#111827",
                    strokeDashArray: 0,
                    label: {
                      text: "μ (0σ)",
                      style: {
                        color: "#fff",
                        background: "#111827",
                        fontSize: "18px",
                        fontWeight: 700,
                      },
                      offsetY: -10,
                    },
                  },
                  // Sigma points
                  {
                    x:
                      modifiedPeerAggregation.statistics.avgScore -
                      modifiedPeerAggregation.statistics.stdDev,
                    borderColor: "#666",
                    strokeDashArray: 4,
                    strokeWidth: 3,
                    label: {
                      text: "-1σ",
                      style: {
                        color: "#222",
                        background: "rgba(100,100,100,0.15)",
                        fontSize: "18px",
                        fontWeight: 700,
                      },
                      offsetY: -10,
                    },
                  },
                  {
                    x:
                      modifiedPeerAggregation.statistics.avgScore +
                      modifiedPeerAggregation.statistics.stdDev,
                    borderColor: "#666",
                    strokeDashArray: 4,
                    strokeWidth: 3,
                    label: {
                      text: "+1σ",
                      style: {
                        color: "#222",
                        background: "rgba(100,100,100,0.15)",
                        fontSize: "18px",
                        fontWeight: 700,
                      },
                      offsetY: -10,
                    },
                  },
                  {
                    x:
                      modifiedPeerAggregation.statistics.avgScore -
                      2 * modifiedPeerAggregation.statistics.stdDev,
                    borderColor: "#666",
                    strokeDashArray: 2,
                    strokeWidth: 3,
                    label: {
                      text: "-2σ",
                      style: {
                        color: "#222",
                        background: "rgba(100,100,100,0.15)",
                        fontSize: "18px",
                        fontWeight: 700,
                      },
                      offsetY: -10,
                    },
                  },
                  {
                    x:
                      modifiedPeerAggregation.statistics.avgScore +
                      2 * modifiedPeerAggregation.statistics.stdDev,
                    borderColor: "#666",
                    strokeDashArray: 2,
                    strokeWidth: 3,
                    label: {
                      text: "+2σ",
                      style: {
                        color: "#222",
                        background: "rgba(100,100,100,0.15)",
                        fontSize: "18px",
                        fontWeight: 700,
                      },
                      offsetY: -10,
                    },
                  },
                ],
              },
              colors: ["#8884d8"],
              grid: {
                borderColor: "#e5e7eb",
                strokeDashArray: 3,
              },
            } as unknown as ApexOptions
          }
        />
      </div>
      {/* Statistics Cards */}
      <StatisticsCards
        avgScore={modifiedPeerAggregation.statistics.avgScore}
        stdDev={modifiedPeerAggregation.statistics.stdDev}
        yourScore={result.avgScore}
        totalRuns={modifiedPeerAggregation.runs.length}
        zScore={zScore}
        percentile={percentile}
        deviation={deviation}
      />
    </div>
  );
}
