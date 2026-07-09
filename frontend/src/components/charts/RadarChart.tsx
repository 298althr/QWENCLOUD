"use client";

import { Radar, RadarChart as RechartsRadarChart, ResponsiveContainer, Tooltip, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

type Props = {
  data: { axis: string; value: number }[];
  color?: string;
  height?: number;
};

export function RadarChart({ data, color = "#d4af5f", height = 250 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsRadarChart data={data}>
        <PolarGrid stroke="#1c2438" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: "#3a4768", fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 5]} tick={{ fill: "#27314a", fontSize: 9 }} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "#0f1422",
            border: "1px solid #1c2438",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#e6e9f2",
          }}
        />
        <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.3} strokeWidth={2} />
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
