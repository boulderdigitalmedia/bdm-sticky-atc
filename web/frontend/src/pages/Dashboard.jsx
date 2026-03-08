import { Page, Layout, Text, BlockStack } from "@shopify/polaris";
import { useEffect, useState } from "react";
import AppStatusCard from "../components/AppStatusCard";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);

  // Get shop from URL
  const shop =
    new URLSearchParams(window.location.search).get("shop") || "";

  useEffect(() => {
    if (!shop) return;

    fetch(`/api/analytics/summary?shop=${shop}`)
      .then((r) => r.json())
      .then((data) => {
        console.log("Analytics summary:", data);
        setSummary(data);
      })
      .catch((err) => {
        console.error("Failed to load analytics", err);
      });
  }, [shop]);

  const clicks = summary?.clicks ?? "—";
  const atcRate = summary?.atcRate != null ? `${summary.atcRate}%` : "—";
  const revenue =
    summary?.revenue != null ? `$${summary.revenue.toFixed(2)}` : "—";

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
            <Text as="p" variant="bodyLg">{clicks}</Text>

            <Text as="p" variant="bodyMd">
              Add-to-Cart Rate
            </Text>
            <Text as="p" variant="bodyLg">{atcRate}</Text>

            <Text as="p" variant="bodyMd">
              Revenue Influenced
            </Text>
            <Text as="p" variant="bodyLg">{revenue}</Text>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}