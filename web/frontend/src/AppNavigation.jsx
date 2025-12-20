import { Navigation } from "@shopify/polaris";
import {
  HomeIcon,
  ChartVerticalIcon,
} from "@shopify/polaris-icons";
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
            onClick: () => navigate("/"),
            selected: location.pathname === "/",
          },
          {
            label: "Analytics",
            icon: ChartVerticalIcon,
            onClick: () => navigate("/analytics"),
            selected: location.pathname === "/analytics",
          },
        ]}
      />
    </Navigation>
  );
}
