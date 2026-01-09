import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

import { initShopify } from "./shopify.js";
import trackRoutes from "./routes/track.js";
import settingsRouter from "./routes/settings.js";

app.use("/api/settings", settingsRouter);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Needed for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Middleware ----------
app.use(express.json());

// REQUIRED for embedded Shopify apps
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com"
  );
  next();
});

// ---------- Shopify ----------
initShopify(app);

// ---------- API routes ----------
app.use("/apps/bdm-sticky-atc", trackRoutes);

// ---------- Frontend ----------
const frontendDir = path.join(__dirname, "frontend", "dist");
const indexHtml = path.join(frontendDir, "index.html");

// Serve static assets
app.use(express.static(frontendDir));

// ⚠️ IMPORTANT:
// Do NOT block on `shop` or `host` here.
// Shopify needs a 200 HTML response to register the app UI.
app.get("*", (req, res) => {
  if (!fs.existsSync(indexHtml)) {
    return res
      .status(500)
      .send("Frontend not built. Run `npm run build`.");
  }

  return res.sendFile(indexHtml);
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`✅ App running on port ${PORT}`);
});
