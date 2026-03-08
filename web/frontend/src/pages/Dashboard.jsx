import {
  Page,
  Layout,
  Card,
  Text,
  InlineGrid,
  BlockStack
} from "@shopify/polaris";
import { useEffect, useState } from "react";
import AppStatusCard from "../components/AppStatusCard";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);

  const shop =
    new URLSearchParams(window.location.search).get("shop") || "";

  useEffect(() => {
    if (!shop) return;

    fetch(`/api/analytics/summary?shop=${shop}`)
      .then((r) => r.json())
      .then((data) => {
        console.log("Analytics:", data);
        setSummary(data);
      })
      .catch((err) => console.error("Analytics load failed", err));
  }, [shop]);

  const clicks = summary?.clicks ?? "—";
  const atcRate =
    summary?.atcRate != null ? `${summary.atcRate}%` : "—";
  const revenue =
    summary?.revenue != null ? `$${summary.revenue.toFixed(2)}` : "—";

  return (
    <Page title="Dashboard">
      <Layout>

        {/* App Status */}
        <Layout.Section>
          <AppStatusCard />
        </Layout.Section>

        {/* Overview */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                Performance Overview
              </Text>

              <Text variant="bodyMd" as="p">
                Track how your Sticky Add to Cart bar influences customer behavior
                and revenue across your storefront.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Metrics */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">

            {/* Sticky ATC Clicks */}
            <Card>
              <BlockStack gap="200">
                <Text variant="headingXs" as="h3">
                  Sticky ATC Clicks
                </Text>

                <Text variant="heading2xl" as="p">
                  {clicks}
                </Text>

                <Text variant="bodySm" tone="subdued">
                  Number of clicks on the sticky add-to-cart bar
                </Text>
              </BlockStack>
            </Card>

            {/* Add to Cart Rate */}
            <Card>
              <BlockStack gap="200">
                <Text variant="headingXs" as="h3">
                  Add-to-Cart Rate
                </Text>

                <Text variant="heading2xl" as="p">
                  {atcRate}
                </Text>

                <Text variant="bodySm" tone="subdued">
                  Percentage of product views that resulted in add-to-cart
                </Text>
              </BlockStack>
            </Card>

            {/* Revenue Influenced */}
            <Card>
              <BlockStack gap="200">
                <Text variant="headingXs" as="h3">
                  Revenue Influenced
                </Text>

                <Text variant="heading2xl" as="p">
                  {revenue}
                </Text>

                <Text variant="bodySm" tone="subdued">
                  Revenue from orders influenced by the sticky ATC bar
                </Text>
              </BlockStack>
            </Card>

          </InlineGrid>
        </Layout.Section>

      </Layout>
    </Page>
  );
}