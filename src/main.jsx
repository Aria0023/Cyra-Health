/* global __CYRA_DEV_GALLERY__ */
import React, { lazy, Suspense, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
/* Fonts are bundled with the app (SIL Open Font License; the licence texts ship in
   public/fonts/), so starting Cyra contacts no font CDN. Fraunces carries its
   optical-size (opsz) and weight axes; Karla its weight axis. */
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/karla/index.css";
import App from "./App.jsx";

/* The design-system gallery (calm R1) at #/dev/ui exists only in a build whose VITE_FEATURES names devGallery (or
   "all"). __CYRA_DEV_GALLERY__ is a build-time constant (vite.config.js), so without the flag this branch and the
   gallery's code are dropped from the bundle. */
const DevGallery = __CYRA_DEV_GALLERY__ ? lazy(() => import("./dev/DevGallery.jsx")) : null;
const atGallery = () => !!DevGallery && /^#\/dev\/ui\b/.test(window.location.hash || "");

function Root() {
  const [gallery, setGallery] = useState(atGallery);
  useEffect(() => {
    if (!DevGallery) return undefined;
    const on = () => setGallery(atGallery());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return gallery ? <Suspense fallback={null}><DevGallery /></Suspense> : <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
