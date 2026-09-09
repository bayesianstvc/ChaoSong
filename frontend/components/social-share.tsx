"use client";

import { useState } from "react";

export function SocialShare({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  function currentUrl() { return window.location.href; }
  async function copyLink() {
    await navigator.clipboard.writeText(currentUrl());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  function openShare(service: "linkedin" | "x") {
    const url = currentUrl();
    const target = service === "linkedin"
      ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
      : `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    window.open(target, "_blank", "noopener,noreferrer");
  }
  return (
    <aside className="social-share" aria-label="Share this article">
      <span>Share</span>
      <button type="button" onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button>
      <button type="button" onClick={() => openShare("linkedin")}>LinkedIn</button>
      <button type="button" onClick={() => openShare("x")}>X</button>
    </aside>
  );
}
