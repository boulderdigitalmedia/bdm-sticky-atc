import {
  Page,
  Layout,
  Card,
  Text,
  DataTable,
  SkeletonBodyText,
} from "@shopify/polaris";
import { useEffect, useState } from "react";

export default function Analytics() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    fetch("/api/analytics/events")
      .then((res) => res.json())
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  return (
    <Page title="Analytics">
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              Sticky ATC Events
            </Text>

            {!rows ? (
              <SkeletonBodyText lines={6} />
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "numeric", "text"]}
                headings={[
                  "Event",
                  "Product",
                  "Quantity",
                  "Time",
                ]}
                rows={rows.map((r) => [
                  r.event,
                  r.productTitle ?? "—",
                  r.quantity ?? "—",
                  new Date(r.timestamp).toLocaleString(),
                ])}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
