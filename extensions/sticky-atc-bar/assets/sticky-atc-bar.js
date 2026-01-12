(function () {
  const bar = document.getElementById("bdm-sticky-atc");
  if (!bar) return;

  const productForm = document.querySelector('form[action="/cart/add"]');
  if (!productForm) return;

  const variantSelect = productForm.querySelector('select[name="id"]');
  const submitBtn = productForm.querySelector('[type="submit"]');
  const priceEl = document.querySelector('[data-product-price], .price');
  const titleEl = document.querySelector("h1");

  const stickyVariant = document.getElementById("bdm-variant");
  const stickyQty = document.getElementById("bdm-qty");
  const stickyATC = document.getElementById("bdm-atc");
  const stickyTitle = document.getElementById("bdm-title");
  const stickyPrice = document.getElementById("bdm-price");

  if (titleEl) stickyTitle.textContent = titleEl.textContent;

  if (variantSelect) {
    variantSelect.querySelectorAll("option").forEach(opt => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.textContent;
      stickyVariant.appendChild(o);
    });

    stickyVariant.value = variantSelect.value;

    stickyVariant.addEventListener("change", () => {
      variantSelect.value = stickyVariant.value;
      variantSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
  } else {
    stickyVariant.style.display = "none";
  }

  if (priceEl) {
    stickyPrice.textContent = priceEl.textContent;
    new MutationObserver(() => {
      stickyPrice.textContent = priceEl.textContent;
    }).observe(priceEl, { childList: true, subtree: true });
  }

  stickyATC.addEventListener("click", () => {
    let qtyInput = productForm.querySelector('input[name="quantity"]');
    if (!qtyInput) {
      qtyInput = document.createElement("input");
      qtyInput.type = "hidden";
      qtyInput.name = "quantity";
      productForm.appendChild(qtyInput);
    }
    qtyInput.value = stickyQty.value;
    submitBtn.click();
  });

  const trigger = productForm.getBoundingClientRect().bottom + window.scrollY;

  window.addEventListener("scroll", () => {
    bar.classList.toggle("visible", window.scrollY > trigger);
  });
})();
