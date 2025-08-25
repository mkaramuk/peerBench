import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react";
import { FileListItem } from "@/services/file.service";
import { getFiles } from "./actions";

interface PageContextValue {
  items: FileListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  pageSize: number;
  setPageSize: Dispatch<SetStateAction<number>>;
  handlePageSizeChange: (size: number) => void;
}

const PageContext = createContext<PageContextValue | undefined>(undefined);

interface PageContextProviderProps {
  children: ReactNode;
  initialPage?: number;
  initialPageSize?: number;
}

export const PageContextProvider = ({ children }: PageContextProviderProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [items, setItems] = useState<FileListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  // Load results
  useEffect(() => {
    setLoading(true);
    setError(null);
    getFiles({
      page,
      pageSize,
    })
      .then((data) => {
        setItems(data.results);
        setTotal(data.total);
      })
      .catch((err) => {
        setError(err.message || "Failed to fetch audit files");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page, pageSize]);

  return (
    <PageContext.Provider
      value={{
        items,
        total,
        loading,
        error,
        page,
        setPage,
        pageSize,
        setPageSize,
        handlePageSizeChange,
      }}
    >
      {children}
    </PageContext.Provider>
  );
};

export function usePageContext() {
  const ctx = useContext(PageContext);
  if (!ctx)
    throw new Error("usePageContext must be used within a PageContextProvider");
  return ctx;
}
