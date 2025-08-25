import { LeaderboardService } from "@/services/leaderboard.service";
import { LeaderboardTable } from "./components/LeaderboardTable";

export default async function LeaderboardPage() {
  const leaderboards = await LeaderboardService.getLeaderboards();
  if (leaderboards.length === 0) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-4">
        No leaderboards available.
      </div>
    );
  }

  // The leaderboard that has the most recent test evaluation, will be at the top
  leaderboards.sort((a, b) => {
    // Get the most recent entry from each leaderboard
    const aMostRecentRun = Math.max(
      ...a.entries.map((entry) => entry.recentEvaluation.getTime())
    );
    const bMostRecentRun = Math.max(
      ...b.entries.map((entry) => entry.recentEvaluation.getTime())
    );

    return bMostRecentRun - aMostRecentRun;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">
            Model Leaderboard
          </h2>
        </div>

        <div className="space-y-4">
          {leaderboards.map((leaderboard) => (
            <LeaderboardTable key={leaderboard.context} data={leaderboard} />
          ))}
        </div>
      </div>
    </div>
  );
}
