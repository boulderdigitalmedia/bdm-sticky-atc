import { AppProvider } from "@shopify/polaris";
import { BrowserRouter } from "react-router-dom";
import {
  AppBridgeProvider,
  PolarisProvider,
  QueryProvider,
} from "./providers";
import Routes from "./routes.jsx";

function App() {
  return (
    <PolarisProvider>
      <AppBridgeProvider>
        <QueryProvider>
          <BrowserRouter>
            <Routes />
          </BrowserRouter>
        </QueryProvider>
      </AppBridgeProvider>
    </PolarisProvider>
  );
}

export default App;
