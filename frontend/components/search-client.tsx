"use client";

import { FullPageLink as Link } from "./full-page-link";
import { useEffect, useMemo, useState } from "react";
import type { SearchRecord } from "@/lib/editorial";

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize("NFKC");
}

function isArchived(record: SearchRecord) {
  return record.type === "archive page" || record.type === "journal archive";
}

export function SearchClient({ records }: { records: SearchRecord[] }) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const read = () => setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
    read(); window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  function updateQuery(value: string) {
    setQuery(value);
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("q", value); else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }
  const results = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return records.slice(0, 12);
    return records
      .map((record) => {
        const title = normalize(record.title);
        const text = normalize(`${record.summary} ${record.body} ${record.type}`);
        const titleHits = terms.filter(term => title.includes(term)).length;
        const bodyHits = terms.filter(term => text.includes(term)).length;
        return { record, titleHits, bodyHits, exactTitle: title === terms.join(" ") };
      })
      .filter((item) => item.titleHits > 0 || item.bodyHits > 0)
      .sort((a, b) => Number(b.exactTitle) - Number(a.exactTitle) || b.titleHits - a.titleHits ||
        Number(isArchived(a.record)) - Number(isArchived(b.record)) || b.bodyHits - a.bodyHits)
      .slice(0, 30)
      .map((item) => item.record);
  }, [query, records]);



  return (
    <section className="search-panel">
      <label htmlFor="site-search">Search the complete research archive</label>
      <input
        id="site-search"
        type="search"
        value={query}
        onChange={(event) => updateQuery(event.target.value)}
        placeholder="Try BSTVC, maternal health, 医疗资源…"
        autoComplete="off"
      />
      <p className="search-status" aria-live="polite">
        {query ? `${results.length} matching results` : "Recent and featured content"}
      </p>
      <div className="search-results">
        {results.map((record, index) => (
          <Link href={record.href} key={`${record.type}-${record.href}-${index}`}>
            <span>{isArchived(record) ? "Source archive" : record.type}</span>
            <h2 lang={record.language}>{record.title}</h2>
            <p>{record.summary || record.body.slice(0, 180)}</p>
            <small>
              {record.date ?? "Undated"} · {record.language === "zh" ? "中文" : "English"}
            </small>
          </Link>
        ))}
        {query && !results.length ? (
          <p className="empty-results">No result yet. Try a broader English or Chinese keyword.</p>
        ) : null}
      </div>
    </section>
  );
}
