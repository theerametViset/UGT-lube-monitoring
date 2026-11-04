"use client";

import { useEffect, useState } from "react";

// Chart.js draws onto a <canvas>, so its tick/grid/label colors are plain
// hex strings baked into the render call — they can't respond to the CSS
// variables the rest of the app uses for dark mode. This hook lets chart
// components watch the <html data-theme> attribute (toggled by ThemeToggle)
// and re-render with theme-correct colors.
export function useIsDarkMode(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setDark(root.getAttribute("data-theme") === "dark");
    const observer = new MutationObserver(() => {
      setDark(root.getAttribute("data-theme") === "dark");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return dark;
}
