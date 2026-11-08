/** Layered ridgeline evoking the hills around Ellicottville / Holiday Valley. */
export function Mountains({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className={className} aria-hidden>
      <path fill="#2f6f9f" fillOpacity=".35" d="M0 210 120 150l110 40 140-90 120 70 150-110 130 80 120-50 170 100 120-60 160 70v120H0z" />
      <path fill="#1f4d3a" fillOpacity=".8" d="M0 250 140 190l90 30 130-70 160 90 110-50 140 60 120-80 150 70 140-40 160 60v110H0z" />
      {/* trail cuts */}
      <path fill="#f5f8fa" fillOpacity=".6" d="M520 238l38-52 10 4-34 54zM905 230l30-46 9 4-26 48zM600 250l24-38 8 3-20 40z" />
      <path fill="#f5f8fa" d="M0 290c240-30 480-40 720-30s480 20 720-10v70H0z" />
    </svg>
  );
}
