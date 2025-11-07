// Example sticky add-to-cart bar
(function() {
  const bar = document.createElement("div");
  bar.id = "sticky-add-to-cart";
  bar.style.position = "fixed";
  bar.style.bottom = "0";
  bar.style.left = "0";
  bar.style.width = "100%";
  bar.style.backgroundColor = "#ffcc00";
  bar.style.color = "#000";
  bar.style.textAlign = "center";
  bar.style.padding = "15px";
  bar.style.fontSize = "18px";
  bar.style.zIndex = "9999";
  bar.innerHTML = "🛒 Add to Cart";
  document.body.appendChild(bar);
})();
