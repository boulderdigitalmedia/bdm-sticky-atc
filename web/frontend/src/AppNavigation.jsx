import { Navigation } from "@shopify/polaris";
import { useLocation, useNavigate } from "react-router-dom";

export default function AppNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={[
          {
            label: "Overview",
            selected: location.pathname === "/",
            onClick: () => navigate("/"),
          },
          {
            label: "Analytics",
            selected: location.pathname === "/analytics",
            onClick: () => navigate("/analytics"),
          },
        ]}
      />
    </Navigation>
  );
}
