"use client";

import { Leaderboard } from "@/services/leaderboard.service";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { LeaderboardTableRow } from "./LeaderboardTableRow";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LeaderboardTableProps {
  data: Leaderboard;
}

export function LeaderboardTable({ data }: LeaderboardTableProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLLMLeaderboard = data.promptSetId !== null;

  return (
    <div
      key={data.context}
      className="rounded-lg border border-gray-200 shadow-lg overflow-hidden"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center hover:bg-gray-50 hover:cursor-pointer transition-colors"
      >
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2">
            {isLLMLeaderboard && (
              <>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  Prompt Set
                </span>
                <span className="text-xs text-gray-500">
                  ID: {data.promptSetId}
                </span>
              </>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mt-1">
            {data.context}
          </h3>
          <p className="text-sm text-gray-500">
            {data.entries.length} models ranked
          </p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <Table className="rounded-none">
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:!bg-gray-50">
                    <TableHead className="w-[80px] font-semibold text-gray-700">
                      Rank
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">
                      Model
                    </TableHead>

                    {isLLMLeaderboard ? (
                      <>
                        <TableHead className="text-left font-semibold text-gray-700">
                          Accuracy
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          Recent Evaluation
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          Unique Prompts
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          Total Evaluations
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          Total Prompts Sent
                        </TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="text-right font-semibold text-gray-700">
                          Avg. Score
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          Recent Evaluation
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          Total Evaluations
                        </TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">
                          Total Tests Performed
                        </TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map((entry, index) => (
                    <LeaderboardTableRow
                      key={entry.model}
                      index={index}
                      entry={entry}
                      leaderboard={data}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
