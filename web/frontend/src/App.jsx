import { Frame } from "@shopify/polaris";
import AppRouter from "./router.jsx";
import AppNavigation from "./AppNavigation.jsx"; // ✅ matches filename exactly

export default function App() {
  return (
    <Frame navigation={<AppNavigation />}>
      <AppRouter />
    </Frame>
  );
}
