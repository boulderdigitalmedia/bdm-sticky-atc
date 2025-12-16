import {
  reactExtension,
  useApplyAttributeChange,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension(
  "purchase.checkout.block.render",
  () => <StickyAtcCheckoutTracker />
);

function StickyAtcCheckoutTracker() {
  const applyAttributeChange = useApplyAttributeChange();

  if (!globalThis.__stickyTracked) {
    globalThis.__stickyTracked = true;

    applyAttributeChange({
      type: "updateAttribute",
      key: "sticky_atc_checkout",
      value: "true",
    });
  }

  return null;
}
