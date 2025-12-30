export default function register({ analytics }) {
  analytics.subscribe("page_viewed", (event) => {
    console.log("Sticky ATC Web Pixel loaded", event);
  });
}
