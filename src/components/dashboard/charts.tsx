"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Flow = { day: string; entradas: number; saidas: number };
type Point = { day: string; total: number };
type Slice = { name: string; total: number; fill?: string };
type Consumption = { code: string; name: string; quantity: number };

export function DashboardCharts({
  categories,
  situations,
  flow,
  requests,
  consumption,
}: {
  categories: Slice[];
  situations: Slice[];
  flow: Flow[];
  requests: Point[];
  consumption: Consumption[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Entradas e saídas">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={flow}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={4} />
            <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Solicitações abertas no período">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={requests}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="total" name="Solicitações" stroke="#60a5fa" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Materiais por categoria">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={categories} layout="vertical" margin={{ left: 24 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="total" name="Materiais" fill="#3b82f6" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Situação do estoque">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={situations} dataKey="total" nameKey="name" innerRadius={55} outerRadius={90}>
              {situations.map((item) => (
                <Cell key={item.name} fill={item.fill || "#64748b"} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Materiais com maior consumo" className="xl:col-span-2">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={consumption}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
            <XAxis dataKey="code" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value, _name, item) => [`${value} un`, item.payload.name]} />
            <Bar dataKey="quantity" name="Consumo" fill="#f59e0b" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 ${className || ""}`}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
