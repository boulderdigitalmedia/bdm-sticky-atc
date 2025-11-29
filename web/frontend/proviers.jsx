import {
  AppProvider as ShopifyAppProvider,
  useAppBridge,
} from "@shopify/app-bridge-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";

const queryClient = new QueryClient();

export function AppBridgeProvider({ children }) {
  return (
    <ShopifyAppProvider>
      {children}
    </ShopifyAppProvider>
  );
}

export function PolarisProvider({ children }) {
  return <PolarisAppProvider>{children}</PolarisAppProvider>;
}

export function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
