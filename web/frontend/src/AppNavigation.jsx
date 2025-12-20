import { Navigation } from "@shopify/polaris";
import { HomeMajor, AnalyticsMajor } from "@shopify/polaris-icons";
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
            icon: HomeMajor,
            onClick: () => navigate("/"),
            selected: location.pathname === "/",
          },
          {
            label: "Analytics",
            icon: AnalyticsMajor,
            onClick: () => navigate("/analytics"),
            selected: location.pathname === "/analytics",
          },
        ]}
      />
    </Navigation>
  );
}
