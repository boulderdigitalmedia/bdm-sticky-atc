import { Navigation } from "@shopify/polaris";
import { HomeMinor, AnalyticsMinor } from "@shopify/polaris-icons";
import { useLocation, useNavigate } from "react-router-dom";

export default function AppNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={[
          {
            label: "Dashboard",
            icon: HomeMinor,
            selected: location.pathname === "/",
            onClick: () => navigate("/"),
          },
          {
            label: "Analytics",
            icon: AnalyticsMinor,
            selected: location.pathname === "/analytics",
            onClick: () => navigate("/analytics"),
          },
        ]}
      />
    </Navigation>
  );
}
