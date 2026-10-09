import React from "react";
import ReactDOM from "react-dom/client";
/* Fonts are bundled with the app (SIL Open Font License; the licence texts ship in
   public/fonts/), so starting Cyra contacts no font CDN. Fraunces carries its
   optical-size (opsz) and weight axes; Karla its weight axis. */
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/karla/index.css";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
