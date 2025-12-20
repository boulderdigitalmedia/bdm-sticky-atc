import {
  Page,
  Layout,
  Card,
  Text,
} from "@shopify/polaris";

export default function Dashboard() {
  return (
    <Page title="Dashboard">
      <Layout>
        {/* Overview */}
        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">
              Performance Overview
            </Text>

            <Text as="p" tone="subdued">
              Track how your Sticky Add to Cart bar influences customer behavior and revenue.
            </Text>
          </Card>
        </Layout.Section>

        {/* Metric: Sticky ATC Clicks */}
        <Layout.Section oneThird>
          <Card>
            <Text variant="headingSm" as="h3">
              Sticky ATC Clicks
            </Text>

            <Text variant="headingLg" as="p">
              —
            </Text>
          </Card>
        </Layout.Section>

        {/* Metric: Add to Cart Rate */}
        <Layout.Section oneThird>
          <Card>
            <Text variant="headingSm" as="h3">
              Add-to-Cart Rate
            </Text>

            <Text variant="headingLg" as="p">
              —
            </Text>
          </Card>
        </Layout.Section>

        {/* Metric: Revenue Influenced */}
        <Layout.Section oneThird>
          <Card>
            <Text variant="headingSm" as="h3">
              Revenue Influenced
            </Text>

            <Text variant="headingLg" as="p">
              —
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
