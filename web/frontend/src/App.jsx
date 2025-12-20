import { Frame } from "@shopify/polaris";
import AppNavigation from "./AppNavigation";
import AppRouter from "./router";

export default function App() {
  return (
    <Frame navigation={<AppNavigation />}>
      <AppRouter />
    </Frame>
  );
}
