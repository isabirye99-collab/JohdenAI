"use client";

import { useEffect } from "react";

export default function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // The app remains usable without service-worker support.
      });
    }
  }, []);
  return null;
}
