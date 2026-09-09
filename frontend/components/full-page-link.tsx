import type { AnchorHTMLAttributes, ReactNode } from "react";
import { safePublicHref } from "@/lib/public-href";

type FullPageLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
};

/**
 * Uses a normal document navigation. Sites currently serves every route
 * correctly, while the framework's client-side transition can stall before
 * the request reaches the deployed Worker.
 */
export function FullPageLink({ href, children, ...props }: FullPageLinkProps) {
  return <a href={safePublicHref(href) ?? undefined} {...props}>{children}</a>;
}
