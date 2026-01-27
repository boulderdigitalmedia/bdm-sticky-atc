import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";

import { initShopify } from "./shopify.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize Shopify OAuth
initShopify(app);

// Serve frontend static assets
app.use(express.static(path.join(__dirname, "frontend", "dist"), { index: false }));

// Inject API key into index.html
app.get("*", (_req, res) => {
  const indexPath = path.join(__dirname, "frontend", "dist", "index.html");
  const apiKey = process.env.SHOPIFY_API_KEY;

  if (!apiKey) {
    console.error("❌ SHOPIFY_API_KEY missing on server");
    return res.status(500).send("Missing Shopify API key");
  }

  let html = fs.readFileSync(indexPath, "utf8");

  html = html.replace(
    "</head>",
    `<script>
      window.__SHOPIFY_API_KEY__ = ${JSON.stringify(apiKey)};
    </script></head>`
  );

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
