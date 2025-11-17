(function () {
  function initStickyBar() {
    const root = document.getElementById("bdm-sticky-atc-bar-root");
    if (!root) return;

    // Only show on product pages with a product form
    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (!productForm) return;

    // Try to get variants from existing select[name="id"]
    const variantSelect = productForm.querySelector('select[name="id"]');
    let variants = [];
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
      variants = window.ShopifyAnalytics.meta.product.variants || [];
    }

    const productTitle = root.dataset.productTitle || document.title;
    const footerText = "Powered by Boulder Digital Media"; // later: read from settings via data- attribute
    let currentVariantId = variantSelect ? variantSelect.value : (variants[0] && variants[0].id);
    let currentPrice = null;

    function findVariantById(id) {
      return variants.find(v => String(v.id) === String(id));
    }

    function formatMoney(cents) {
      if (typeof cents === "string") cents = parseInt(cents, 10);
      const value = (cents || 0) / 100;
      return value.toLocaleString(undefined, { style: "currency", currency: (window.Shopify && Shopify.currency && Shopify.currency.active) || "USD" });
    }

    if (variants.length && currentVariantId) {
      const v = findVariantById(currentVariantId);
      if (v) currentPrice = v.price;
    }

    const container = document.createElement("div");
    container.className = "bdm-sticky-atc-bar-container";

    const inner = document.createElement("div");
    inner.className = "bdm-sticky-atc-bar-inner";

    const productInfo = document.createElement("div");
    productInfo.className = "bdm-sticky-atc-product";
    productInfo.innerHTML = `
      <div class="bdm-sticky-atc-title">${productTitle}</div>
      <div class="bdm-sticky-atc-price">${currentPrice ? formatMoney(currentPrice) : ""}</div>
    `;

    const controls = document.createElement("div");
    controls.className = "bdm-sticky-atc-controls";

    // Variant selector (simple)
    const variantWrapper = document.createElement("div");
    variantWrapper.className = "bdm-sticky-atc-variant";

    if (variants.length > 1) {
      const variantLabel = document.createElement("span");
      variantLabel.textContent = "Variant";

      const variantDropdown = document.createElement("select");
      variants.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.public_title || v.title || `Variant ${v.id}`;
        if (String(v.id) === String(currentVariantId)) opt.selected = true;
        variantDropdown.appendChild(opt);
      });

      variantDropdown.addEventListener("change", () => {
        currentVariantId = variantDropdown.value;
        const v = findVariantById(currentVariantId);
        if (v) {
          currentPrice = v.price;
          const priceEl = productInfo.querySelector(".bdm-sticky-atc-price");
          if (priceEl) priceEl.textContent = formatMoney(v.price);
        }

        // Sync with main product form select if present
        if (variantSelect) {
          variantSelect.value = currentVariantId;
          variantSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      variantWrapper.appendChild(variantLabel);
      variantWrapper.appendChild(variantDropdown);
    }

    // Quantity controls
    const qtyWrapper = document.createElement("div");
    qtyWrapper.className = "bdm-sticky-atc-qty";

    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.textContent = "-";

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = "1";

    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.textContent = "+";

    minusBtn.addEventListener("click", () => {
      const val = Math.max(1, parseInt(qtyInput.value || "1", 10) - 1);
      qtyInput.value = String(val);
    });

    plusBtn.addEventListener("click", () => {
      const val = Math.max(1, parseInt(qtyInput.value || "1", 10) + 1);
      qtyInput.value = String(val);
    });

    qtyWrapper.appendChild(minusBtn);
    qtyWrapper.appendChild(qtyInput);
    qtyWrapper.appendChild(plusBtn);

    // Add to cart button
    const atcButton = document.createElement("button");
    atcButton.type = "button";
    atcButton.className = "bdm-sticky-atc-button";
    atcButton.textContent = "Add to cart";

    atcButton.addEventListener("click", async () => {
      const quantity = Math.max(1, parseInt(qtyInput.value || "1", 10));

      const variantIdToUse =
        currentVariantId ||
        (variantSelect && variantSelect.value);

      if (!variantIdToUse) {
        alert("Please select a variant");
        return;
      }

      try {
        const res = await fetch("/cart/add.js", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            id: variantIdToUse,
            quantity
          })
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error("Add to cart failed", data);
          alert("Could not add to cart. Please try again.");
          return;
        }

        // TODO later: fire tracking to your app: /apps/bdm-sticky-atc/track
        // For now, just reload cart or open drawer if theme has one
        const hasCartDrawer = document.querySelector("[data-cart-drawer], .cart-drawer, #CartDrawer");
        if (hasCartDrawer) {
          // Trigger click on any cart icon that opens the drawer
          const triggers = document.querySelectorAll('[href*="/cart"], [data-cart-toggle], .js-cart-toggle');
          if (triggers.length) {
            triggers[0].dispatchEvent(new Event("click", { bubbles: true }));
          } else {
            window.location.href = "/cart";
          }
        } else {
          window.location.href = "/cart";
        }
      } catch (err) {
        console.error("Error adding to cart", err);
        alert("There was an error. Please try again.");
      }
    });

    controls.appendChild(variantWrapper);
    controls.appendChild(qtyWrapper);
    controls.appendChild(atcButton);

    // Footer (free plan)
    const footer = document.createElement("div");
    footer.className = "bdm-sticky-atc-footer";
    footer.textContent = footerText;

    inner.appendChild(productInfo);
    inner.appendChild(controls);
    inner.appendChild(footer);

    container.appendChild(inner);
    document.body.appendChild(container);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStickyBar);
  } else {
    initStickyBar();
  }
})();
