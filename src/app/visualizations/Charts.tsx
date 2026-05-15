"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

type ChartData = {
  years: { year: string; count: number }[]
  journals: { name: string; count: number }[]
  norms: { name: string; count: number }[]
  languages: { name: string; count: number }[]
  participantTypes: { name: string; count: number }[]
  totalPapers: number
  totalCitations: number
  uniqueCited: number
}

const PRIMARY = "oklch(55% 0.2 250)"
const MUTED = "oklch(65% 0.1 250)"

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card card-bordered bg-base-200">
      <div className="card-body p-5">
        <h3 className="font-semibold text-sm mb-3">{title}</h3>
        {children}
      </div>
    </div>
  )
}

function HBar({ data, color = PRIMARY }: { data: { name: string; count: number }[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={data.length * 28 + 10}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={160}
          tick={{ fontSize: 12, fill: "currentColor" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "oklch(80% 0 0 / 0.1)" }}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(v: number) => [v.toLocaleString(), "papers"]}
        />
        <Bar dataKey="count" radius={[0, 3, 3, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? color : MUTED} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Charts({ chartData }: { chartData: ChartData }) {
  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Accepted papers", value: chartData.totalPapers.toLocaleString() },
          { label: "Citation relationships", value: chartData.totalCitations.toLocaleString() },
          { label: "Unique cited (not in DB)", value: chartData.uniqueCited.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="card card-bordered bg-base-200">
            <div className="card-body p-5">
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-sm text-base-content/60">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Papers by publication year">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData.years} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11, fill: "currentColor" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "currentColor" }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "oklch(80% 0 0 / 0.1)" }}
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
                formatter={(v: number) => [v.toLocaleString(), "papers"]}
              />
              <Bar dataKey="count" fill={PRIMARY} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top journals">
          <HBar data={chartData.journals} />
        </ChartCard>

        <ChartCard title="Norms collected">
          <HBar data={chartData.norms} color="oklch(55% 0.18 160)" />
        </ChartCard>

        <ChartCard title="Languages">
          <HBar data={chartData.languages} color="oklch(55% 0.18 30)" />
        </ChartCard>

        {chartData.participantTypes.length > 0 && (
          <ChartCard title="Participant types">
            <HBar data={chartData.participantTypes} color="oklch(55% 0.18 310)" />
          </ChartCard>
        )}
      </div>
    </div>
  )
}
