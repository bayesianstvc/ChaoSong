"use client";

import { FullPageLink as Link } from "./full-page-link";
import { usePathname } from "next/navigation";

const navigation = [
  ["Home", "/"],
  ["BSTVC Ecosystem", "/bstvc"],
  ["Research", "/research"],
  ["Publications", "/publications"],
  ["Resources", "/resources"],
  ["News", "/news"],
  ["Blogs", "/blogs"],
  ["About", "/about"],
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteNav() {
  const pathname = usePathname();
  return (
    <>
      <nav className="desktop-nav" aria-label="Primary navigation">
        {navigation.map(([label, href]) => (
          <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <details className="mobile-nav">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          {navigation.map(([label, href]) => (
            <Link key={href} href={href} aria-current={isActive(pathname, href) ? "page" : undefined}>
              {label}
            </Link>
          ))}
          <Link href="/search">Search</Link>
        </nav>
      </details>
    </>
  );
}
