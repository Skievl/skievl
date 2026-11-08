/** Simple line icons for categories (original artwork). */
export function CategoryIcon({ slug, className = "h-8 w-8" }: { slug: string; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    skis: (<><path {...common} d="M7 3c1 0 1.5 1 1.5 2v16" /><path {...common} d="M15 3c1 0 1.5 1 1.5 2v16" /><path {...common} d="M6 13h4M14 13h4" /></>),
    snowboards: (<><rect {...common} x="8" y="2" width="8" height="20" rx="4" /><path {...common} d="M9.5 8h5M9.5 16h5" /></>),
    "ski-boots": (<path {...common} d="M7 3h7l1 9 4 3v4H5v-3l2-2z M5 19h14" />),
    "snowboard-boots": (<path {...common} d="M8 3h6v9c3 1 5 2 5 5v2H5v-6z M9 7h4M9 10h4" />),
    bindings: (<><path {...common} d="M4 16h16" /><path {...common} d="M7 16V9a5 5 0 0 1 10 0v7" /></>),
    helmets: (<path {...common} d="M4 15a8 8 0 0 1 16 0v2H4z M12 7v4M8 17v2M16 17v2" />),
    goggles: (<><rect {...common} x="3" y="8" width="18" height="8" rx="4" /><path {...common} d="M12 11v2" /></>),
    "ski-apparel": (<path {...common} d="M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3a4 4 0 0 1-8 0z" />),
    "snowboard-apparel": (<path {...common} d="M7 3 3 7l2 3 2-1v12h10V9l2 1 2-3-4-4h-3l-1 3-1-3z" />),
    "jackets-pants": (<path {...common} d="M7 3h10l1 18h-5l-1-10-1 10H6z" />),
    "gloves-mittens": (<path {...common} d="M7 21v-6l-3-4 2-1 2 2V5a2 2 0 0 1 4 0v4h4a3 3 0 0 1 3 3v9z" />),
    poles: (<><path {...common} d="M8 2l2 20M16 2l-2 20" /><circle {...common} cx="9.6" cy="18" r="1.6" /><circle {...common} cx="14.4" cy="18" r="1.6" /></>),
    accessories: (<><rect {...common} x="5" y="7" width="14" height="13" rx="2" /><path {...common} d="M9 7V5a3 3 0 0 1 6 0v2" /></>),
    other: (<><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="M8 12h8M12 8v8" /></>),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {paths[slug] ?? paths.other}
    </svg>
  );
}
