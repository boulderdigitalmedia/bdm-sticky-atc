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

// Serve frontend
app.use(express.static(path.join(__dirname, "frontend", "dist"), { index: false }));

app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "frontend", "dist", "index.html");

  const html = fs.readFileSync(indexPath, "utf8");
  res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
