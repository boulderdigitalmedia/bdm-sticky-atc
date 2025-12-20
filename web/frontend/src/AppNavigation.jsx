import { Navigation } from "@shopify/polaris";
import { HomeIcon, ChartLineIcon } from "@shopify/polaris-icons";
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
            icon: HomeIcon,
            selected: location.pathname === "/",
            onClick: () => navigate("/"),
          },
          {
            label: "Analytics",
            icon: ChartLineIcon,
            selected: location.pathname === "/analytics",
            onClick: () => navigate("/analytics"),
          },
        ]}
      />
    </Navigation>
  );
}
