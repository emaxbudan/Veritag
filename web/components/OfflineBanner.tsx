"use client";

import { useEffect, useState } from "react";

/**
 * Displays a sticky banner when the browser is offline.
 * Registers the service worker on first mount.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("SW registration failed:", err));
    }

    // Sync with current state
    setOffline(!navigator.onLine);

    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-[57px] z-20 w-full border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-900"
    >
      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
      You are offline. Showing cached authenticity records.
    </div>
  );
}
