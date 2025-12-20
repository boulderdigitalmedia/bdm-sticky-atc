import { Page, Layout, Text, BlockStack } from "@shopify/polaris";
import AppStatusCard from "../components/AppStatusCard";

export default function Dashboard() {
  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <AppStatusCard />

            <Text as="h2" variant="headingMd">
              Performance Overview
            </Text>

            <Text as="p" variant="bodyMd">
              Track how your Sticky Add to Cart bar influences customer behavior
              and revenue.
            </Text>

            <Text as="p" variant="bodyMd">
              Sticky ATC Clicks
            </Text>
            <Text as="p" variant="bodyLg">—</Text>

            <Text as="p" variant="bodyMd">
              Add-to-Cart Rate
            </Text>
            <Text as="p" variant="bodyLg">—</Text>

            <Text as="p" variant="bodyMd">
              Revenue Influenced
            </Text>
            <Text as="p" variant="bodyLg">—</Text>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
