/**
 * The home button's picture: a flat toothpaste tube (crimped end, long body, short shoulder, small
 * ribbed cap), pink with a mint cap and a tooth on a white label. Nearly horizontal so it stays
 * readable at 40 px. Decorative: the button carries the accessible name.
 */
const ToothpasteTubeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <g transform="translate(24 25) rotate(-12) scale(.9) translate(-24 -24)">
      {/* Body, slightly pinched towards the crimp like a squeezed tube */}
      <path
        d="M7 15.5 C13 14.5 24 14 30 14.5 L36 20 V28 L30 33.5 C24 34 13 33.5 7 32.5 Z"
        className="fill-bubblegum stroke-ink"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Flat crimped end with ridges */}
      <path d="M2 15 H7.5 V33 H2 Z" className="fill-bubblegum stroke-ink" strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 17V31M5.8 17V31" className="stroke-ink" strokeWidth="1.1" opacity=".55" />
      {/* White label with a tooth */}
      <path d="M14 14.4 H24.5 V33.9 H14 Z" className="fill-white stroke-ink" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M19.3 18.6c-2.4-1.1-4 .8-3.5 3.1.3 1.5.8 4.4 1.5 5.7.4.8 1.1.6 1.4-.3.3-1 .5-2 .6-2 .1 0 .3 1 .6 2 .3.9 1 1.1 1.4.3.7-1.3 1.2-4.2 1.5-5.7.5-2.3-1.1-4.2-3.5-3.1z"
        className="fill-mint stroke-ink"
        strokeWidth="1.2"
        strokeLinejoin="round"
        transform="translate(0.4 0.6)"
      />
      {/* Shine */}
      <path d="M9.5 18.2 H13 M26 17 H30" className="stroke-white" strokeWidth="2" strokeLinecap="round" opacity=".6" />
      {/* Cap */}
      <rect x="35.5" y="19.5" width="9.5" height="9" rx="2" className="fill-mint stroke-ink" strokeWidth="2" strokeLinejoin="round" />
      <path d="M38.5 21.2V26.8M41 21.2V26.8" className="stroke-ink" strokeWidth="1.1" opacity=".45" />
    </g>
  </svg>
);

export default ToothpasteTubeIcon;
