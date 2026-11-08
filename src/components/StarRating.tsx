export function StarRating({
  value,
  count,
  size = "sm",
}: {
  value: number;
  count?: number;
  size?: "xs" | "sm" | "lg";
}) {
  const px = size === "xs" ? "h-3 w-3" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value.toFixed(1)} out of 5 stars${count !== undefined ? `, ${count} reviews` : ""}`}>
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = rounded >= i ? 1 : rounded >= i - 0.5 ? 0.5 : 0;
          return (
            <svg key={i} viewBox="0 0 20 20" className={px}>
              <defs>
                <linearGradient id={`s${i}-${fill}`}>
                  <stop offset={`${fill * 100}%`} stopColor="#f2a93b" />
                  <stop offset={`${fill * 100}%`} stopColor="#dfe6ec" />
                </linearGradient>
              </defs>
              <path
                fill={`url(#s${i}-${fill})`}
                d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z"
              />
            </svg>
          );
        })}
      </span>
      <span className={`font-semibold text-ink ${size === "lg" ? "text-base" : "text-xs"}`}>{value.toFixed(1)}</span>
      {count !== undefined && <span className={`text-muted ${size === "lg" ? "text-sm" : "text-xs"}`}>({count})</span>}
    </span>
  );
}
