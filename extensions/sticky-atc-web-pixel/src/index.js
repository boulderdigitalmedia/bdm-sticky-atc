export default function register({ analytics, browser }) {
  // Required: this confirms the pixel is valid
  analytics.subscribe("page_viewed", (event) => {
    // noop for now — we’ll wire this later
  });
}
