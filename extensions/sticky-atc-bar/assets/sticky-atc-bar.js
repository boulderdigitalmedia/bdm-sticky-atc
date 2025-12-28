(() => {
  console.log("🔥 Sticky ATC loaded – FINAL");

  function getVariantIdFromUrl() {
    const v = new URL(window.location.href).searchParams.get("variant");
    return v ? Number(v) : null;
  }

  async function setAttributionAttributes(variantId) {
    try {
      await fetch("/cart/update.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          attributes: {
            bdm_sticky_atc: "true",
            bdm_variant_id: variantId,
            bdm_atc_timestamp: Date.now().toString(),
          },
        }),
      });
    } catch (err) {
      console.error("❌ Failed to set cart attributes", err);
    }
  }

  async function addToCart(variantId) {
    await fetch("/cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        id: variantId,
        quantity: 1,
      }),
    });
  }

  function attachHandler(button) {
    button.addEventListener("click", async () => {
      const variantId = getVariantIdFromUrl();

      if (!variantId) {
        alert("Please select a variant");
        return;
      }

      console.log("✅ Adding variant", variantId);

      await setAttributionAttributes(variantId);
      await addToCart(variantId);

      window.location.href = "/cart";
    });
  }

  function init() {
    const btn = document.querySelector("[data-sticky-atc-button]");
    if (!btn) return;

    attachHandler(btn);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
