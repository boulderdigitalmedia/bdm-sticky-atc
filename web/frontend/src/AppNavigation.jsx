// web/frontend/src/navigation.jsx
import { Navigation, Icon } from "@shopify/polaris";
import { HomeMajor } from "@shopify/polaris-icons";

export default function AppNavigation() {
  return (
    <Navigation location="/">
      <Navigation.Section
        items={[
          {
            label: "Dashboard",
            icon: () => <Icon source={HomeMajor} />,
            url: "/",
          },
          {
            label: "Analytics",
            icon: () => <Icon source={HomeMajor} />,
            url: "/analytics",
          },
        ]}
      />
    </Navigation>
  );
}
