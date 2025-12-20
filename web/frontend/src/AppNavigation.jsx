import { Navigation } from "@shopify/polaris";
import {
  HomeFilledIcon,
  ChartVerticalFilledIcon,
} from "@shopify/polaris-icons";

export default function AppNavigation({ location, navigate }) {
  return (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={[
          {
            label: "Dashboard",
            icon: HomeFilledIcon,
            selected: location.pathname === "/",
            onClick: () => navigate("/"),
          },
          {
            label: "Analytics",
            icon: ChartVerticalFilledIcon,
            selected: location.pathname === "/analytics",
            onClick: () => navigate("/analytics"),
          },
        ]}
      />
    </Navigation>
  );
}
