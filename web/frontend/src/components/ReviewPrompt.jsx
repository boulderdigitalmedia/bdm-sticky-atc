import { useEffect, useState, useCallback } from "react";
import {
  Modal,
  BlockStack,
  Text,
  Box,
  InlineGrid,
} from "@shopify/polaris";

const APP_STORE_HANDLE = "sticky-add-to-cart-bar-pro";
const REVIEW_URL = `https://apps.shopify.com/${APP_STORE_HANDLE}#modal-show=ReviewListingModal`;

export default function ReviewPrompt({ shop, onDismiss }) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!shop) return;
    fetch(`/api/review-status?shop=${encodeURIComponent(shop)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.showPrompt) {
          setStats(data.stats || {});
          setOpen(true);
        }
      })
      .catch(() => {});
  }, [shop]);

  const dismiss = useCallback(
    async (left_review) => {
      setOpen(false);
      try {
        await fetch(`/api/review-status?shop=${encodeURIComponent(shop)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dismissed: true, left_review }),
        });
      } catch {}
      onDismiss?.();
    },
    [shop, onDismiss]
  );

  if (!open) return null;

  const clicks      = stats?.clicks      ?? 0;
  const conversions = stats?.conversions ?? 0;
  const revenue     = stats?.revenue != null
    ? `$${Number(stats.revenue).toFixed(2)}`
    : null;

  return (
    <Modal
      open={open}
      onClose={() => dismiss(false)}
      title="🎉 Your sticky bar is working!"
      primaryAction={{
        content: "Leave a review ⭐",
        url: REVIEW_URL,
        target: "_blank",
        onAction: () => dismiss(true),
      }}
      secondaryActions={[
        {
          content: "Maybe later",
          onAction: () => dismiss(false),
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="500">
          <Text variant="bodyLg">
            You've been using Sticky Add To Cart Bar for 5 days — here's what
            it's done for your store:
          </Text>

          <Box
            background="bg-surface-secondary"
            borderRadius="200"
            padding="400"
          >
            <InlineGrid columns={revenue ? 3 : 2} gap="400">
              <BlockStack gap="100" inlineAlign="center">
                <Text variant="heading2xl" alignment="center">
                  {clicks.toLocaleString()}
                </Text>
                <Text variant="bodySm" tone="subdued" alignment="center">
                  Sticky bar clicks
                </Text>
              </BlockStack>

              <BlockStack gap="100" inlineAlign="center">
                <Text variant="heading2xl" alignment="center">
                  {conversions.toLocaleString()}
                </Text>
                <Text variant="bodySm" tone="subdued" alignment="center">
                  Conversions
                </Text>
              </BlockStack>

              {revenue && (
                <BlockStack gap="100" inlineAlign="center">
                  <Text variant="heading2xl" alignment="center">
                    {revenue}
                  </Text>
                  <Text variant="bodySm" tone="subdued" alignment="center">
                    Revenue influenced
                  </Text>
                </BlockStack>
              )}
            </InlineGrid>
          </Box>

          <Text variant="bodyMd" tone="subdued">
            If the app has been helpful, a quick review on the Shopify App Store
            makes a huge difference for a small team. It takes less than a
            minute and means the world to us 🙏
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}