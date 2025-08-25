"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useTransition } from "react";

export type FilterContextOptionType = {
  value: string;
  label: string;
  type: "promptSet" | "protocol";
};
export type FilterProviderOptionType = {
  value: string;
  label: string;
};

type PageContextValue = {
  isRouting: boolean;
  initialContextFilter: FilterContextOptionType | null;
  initialProviderFilter: FilterProviderOptionType | null;
  contexts: FilterContextOptionType[];
  providers: FilterProviderOptionType[];
  applyContextFilter: (context: FilterContextOptionType | null) => void;
  applyProviderFilter: (provider: FilterProviderOptionType | null) => void;
  navigate: (url: string) => void;
};

const PageContext = createContext<PageContextValue | undefined>(undefined);

export const PageContextProvider = (props: {
  children: React.ReactNode;
  contexts: FilterContextOptionType[];
  providers: FilterProviderOptionType[];
  initialContextFilter?: string;
  initialProviderFilter?: string;
}) => {
  const selectedContextFilter = props.contexts.find(
    (context) => context.value === props.initialContextFilter
  );
  const selectedProviderFilter = props.providers.find(
    (provider) => provider.value === props.initialProviderFilter
  );

  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRouting, startTransition] = useTransition();

  const applyContextFilter = (context: FilterContextOptionType | null) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (context?.type === "promptSet") {
        params.set("promptSet", context.value);
        params.delete("protocol");
      } else if (context?.type === "protocol") {
        params.set("protocol", context.value);
        params.delete("promptSet");
      } else {
        params.delete("promptSet");
        params.delete("protocol");
      }

      // Reset page to 1 if it's set
      if (params.has("page")) {
        params.set("page", "1");
      }

      router.push(`?${params.toString()}`);
    });
  };

  const applyProviderFilter = (provider: FilterProviderOptionType | null) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (!provider) {
        params.delete("provider");
      } else {
        params.set("provider", provider.value);
      }

      router.push(`?${params.toString()}`);
    });
  };

  const navigate = (url: string) => {
    startTransition(() => {
      // If the URL starts with ?, treat it as search params to merge
      if (url.startsWith("?")) {
        const newParams = new URLSearchParams(url.substring(1));
        const currentParams = new URLSearchParams(searchParams.toString());

        // Merge the new params with existing ones
        for (const [key, value] of newParams.entries()) {
          currentParams.set(key, value);
        }

        router.push(`?${currentParams.toString()}`);
      } else {
        // For absolute URLs, navigate directly
        router.push(url);
      }
    });
  };

  return (
    <PageContext.Provider
      value={{
        isRouting,
        initialContextFilter: selectedContextFilter || null,
        initialProviderFilter: selectedProviderFilter || null,
        contexts: props.contexts,
        providers: props.providers,
        applyContextFilter,
        applyProviderFilter,
        navigate,
      }}
    >
      {props.children}
    </PageContext.Provider>
  );
};

export const usePageContext = () => {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error("usePageContext must be used within a PageContextProvider");
  }
  return context;
};
