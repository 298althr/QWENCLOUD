"use client";

import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

type Props = {
  data: { name: string; value: number }[];
  color?: string;
  height?: number;
};

export function BarChart({ data, color = "#d4af5f", height = 200 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c2438" vertical={false} />
        <XAxis dataKey="name" stroke="#3a4768" fontSize={10} tickLine={false} axisLine={false} />
        <YAxis stroke="#3a4768" fontSize={10} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "#0f1422",
            border: "1px solid #1c2438",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#e6e9f2",
          }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
