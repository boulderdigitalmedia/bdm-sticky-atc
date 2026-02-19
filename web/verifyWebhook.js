import crypto from "crypto";

export function verifyWebhook(req, res, next) {
  try {
    const hmacHeader = req.get("X-Shopify-Hmac-Sha256");

    if (!hmacHeader) {
      return res.status(401).send("Missing HMAC header");
    }

    const generatedHash = crypto
      .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
      .update(req.body)
      .digest("base64");

    if (generatedHash !== hmacHeader) {
      return res.status(401).send("Invalid webhook signature");
    }

    next();
  } catch (err) {
    console.error("Webhook verification error:", err);
    res.status(500).send("Webhook error");
  }
}
