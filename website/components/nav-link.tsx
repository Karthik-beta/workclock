'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * A header link. Fumadocs marks active links with `data-active`, which in the sidebar drawer
 * would pick up the amber current-page bar; the current section is shown in ink instead.
 */
export function NavLink({
  href,
  nested = false,
  except = [],
  children,
}: {
  href: string;
  /** Also current on pages under `href`, apart from those in `except`. */
  nested?: boolean;
  except?: string[];
  children: string;
}) {
  const path = withSlash(usePathname());
  const active = nested ? path.startsWith(href) && !except.includes(path) : path === href;
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center p-2 text-ui font-medium transition-colors hover:text-text ${active ? 'text-text' : 'text-text-2'}`}
    >
      {children}
    </Link>
  );
}

function withSlash(path: string) {
  return path.endsWith('/') ? path : `${path}/`;
}
