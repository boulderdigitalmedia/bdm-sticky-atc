import React from "react";
import ReactDOM from "react-dom/client";
import Providers from "./providers.jsx";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("app")).render(
  <Providers>
    <App />
  </Providers>
);
