"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/Pagination";
import { DateTime } from "luxon";
import { EvaluationListItem } from "@/services/evaluation.service";
import { usePageContext } from "../context";

interface EvaluationsTableProps {
  evaluations: EvaluationListItem[];
  currentPage: number;
  currentPageSize: number;
  total: number;
}

export function EvaluationsTable({
  evaluations,
  currentPage,
  currentPageSize,
  total,
}: EvaluationsTableProps) {
  const pageContext = usePageContext();
  return (
    <div className="flex flex-col gap-1">
      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Provider(s)</TableHead>
              <TableHead className="w-[180px]">Started at</TableHead>
              <TableHead className="w-[200px]">Finished at</TableHead>
              <TableHead className="w-[100px]">Context</TableHead>
              <TableHead className="w-[80px]">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {evaluations.map((evaluation, i) => (
              <TableRow
                key={i}
                data-disabled={pageContext.isRouting}
                onClick={() => {
                  pageContext.navigate(`/inspect/${evaluation.fileCID}`);
                }}
                className="data-[disabled=true]:cursor-progress data-[disabled=true]:hover:bg-gray-100 data-[disabled=true]:bg-gray-100 cursor-pointer hover:bg-gray-50 border-b border-gray-200"
              >
                <TableCell>{evaluation.providers.join(", ")}</TableCell>
                <TableCell>
                  {DateTime.fromJSDate(evaluation.startedAt).toFormat(
                    "TTT, DD"
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {evaluation.finishedAt
                    ? DateTime.fromJSDate(evaluation.finishedAt).toFormat(
                        "TTT, DD"
                      )
                    : "Not completed"}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {evaluation.promptSetTitle || evaluation.protocolName}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {evaluation.score}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        currentPage={currentPage}
        pageSize={currentPageSize}
        totalItemCount={total}
        isLoading={pageContext.isRouting}
        onPageSizeChange={(pageSize) =>
          pageContext.navigate(`?page=1&pageSize=${pageSize}`)
        }
        onPageChange={(page) =>
          pageContext.navigate(`?page=${page}&pageSize=${currentPageSize}`)
        }
      />
    </div>
  );
}
