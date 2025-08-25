"use client";

import * as React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { DateTime } from "luxon";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { FileListItem } from "@/services/file.service";
import { capitalize } from "@/utils/capitalize";

interface InspectTableProps {
  items: FileListItem[];
}

export const InspectTable = ({ items: results }: InspectTableProps) => {
  const [hoveredUploaderId, setHoveredUploaderId] = React.useState<
    string | null
  >(null);

  return (
    <div className="relative">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>File CID</TableHead>
            <TableHead>Uploader ID</TableHead>
            <TableHead>Uploaded At</TableHead>
            <TableHead>Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                No files available yet.
              </TableCell>
            </TableRow>
          ) : (
            results.map((result, index) => (
              <TableRow
                key={result.cid}
                className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <TableCell>{index + 1}</TableCell>
                <TableCell className="font-mono text-sm">
                  <Link
                    target="_blank"
                    title={result.cid}
                    href={`/inspect/${result.cid}`}
                    className={twMerge(
                      `text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1 border border-transparent transition-all rounded-lg`
                    )}
                  >
                    {result.cid.slice(0, 10)}...
                    {result.cid.slice(-10)}
                  </Link>
                </TableCell>
                <TableCell>
                  <span
                    title={result.uploaderId ?? "Unknown"}
                    className={twMerge(
                      `px-2 py-1 select-none border border-transparent transition-all rounded-lg`,
                      hoveredUploaderId === result.uploaderId &&
                        "bg-yellow-100 border-yellow-300 dark:bg-blue-900/30"
                    )}
                    onMouseEnter={() => setHoveredUploaderId(result.uploaderId)}
                    onMouseLeave={() => setHoveredUploaderId(null)}
                  >
                    {result.uploaderId
                      ? `${result.uploaderId.slice(0, 5)}...${result.uploaderId.slice(-5)}`
                      : "Unknown"}
                  </span>
                </TableCell>
                <TableCell>
                  {DateTime.fromJSDate(result.uploadedAt).toFormat("TTT, DD")}
                </TableCell>
                <TableCell>{capitalize(result.type)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
