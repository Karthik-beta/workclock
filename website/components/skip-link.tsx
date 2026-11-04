export function SkipLink({ href }: { href: '#nd-page' | '#main-content' }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-60 focus:rounded-md focus:bg-raised focus:px-4 focus:py-2 focus:text-ui focus:text-text"
    >
      Skip to content
    </a>
  );
}
