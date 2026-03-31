"use client";

import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";

type MasteryDistribution = {
  new: number;
  learning: number;
  familiar: number;
  mastered: number;
};

type ShareCardProps = {
  totalWords: number;
  masteredCount: number;
  accuracy: number;
  streak: number;
  distribution?: MasteryDistribution;
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function generateShareCard(props: ShareCardProps): Promise<Blob | null> {
  const { totalWords, masteredCount, accuracy, streak, distribution } = props;

  const W = 1200;
  const H = 630;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  // --- Background ---
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, W, H);

  // Subtle grid pattern for texture
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Accent glow top-left
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 500);
  glow.addColorStop(0, "rgba(99,102,241,0.15)");
  glow.addColorStop(1, "rgba(99,102,241,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // --- Header area ---
  const PADDING = 72;

  // App title label
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = `500 18px 'Inter', 'system-ui', sans-serif`;
  ctx.fillText("Context-Aware Translator", PADDING, PADDING + 10);

  // Divider line under title
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, PADDING + 30);
  ctx.lineTo(W - PADDING, PADDING + 30);
  ctx.stroke();

  // Main headline
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 56px 'Inter', 'system-ui', sans-serif`;
  ctx.fillText("My Language Progress", PADDING, PADDING + 100);

  // --- Stats cards ---
  const stats = [
    { label: "Total Words", value: String(totalWords), color: "#a3a3a3" },
    { label: "Mastered", value: String(masteredCount), color: "#10b981" },
    {
      label: "Accuracy",
      value: `${accuracy}%`,
      color: "#6366f1",
    },
    {
      label: "Day Streak",
      value: String(streak),
      color: "#f59e0b",
    },
  ];

  const cardY = PADDING + 140;
  const cardH = 150;
  const cardGap = 24;
  const totalCardsWidth = W - PADDING * 2;
  const cardW = (totalCardsWidth - cardGap * (stats.length - 1)) / stats.length;

  stats.forEach((stat, i) => {
    const cardX = PADDING + i * (cardW + cardGap);

    // Card background
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();

    // Card border
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 12);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Accent top bar
    drawRoundedRect(ctx, cardX + 24, cardY + 20, 32, 3, 2);
    ctx.fillStyle = stat.color;
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `500 13px 'Inter', 'system-ui', sans-serif`;
    ctx.fillText(stat.label.toUpperCase(), cardX + 24, cardY + 58);

    // Value
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 42px 'Inter', 'system-ui', sans-serif`;
    ctx.fillText(stat.value, cardX + 24, cardY + 115);
  });

  // --- Mastery bar ---
  const barY = cardY + cardH + 48;
  const barX = PADDING;
  const barW = W - PADDING * 2;
  const barH = 12;
  const barRadius = 6;

  // Label
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = `500 13px 'Inter', 'system-ui', sans-serif`;
  ctx.fillText("MASTERY DISTRIBUTION", barX, barY - 12);

  // Bar background
  drawRoundedRect(ctx, barX, barY, barW, barH, barRadius);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();

  // Segments
  if (distribution && totalWords > 0) {
    const segments = [
      { key: "new", color: "#a3a3a3", count: distribution.new },
      { key: "learning", color: "#60a5fa", count: distribution.learning },
      { key: "familiar", color: "#fbbf24", count: distribution.familiar },
      { key: "mastered", color: "#10b981", count: distribution.mastered },
    ];

    let offsetX = barX;
    segments.forEach((seg) => {
      const pct = seg.count / totalWords;
      const segW = barW * pct;
      if (segW < 1) return;
      ctx.fillStyle = seg.color;
      ctx.fillRect(offsetX, barY, segW, barH);
      offsetX += segW;
    });

    // Re-clip to rounded bar shape
    drawRoundedRect(ctx, barX, barY, barW, barH, barRadius);
    ctx.globalCompositeOperation = "destination-in";
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // Legend
    const legendY = barY + barH + 28;
    let legendX = barX;
    const legendLabels: Record<string, string> = {
      new: "New",
      learning: "Learning",
      familiar: "Familiar",
      mastered: "Mastered",
    };

    segments.forEach((seg) => {
      if (seg.count === 0) return;

      // Dot
      ctx.beginPath();
      ctx.arc(legendX + 5, legendY - 4, 5, 0, Math.PI * 2);
      ctx.fillStyle = seg.color;
      ctx.fill();

      // Text
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `400 13px 'Inter', 'system-ui', sans-serif`;
      const label = `${legendLabels[seg.key]} ${seg.count}`;
      ctx.fillText(label, legendX + 16, legendY);

      legendX += ctx.measureText(label).width + 36;
    });
  } else if (totalWords > 0) {
    // Solid mastered bar
    const masteredPct = masteredCount / totalWords;
    const masteredW = barW * masteredPct;
    if (masteredW > 1) {
      drawRoundedRect(ctx, barX, barY, masteredW, barH, barRadius);
      ctx.fillStyle = "#10b981";
      ctx.fill();
    }
  }

  // --- Footer ---
  const footerY = H - PADDING + 10;

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, footerY - 28);
  ctx.lineTo(W - PADDING, footerY - 28);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.font = `400 15px 'Inter', 'system-ui', sans-serif`;
  ctx.fillText("context-aware-translator.vercel.app", PADDING, footerY);

  // Right-side footer text
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  ctx.textAlign = "right";
  ctx.fillText(date, W - PADDING, footerY);
  ctx.textAlign = "left";

  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}

export default function ShareCard({
  totalWords,
  masteredCount,
  accuracy,
  streak,
  distribution,
}: ShareCardProps) {
  async function handleShare() {
    const blob = await generateShareCard({
      totalWords,
      masteredCount,
      accuracy,
      streak,
      distribution,
    });
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-language-progress.png";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" onClick={handleShare}>
      <Share2 />
      Share Progress
    </Button>
  );
}
