import { Frame } from "@shopify/polaris";
import { useLocation, useNavigate } from "react-router-dom";
import AppRouter from "./router.jsx";
import AppNavigation from "./AppNavigation.jsx";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Frame
      navigation={
        <AppNavigation
          location={location}
          navigate={navigate}
        />
      }
    >
      <AppRouter />
    </Frame>
  );
}
