"use client";

import { useState } from "react";

export default function CommandCenterControls({ televisionMode }) {
  const [fullscreen, setFullscreen] = useState(false);

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a href={televisionMode ? "/office/command-center" : "/office/command-center?view=tv"} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10">
        {televisionMode ? "Exit television view" : "Television view"}
      </a>
      <button type="button" onClick={toggleFullscreen} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500">
        {fullscreen ? "Exit full screen" : "Full screen"}
      </button>
    </div>
  );
}
