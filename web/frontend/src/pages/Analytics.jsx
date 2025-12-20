import {
  Page,
  Layout,
  Card,
  Text,
  InlineGrid,
  BlockStack,
  Spinner,
} from "@shopify/polaris";
import { useEffect, useState } from "react";
import { fetchAnalytics } from "../api/analytics";

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Page title="Analytics">
        <Spinner accessibilityLabel="Loading analytics" />
      </Page>
    );
  }

  return (
    <Page title="Analytics">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              Understand how your Sticky Add to Cart bar impacts conversions and
              revenue.
            </Text>

            <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
              <MetricCard
                title="Sticky ATC Clicks"
                value={data?.clicks ?? "—"}
                description="Total clicks on the sticky bar"
              />

              <MetricCard
                title="Add-to-Cart Rate"
                value={
                  data?.atcRate != null
                    ? `${data.atcRate.toFixed(2)}%`
                    : "—"
                }
                description="Sticky ATC clicks vs product views"
              />

              <MetricCard
                title="Revenue Influenced"
                value={
                  data?.revenue != null
                    ? `$${data.revenue.toFixed(2)}`
                    : "—"
                }
                description="Orders following sticky ATC usage"
              />
            </InlineGrid>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

/* -----------------------
   Metric Card Component
------------------------ */
function MetricCard({ title, value, description }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          {title}
        </Text>

        <Text as="p" variant="headingXl">
          {value}
        </Text>

        <Text as="p" variant="bodySm" tone="subdued">
          {description}
        </Text>
      </BlockStack>
    </Card>
  );
}
