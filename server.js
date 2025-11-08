import express from "express";
import cookieParser from "cookie-parser";
import fetch from "node-fetch";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SHOPIFY_API_KEY;
const API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = process.env.SCOPES || "read_products";
const HOST = process.env.HOST;

// -------------------- OAuth --------------------
app.get("/", (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send("Missing shop parameter");
  res.redirect(`/auth?shop=${shop}`);
});

app.get("/auth", (req, res) => {
  const shop = req.query.shop;
  const redirectUri = `${HOST}/auth/callback`;
  const state = "randomstring";

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${API_KEY}&scope=${SCOPES}&redirect_uri=${redirectUri}&state=${state}&grant_options[]=per-user`;
  res.redirect(installUrl);
});

app.get("/auth/callback", async (req, res) => {
  const { shop, code, hmac } = req.query;

  // HMAC validation
  const params = { ...req.query };
  delete params.hmac;
  const message = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  const generated = crypto.createHmac("sha256", API_SECRET).update(message).digest("hex");
  if (generated !== hmac) return res.status(400).send("HMAC validation failed");

  // Exchange code for access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: API_KEY, client_secret: API_SECRET, code }),
  });
  const data = await tokenRes.json();
  const accessToken = data.access_token;

  // Optional: Create a billing session
  // await createBillingSession(shop, accessToken);

  res.send("✅ App installed! Sticky bar is handled via Theme App Extension.");
});

// -------------------- Health --------------------
app.get("/health", (_, res) => res.send("OK"));

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
