// web/frontend/src/navigation.jsx
import { Navigation } from "@shopify/polaris";
import { HomeFilledIcon } from "@shopify/polaris-icons";

export default function AppNavigation() {
  return (
    <Navigation location="/">
      <Navigation.Section
        items={[
          {
            label: "Dashboard",
            icon: HomeFilledIcon,
            url: "/",
          },
          {
            label: "Analytics",
            icon: HomeFilledIcon, // replace with a different icon later if you want
            url: "/analytics",
          }
        ]}
      />
    </Navigation>
  );
}
