// web/index.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import shopify from "./shopify.js";

import analyticsRoutes from "./routes/stickyAnalytics.js";
import { ordersPaidHandler } from "./webhooks/ordersPaid.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;
const app = express();

/* ------------------------------------------------
   MIDDLEWARE
------------------------------------------------ */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ------------------------------------------------
   SHOPIFY INSTALL / AUTH GUARD (CRITICAL)
------------------------------------------------ */
app.use(shopify.ensureInstalledOnShop());

/* ------------------------------------------------
   API ROUTES
------------------------------------------------ */
app.use("/api/analytics", analyticsRoutes);

/* ------------------------------------------------
   WEBHOOKS
------------------------------------------------ */
app.post("/webhooks/orders/paid", async (req, res) => {
  try {
    await ordersPaidHandler(
      req.headers["x-shopify-shop-domain"],
      req.body
    );
    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("Webhook failed");
  }
});

/* ------------------------------------------------
   AUTH ROUTES
------------------------------------------------ */
app.get("/auth", shopify.auth.begin());
app.get("/auth/callback", shopify.auth.callback());

/* ------------------------------------------------
   STATIC FRONTEND (Vite build)
------------------------------------------------ */
const frontendDir = path.join(__dirname, "frontend/dist");
app.use(express.static(frontendDir));

/* ------------------------------------------------
   SPA FALLBACK
------------------------------------------------ */
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

/* ------------------------------------------------
   START SERVER
------------------------------------------------ */
app.listen(PORT, () => {
  console.log(`🚀 Sticky ATC running on port ${PORT}`);
  console.log(`📁 Serving admin UI from: ${frontendDir}`);
});
