"use client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function Header(props: { evaluationCount: number }) {
  const router = useRouter();
  const params = useParams();

  return (
    <>
      <div className="flex w-full justify-between gap-4">
        <Button
          variant="link"
          onClick={() => router.push("/inspect")}
          className="text-lg group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </Button>
        <Button asChild variant="link" className="text-lg text-blue-500">
          <Link href={`/api/files/${params.cid}/download`}>
            <span>Download Audit File</span>
            <Download className="w-5 h-5" />
          </Link>
        </Button>
      </div>

      <div
        id="header"
        className="mb-8 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg"
      >
        <h1 className="text-3xl font-bold mb-2">Evaluation Results</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Audit File CID: {params.cid}
        </p>
        <p className="text-gray-500 dark:text-gray-400">
          Evaluations Count: {props.evaluationCount}
        </p>
      </div>
    </>
  );
}
