export async function complianceWebhook(topic, shop, body) {
  console.log("🛡️ Privacy webhook:", topic, shop);
  console.log("Payload:", body);
}