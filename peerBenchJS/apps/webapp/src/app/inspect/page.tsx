"use client";

import { InspectTable } from "./components/InspectTable";
import { PageContextProvider, usePageContext } from "./context";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Pagination } from "@/components/Pagination";
import { useSearchParams, useRouter } from "next/navigation";
import React, { useEffect } from "react";

function InspectPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { page, setPage, setPageSize, pageSize, loading, error, items, total } =
    usePageContext();

  // Parse initial values from URL
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialPageSize = parseInt(searchParams.get("pageSize") || "10", 10);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    router.replace(`?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    setPage(initialPage);
    setPageSize(initialPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Inspect</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Here you can view the raw files that includes detailed information
          about the performed evaluations by the participants from the
          decentralized network, prompts uploaded by the users and so on.
        </p>
      </div>

      {loading ? (
        <LoadingSpinner position="block" />
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : (
        <div className="flex flex-col gap-1">
          <InspectTable items={items} />
          <Pagination
            currentPage={page}
            pageSize={pageSize}
            totalItemCount={total}
            isLoading={loading}
            onPageSizeChange={(pageSize) => {
              setPageSize(pageSize);
              setPage(1);
            }}
            onPageChange={(page) => {
              setPage(page);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function InspectPage() {
  return (
    <PageContextProvider>
      <InspectPageContent />
    </PageContextProvider>
  );
}
