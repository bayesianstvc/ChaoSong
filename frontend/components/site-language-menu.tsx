"use client";

import { useEffect, useRef, useState } from "react";
import { GlobeHemisphereWest, MagnifyingGlass, X } from "@phosphor-icons/react";

const languages = [
  ["zh-CN", "简体中文"], ["zh-TW", "繁體中文"], ["en", "English"], ["ja", "日本語"],
  ["ko", "한국어"], ["fr", "Français"], ["de", "Deutsch"], ["es", "Español"],
  ["pt", "Português"], ["it", "Italiano"], ["ru", "Русский"], ["ar", "العربية"],
  ["hi", "हिन्दी"], ["th", "ไทย"], ["vi", "Tiếng Việt"], ["id", "Bahasa Indonesia"],
  ["nl", "Nederlands"], ["pl", "Polski"], ["tr", "Türkçe"], ["sv", "Svenska"],
] as const;

export function SiteLanguageMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  function closeMenu() { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); }

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const visible = languages.filter(([code, label]) => `${code} ${label}`.toLowerCase().includes(query.toLowerCase()));
  function translate(code: string) {
    const target = encodeURIComponent(window.location.href);
    window.open(`https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(code)}&u=${target}`, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <div className="site-language-menu" ref={rootRef}>
      <button ref={triggerRef} className="header-icon-button" type="button" title="Translate this page" aria-label="Translate this page" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <GlobeHemisphereWest size={18} />
      </button>
      {open ? <div className="site-language-popover" role="dialog" aria-label="Choose translation language" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(); } }}>
        <div><strong>Translate page</strong><button type="button" aria-label="Close" onClick={closeMenu}><X size={15} /></button></div>
        <label><MagnifyingGlass size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search language…" /></label>
        <div className="language-options">{visible.map(([code, label]) => <button type="button" key={code} onClick={() => translate(code)}><span>{label}</span><small>{code}</small></button>)}</div>
        <p>Translation opens in a new page. This original page stays available in its own language.</p>
      </div> : null}
    </div>
  );
}
