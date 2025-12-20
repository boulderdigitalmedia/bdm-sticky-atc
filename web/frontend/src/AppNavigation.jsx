import { Navigation } from "@shopify/polaris";
import {
  HomeMajor,
  AnalyticsMajor,
} from "@shopify/polaris-icons";

export default function AppNavigation({ location, navigate }) {
  return (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={[
          {
            label: "Dashboard",
            icon: HomeMajor,
            selected: location.pathname === "/",
            onClick: () => navigate("/"),
          },
          {
            label: "Analytics",
            icon: AnalyticsMajor,
            selected: location.pathname === "/analytics",
            onClick: () => navigate("/analytics"),
          },
        ]}
      />
    </Navigation>
  );
}
