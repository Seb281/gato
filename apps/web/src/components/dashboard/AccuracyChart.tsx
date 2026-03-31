"use client";

type Session = {
  accuracy: number;
  completedAt: string;
};

type AccuracyChartProps = {
  sessions: Session[];
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

export default function AccuracyChart({ sessions }: AccuracyChartProps) {
  if (sessions.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Not enough data to display the accuracy trend. Complete at least 2
        review sessions.
      </div>
    );
  }

  // Take last 30 sessions sorted by date ascending
  const sorted = [...sessions]
    .sort(
      (a, b) =>
        new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    )
    .slice(-30);

  // Chart layout constants
  const viewWidth = 600;
  const viewHeight = 200;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 10;
  const paddingBottom = 30;

  const chartWidth = viewWidth - paddingLeft - paddingRight;
  const chartHeight = viewHeight - paddingTop - paddingBottom;

  // Map data to chart coordinates
  const points = sorted.map((s, i) => ({
    x: paddingLeft + (sorted.length === 1 ? chartWidth / 2 : (i / (sorted.length - 1)) * chartWidth),
    y: paddingTop + chartHeight - (s.accuracy / 100) * chartHeight,
    accuracy: s.accuracy,
    date: formatDate(s.completedAt),
  }));

  // Build polyline points string
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Grid lines at 0%, 25%, 50%, 75%, 100%
  const gridLevels = [0, 25, 50, 75, 100];

  // X-axis labels: first, middle, last
  const xLabels: { index: number; label: string }[] = [];
  if (sorted.length >= 1) {
    xLabels.push({ index: 0, label: formatDate(sorted[0].completedAt) });
  }
  if (sorted.length >= 3) {
    const mid = Math.floor(sorted.length / 2);
    xLabels.push({ index: mid, label: formatDate(sorted[mid].completedAt) });
  }
  if (sorted.length >= 2) {
    xLabels.push({
      index: sorted.length - 1,
      label: formatDate(sorted[sorted.length - 1].completedAt),
    });
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {gridLevels.map((level) => {
          const y =
            paddingTop + chartHeight - (level / 100) * chartHeight;
          return (
            <line
              key={level}
              x1={paddingLeft}
              y1={y}
              x2={paddingLeft + chartWidth}
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
          );
        })}

        {/* Y-axis labels */}
        {gridLevels.map((level) => {
          const y =
            paddingTop + chartHeight - (level / 100) * chartHeight;
          return (
            <text
              key={`y-label-${level}`}
              x={paddingLeft - 8}
              y={y + 4}
              textAnchor="end"
              fill="hsl(var(--muted-foreground))"
              fontSize="10"
            >
              {level}%
            </text>
          );
        })}

        {/* X-axis labels */}
        {xLabels.map(({ index, label }) => (
          <text
            key={`x-label-${index}`}
            x={points[index].x}
            y={viewHeight - 5}
            textAnchor="middle"
            fill="hsl(var(--muted-foreground))"
            fontSize="10"
          >
            {label}
          </text>
        ))}

        {/* Line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data point dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="hsl(var(--primary))"
          />
        ))}
      </svg>
    </div>
  );
}
