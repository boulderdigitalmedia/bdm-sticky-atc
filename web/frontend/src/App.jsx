import { Frame } from "@shopify/polaris";
import AppRouter from "./router.jsx";
import AppNavigation from "./navigation.jsx";

export default function App() {
  return (
    <Frame navigation={<AppNavigation />}>
      <AppRouter />
    </Frame>
  );
}
