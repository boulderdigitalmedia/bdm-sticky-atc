(() => {
  // Prevent double init
  if (window.__BDM_STICKY_ATC_INIT__) return;
  window.__BDM_STICKY_ATC_INIT__ = true;

  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const titleEl = bar.querySelector("#bdm-title");
  const priceEl = bar.querySelector("#bdm-price");
  const qtyEl = bar.querySelector("#bdm-qty");
  const button = bar.querySelector("#bdm-atc");

  // Only run on product URLs (works for app embed too)
  const isProductUrl = () => /\/products\//.test(window.location.pathname);
  if (!isProductUrl()) return;

  function getHandleFromUrl() {
    const parts = window.location.pathname.split("/products/");
    if (parts.length < 2) return null;
    return parts[1].split("/")[0].split("?")[0];
  }

  function getProductFromEmbeddedJson() {
    const script = document.querySelector("script[data-product-json]");
    if (!script) return null;
    try {
      const parsed = JSON.parse(script.textContent);
      return parsed?.variants?.length ? parsed : null;
    } catch {
      return null;
    }
  }

  async function getProductFromShopifyEndpoint() {
    const handle = getHandleFromUrl();
    if (!handle) return null;

    try {
      const res = await fetch(`/products/${handle}.js`, { credentials: "same-origin" });
      if (!res.ok) return null;
      const product = await res.json();
      return product?.variants?.length ? product : null;
    } catch {
      return null;
    }
  }

  function formatMoneyFromCents(cents) {
    if (typeof cents !== "number") return "";
    return `$${(cents / 100).toFixed(2)}`;
  }

  function getSelectedVariantIdFromPage() {
    const input =
      document.querySelector('input[name="id"]') ||
      document.querySelector('select[name="id"]');
    return input?.value ? String(input.value) : null;
  }

  function showBar() {
    bar.classList.add("is-visible");
    bar.setAttribute("aria-hidden", "false");
  }

  async function init() {
    // Try embedded JSON first (app block case)
    let product = getProductFromEmbeddedJson();

    // Fallback to /products/<handle>.js (app embed case)
    if (!product) product = await getProductFromShopifyEndpoint();

    if (!product) {
      console.warn("BDM Sticky ATC: could not load product data");
      return;
    }

    // Product.js returns prices in cents already
    // Embedded Liquid JSON returns variant.price in string dollars sometimes depending on source.
    // Normalize:
    const normalizeVariantPriceCents = (variant) => {
      if (typeof variant.price === "number") return variant.price; // product.js => cents
      const asNum = Number(variant.price);
      if (Number.isFinite(asNum)) return Math.round(asNum * 100); // liquid json => dollars
      return null;
    };

    // Set initial variant
    let selectedVariantId = getSelectedVariantIdFromPage() || String(product.variants[0].id);

    const findVariant = (id) =>
      product.variants.find((v) => String(v.id) === String(id)) || product.variants[0];

    // Fill title/price
    if (titleEl) titleEl.textContent = product.title;

    const initialVariant = findVariant(selectedVariantId);
    const initialCents = normalizeVariantPriceCents(initialVariant);
    if (priceEl && initialCents != null) priceEl.textContent = formatMoneyFromCents(initialCents);

    // Watch variant changes from theme form controls
    document.addEventListener("change", (e) => {
      const t = e.target;
      if (!t) return;

      const isVariantIdInput = t.name === "id";
      if (!isVariantIdInput) return;

      selectedVariantId = String(t.value);
      const v = findVariant(selectedVariantId);
      const cents = normalizeVariantPriceCents(v);
      if (priceEl && cents != null) priceEl.textContent = formatMoneyFromCents(cents);
    });

    // Show bar once ready
    showBar();

    // Add to cart
    if (button) {
      button.addEventListener("click", async () => {
        const quantity = qtyEl ? Math.max(1, parseInt(qtyEl.value, 10) || 1) : 1;

        const res = await fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            items: [{ id: selectedVariantId, quantity }]
          })
        });

        if (!res.ok) {
          console.warn("BDM Sticky ATC: add to cart failed");
          return;
        }

        window.location.href = "/cart";
      });
    }
  }

  // Theme editor safety
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
