// extensions/sticky-atc-web-pixel/src/index.js

export default function register({ analytics }) {
  analytics.subscribe("page_viewed", (event) => {
    console.log("Sticky ATC Pixel: page_viewed", event);
  });
}
