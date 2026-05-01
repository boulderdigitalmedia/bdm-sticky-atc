import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Box,
  Divider,
  Banner,
} from "@shopify/polaris";
import { CheckCircleIcon } from "@shopify/polaris-icons";

const STEPS = [
  {
    number: 1,
    title: "Open Theme Editor",
    description:
      "Click the button below to open your Theme Editor. It will take you directly to the App Embeds section.",
    action: "Open Theme Editor →",
    isLink: true,
  },
  {
    number: 2,
    title: "Enable the App Embed",
    description:
      'In the Theme Editor, click the puzzle piece icon (⊞) labelled "App embeds" in the left sidebar. Find "Sticky Add To Cart Bar" and toggle it ON.',
    action: null,
  },
  {
    number: 3,
    title: "Save your theme",
    description:
      'Click the "Save" button in the top right of the Theme Editor. The sticky bar is now live on all your product pages.',
    action: null,
  },
];

export default function Onboarding({ onComplete }) {
  const [completedSteps, setCompletedSteps] = useState({});
  const [shop, setShop] = useState(null);
  const [saving, setSaving] = useState(false);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    // Get shop from Shopify App Bridge globals injected by the server
    const s =
      window.__SHOPIFY_SHOP__ ||
      new URLSearchParams(window.location.search).get("shop") ||
      window.Shopify?.shop ||
      null;
    setShop(s);
  }, []);

  const themeEditorUrl = shop
    ? `https://admin.shopify.com/store/${shop
        .replace(".myshopify.com", "")
        .replace(/^https?:\/\//, "")}/themes/current/editor?context=apps`
    : "https://admin.shopify.com";

  const toggleStep = useCallback((num) => {
    setCompletedSteps((prev) => ({ ...prev, [num]: !prev[num] }));
  }, []);

  const allStepsComplete =
    completedSteps[1] && completedSteps[2] && completedSteps[3];

  const handleFinish = useCallback(async () => {
    if (!shop) return;
    setSaving(true);
    try {
      await fetch(`/api/settings?shop=${encodeURIComponent(shop)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingComplete: true }),
      });
      setAllDone(true);
      setTimeout(() => onComplete?.(), 1200);
    } catch {
      setSaving(false);
    }
  }, [shop, onComplete]);

  if (allDone) {
    return (
      <Page narrowWidth>
        <Box paddingBlockStart="1600">
          <Card>
            <BlockStack gap="400" align="center" inlineAlign="center">
              <Text variant="heading2xl" as="h1" alignment="center">
                🎉 You're all set!
              </Text>
              <Text variant="bodyLg" tone="subdued" alignment="center">
                Your sticky bar is live. Heading to your dashboard...
              </Text>
            </BlockStack>
          </Card>
        </Box>
      </Page>
    );
  }

  return (
    <Page narrowWidth>
      <BlockStack gap="600">
        {/* Header */}
        <BlockStack gap="200">
          <Text variant="heading2xl" as="h1">
            Welcome to Sticky Add To Cart Bar 👋
          </Text>
          <Text variant="bodyLg" tone="subdued">
            You're 3 steps away from showing a sticky bar on every product page.
            Takes about 60 seconds.
          </Text>
        </BlockStack>

        {/* Steps */}
        <Card>
          <BlockStack gap="0">
            {STEPS.map((step, i) => {
              const done = !!completedSteps[step.number];
              return (
                <div key={step.number}>
                  {i > 0 && <Divider />}
                  <Box padding="500">
                    <InlineStack gap="400" align="start" blockAlign="start" wrap={false}>
                      {/* Step number / check */}
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: done ? "#008060" : "#f1f1f1",
                          color: done ? "#fff" : "#6d7175",
                          fontWeight: 700,
                          fontSize: 15,
                          cursor: "pointer",
                          transition: "background 0.2s",
                        }}
                        onClick={() => toggleStep(step.number)}
                        title="Click to mark complete"
                      >
                        {done ? "✓" : step.number}
                      </div>

                      {/* Content */}
                      <BlockStack gap="200" inlineSize="fill">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text
                            variant="headingMd"
                            tone={done ? "subdued" : undefined}
                            textDecorationLine={done ? "line-through" : undefined}
                          >
                            {step.title}
                          </Text>
                          {done && (
                            <Badge tone="success">Done</Badge>
                          )}
                        </InlineStack>

                        <Text variant="bodyMd" tone="subdued">
                          {step.description}
                        </Text>

                        {step.isLink && (
                          <Box paddingBlockStart="200">
                            <Button
                              variant="primary"
                              url={themeEditorUrl}
                              target="_blank"
                              onClick={() => toggleStep(step.number)}
                            >
                              {step.action}
                            </Button>
                          </Box>
                        )}
                      </BlockStack>
                    </InlineStack>
                  </Box>
                </div>
              );
            })}
          </BlockStack>
        </Card>

        {/* Help callout */}
        <Banner tone="info">
          <Text variant="bodyMd">
            <strong>Can't find App Embeds?</strong> In Theme Editor, look for the
            puzzle piece icon (⊞) in the left sidebar — it's below "Sections". If
            you're on a custom theme and don't see it, your theme may need to be
            updated to support app embeds.
          </Text>
        </Banner>

        {/* Finish button */}
        <Box paddingBlockEnd="800">
          <InlineStack align="end">
            <Button
              variant="primary"
              size="large"
              disabled={!allStepsComplete}
              loading={saving}
              onClick={handleFinish}
            >
              Go to Dashboard
            </Button>
          </InlineStack>
          {!allStepsComplete && (
            <Box paddingBlockStart="200">
              <Text variant="bodySm" tone="subdued" alignment="right">
                Mark all 3 steps complete to continue
              </Text>
            </Box>
          )}
        </Box>
      </BlockStack>
    </Page>
  );
}