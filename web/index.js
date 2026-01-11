import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

import { initShopify } from "./shopify.js";
import settingsRouter from "./routes/settings.js";
import trackRouter from "./routes/track.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ 1. CREATE APP FIRST
const app = express();

// ✅ 2. MIDDLEWARE
app.use(cors());
app.use(bodyParser.json());

// ✅ 3. ROUTES
app.use("/api/settings", settingsRouter);
app.use("/api/track", trackRouter);

// ✅ 4. SHOPIFY (after app exists)
initShopify(app);

// ✅ 5. FRONTEND (serve built admin UI)
app.use(
  express.static(path.join(__dirname, "frontend", "dist"))
);

app.get("*", (_req, res) => {
  res.sendFile(
    path.join(__dirname, "frontend", "dist", "index.html")
  );
});

// ✅ 6. START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ App running on port ${PORT}`);
});
