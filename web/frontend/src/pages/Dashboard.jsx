import {
  Page,
  Layout,
  Card,
  Text,
  InlineStack,
  BlockStack,
  SkeletonBodyText,
} from "@shopify/polaris";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch("/api/analytics/summary")
      .then((res) => res.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Performance Overview
              </Text>

              {!stats ? (
                <SkeletonBodyText lines={3} />
              ) : (
                <InlineStack gap="600">
                  <Metric
                    label="Sticky ATC Clicks"
                    value={stats.clicks}
                  />
                  <Metric
                    label="Add-to-Cart Rate"
                    value={`${stats.atcRate}%`}
                  />
                  <Metric
                    label="Revenue Influenced"
                    value={`$${stats.revenue}`}
                  />
                </InlineStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function Metric({ label, value }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="headingLg">{value ?? "—"}</Text>
        <Text tone="subdued">{label}</Text>
      </BlockStack>
    </Card>
  );
}
