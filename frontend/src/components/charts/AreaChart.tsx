"use client";

import { Area, AreaChart as RechartsAreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

type Props = {
  data: { time: string; value: number }[];
  color?: string;
  label?: string;
  height?: number;
  threshold?: number;
};

export function AreaChart({ data, color = "#d4af5f", label = "Value", height = 200, threshold }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c2438" vertical={false} />
        <XAxis
          dataKey="time"
          stroke="#3a4768"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#3a4768"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
        />
        <Tooltip
          contentStyle={{
            background: "#0f1422",
            border: "1px solid #1c2438",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#e6e9f2",
          }}
          labelStyle={{ color: "#3a4768" }}
        />
        {threshold !== undefined && (
          <CartesianGrid
            horizontalCoordinatesGenerator={() => [threshold]}
            stroke="#ff5c5c"
            strokeDasharray="5 5"
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${label})`}
          name={label}
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
