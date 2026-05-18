import { QueryClient, QueryClientProvider } from "@buildingai/services";
import { ReactNode } from "react";

import { ExtensionMainLayout } from "./main";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error && typeof error === "object" && "status" in error && error.status === 401) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

export const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ExtensionMainLayout>{children}</ExtensionMainLayout>
    </QueryClientProvider>
  );
};
