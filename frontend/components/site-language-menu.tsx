"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const searchRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const popoverId = `${menuId}-popover`;
  const titleId = `${menuId}-title`;
  const descriptionId = `${menuId}-description`;
  function closeMenu() { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); }

  useEffect(() => {
    if (open) searchRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const visible = languages.filter(([code, label]) => `${code} ${label}`.toLowerCase().includes(query.toLowerCase()));
  function translate(code: string) {
    const target = encodeURIComponent(window.location.href);
    window.open(`https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(code)}&u=${target}`, "_blank", "noopener,noreferrer");
    closeMenu();
  }

  return (
    <div className="site-language-menu" ref={rootRef}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={(event) => { if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(); } }}>
      <button ref={triggerRef} className="header-icon-button" type="button" title="Translate this page" aria-label="Translate this page" aria-haspopup="dialog" aria-controls={open ? popoverId : undefined} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <GlobeHemisphereWest size={18} aria-hidden="true" />
      </button>
      {open ? <div className="site-language-popover" id={popoverId} role="dialog" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div><strong id={titleId}>Translate page</strong><button type="button" aria-label="Close translation languages" onClick={closeMenu}><X size={15} aria-hidden="true" /></button></div>
        <label><MagnifyingGlass size={15} aria-hidden="true" /><input ref={searchRef} aria-label="Search translation languages" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search language…" /></label>
        <div className="language-options">{visible.map(([code, label]) => <button type="button" key={code} onClick={() => translate(code)}><span>{label}</span><small>{code}</small></button>)}</div>
        <p id={descriptionId}>Translation opens in a new page. This original page stays available in its own language.</p>
      </div> : null}
    </div>
  );
}
