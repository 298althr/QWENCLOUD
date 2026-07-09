"use client";

import { RadialBar, RadialBarChart, ResponsiveContainer, PolarAngleAxis } from "recharts";

type Props = {
  value: number;
  max?: number;
  label?: string;
  color?: string;
  size?: number;
};

export function Gauge({ value, max = 100, label, color = "#d4af5f", size = 160 }: Props) {
  const data = [{ name: label || "value", value, fill: color }];
  const pct = Math.min((value / max) * 100, 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
          <RadialBar background={{ fill: "#1c2438" }} dataKey="value" cornerRadius={8} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{value.toFixed(1)}</span>
        {label && <span className="text-[10px] uppercase tracking-wider text-ink-600">{label}</span>}
      </div>
    </div>
  );
}
