"use client";

import { FullPageLink as Link } from "./full-page-link";
import { useEffect, useMemo, useState } from "react";
import type { SearchRecord } from "@/lib/editorial";

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize("NFKC");
}

export function SearchClient({ records }: { records: SearchRecord[] }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return records.slice(0, 12);
    return records
      .map((record) => {
        const title = normalize(record.title);
        const text = normalize(`${record.summary} ${record.body} ${record.type}`);
        const score = terms.reduce(
          (total, term) => total + (title.includes(term) ? 5 : 0) + (text.includes(term) ? 1 : 0),
          0,
        );
        return { record, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
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
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Try BSTVC, maternal health, 医疗资源…"
        autoComplete="off"
      />
      <p className="search-status" aria-live="polite">
        {query ? `${results.length} matching results` : "Recent and featured content"}
      </p>
      <div className="search-results">
        {results.map((record, index) => (
          <Link href={record.href} key={`${record.type}-${record.href}-${index}`}>
            <span>{record.type}</span>
            <h2>{record.title}</h2>
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
