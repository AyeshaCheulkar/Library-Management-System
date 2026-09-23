const SPINES = [
  { w: 20, h: 128, fill: "var(--ink)", tint: 0.92 },
  { w: 14, h: 152, fill: "var(--ember)", tint: 1 },
  { w: 24, h: 116, fill: "var(--surface-2)", stroke: true },
  { w: 16, h: 164, fill: "var(--ink-soft)", tint: 0.9 },
  { w: 18, h: 134, fill: "var(--ember-soft)", stroke: true },
  { w: 22, h: 156, fill: "var(--ink)", tint: 0.86 },
  { w: 14, h: 122, fill: "var(--ember)", tint: 0.85 },
  { w: 20, h: 146, fill: "var(--surface-2)", stroke: true },
];

const GAP = 4;
const BASE = 236;
const START = 26;

export default function LibraryMark({ className = "" }) {
  let x = START;

  return (
    <svg
      className={`mark ${className}`}
      viewBox="0 0 300 280"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <g className="mark__books">
        {SPINES.map((spine, index) => {
          const left = x;
          x += spine.w + GAP;

          return (
            <g key={left} className="mark__spine" style={{ "--i": index }}>
              <rect
                x={left}
                y={BASE - spine.h}
                width={spine.w}
                height={spine.h}
                rx="2.5"
                fill={spine.fill}
                fillOpacity={spine.tint ?? 1}
                stroke={spine.stroke ? "var(--line)" : "none"}
                strokeWidth={spine.stroke ? 1.25 : 0}
              />
              <rect
                x={left + 3}
                y={BASE - spine.h + 14}
                width={spine.w - 6}
                height="1.5"
                fill="var(--paper)"
                fillOpacity="0.55"
              />
              <rect
                x={left + 3}
                y={BASE - spine.h + 20}
                width={spine.w - 6}
                height="1.5"
                fill="var(--paper)"
                fillOpacity="0.35"
              />
            </g>
          );
        })}

        <g className="mark__pulled">
          <rect
            x={x + 6}
            y={BASE - 140}
            width="21"
            height="140"
            rx="2.5"
            fill="var(--ember)"
            stroke="var(--accent-ink)"
            strokeWidth="1"
          />
          <rect
            x={x + 9}
            y={BASE - 126}
            width="15"
            height="1.5"
            fill="var(--paper)"
            fillOpacity="0.6"
          />
          <rect
            x={x + 9}
            y={BASE - 120}
            width="15"
            height="1.5"
            fill="var(--paper)"
            fillOpacity="0.4"
          />
        </g>
      </g>

      <rect x="14" y={BASE} width="272" height="5" rx="2.5" fill="var(--ink)" fillOpacity="0.16" />
      <rect x="26" y={BASE + 5} width="10" height="26" rx="2" fill="var(--ink)" fillOpacity="0.09" />
      <rect x="264" y={BASE + 5} width="10" height="26" rx="2" fill="var(--ink)" fillOpacity="0.09" />
    </svg>
  );
}
