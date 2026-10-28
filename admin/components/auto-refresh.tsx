"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-runs the server component this sits in, on an interval.
 *
 * Used on the pages that show a conversation or a queue someone else is
 * filling — a support thread, the review queues — so an admin is not looking
 * at a snapshot from when they opened the tab.
 *
 * Pauses while the tab is hidden, so a forgotten tab is not polling all day.
 */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const timer = setInterval(tick, seconds * 1000);
    // Catch up straight away when the tab comes back into view.
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);

  return null;
}
