import { TableCell } from "@/components/ui/table";
import { TableRow } from "@/components/ui/table";
import { Leaderboard, LeaderboardItem } from "@/services/leaderboard.service";
import { DateTime } from "luxon";
import Link from "next/link";

export interface LeaderboardTableRowProps {
  index: number;
  entry: LeaderboardItem;
  leaderboard: Leaderboard;
}

export function LeaderboardTableRow({
  index,
  entry,
  leaderboard,
}: LeaderboardTableRowProps) {
  const isLLMLeaderboard = leaderboard.promptSetId !== null;

  const RecentRun = () => (
    <TableCell className="text-right text-gray-600">
      {DateTime.fromJSDate(entry.recentEvaluation).toRelative()}
    </TableCell>
  );

  return (
    <TableRow className="hover:cursor-pointer hover:bg-gray-50 transition-colors">
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {index === 0 ? (
            <span className="text-lg" title="Gold Medal">
              🥇
            </span>
          ) : index === 1 ? (
            <span className="text-lg" title="Silver Medal">
              🥈
            </span>
          ) : index === 2 ? (
            <span className="text-lg" title="Bronze Medal">
              🥉
            </span>
          ) : null}
          {index + 1}
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm">
        <Link
          className="underline text-blue-500"
          href={`/leaderboard/details/${entry.model}?${
            isLLMLeaderboard
              ? `promptSet=${leaderboard.promptSetId}`
              : `protocol=${leaderboard.context}`
          }`}
        >
          {entry.model}
        </Link>
      </TableCell>
      {isLLMLeaderboard ? (
        <>
          <TableCell className="text-left">
            <span className="font-semibold text-gray-900">
              {((entry.accuracy || 0) * 100).toFixed(2)}%
            </span>
          </TableCell>
          <RecentRun />
          <TableCell className="text-right text-gray-600">
            {entry.uniquePrompts}
          </TableCell>
          <TableCell className="text-right text-gray-600">
            {entry.totalEvaluations}
          </TableCell>
          <TableCell className="text-right text-gray-600">
            {entry.totalTestsPerformed}
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className="text-right">
            <span className="font-semibold text-gray-900">
              {entry.avgScore?.toFixed(2)}
            </span>
          </TableCell>
          <RecentRun />
          <TableCell className="text-right text-gray-600">
            {entry.totalEvaluations}
          </TableCell>
          <TableCell className="text-right text-gray-600">
            {entry.totalTestsPerformed}
          </TableCell>
        </>
      )}
    </TableRow>
  );
}
