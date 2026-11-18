"use client";

import { useState } from "react";

export function ShareButtons({ url, imageUrl, text }: { url: string; imageUrl: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const btn = "rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:border-accent";

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        // dismissed; fall through to copy
      }
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={share} className={btn}>
        {copied ? "Link copied" : "Share"}
      </button>
      <a href={imageUrl} download="water-report-card.png" className={btn}>
        Download report card
      </a>
    </div>
  );
}
