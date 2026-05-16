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

export type VizData = {
  totalCitations: number
  uniqueCited: number
}

export type DbData = {
  totalPapers: number
  summary: { label: string; value: string }[]
  years: { year: string; count: number }[]
  journals: { name: string; count: number }[]
  norms: { name: string; count: number }[]
  languages: { name: string; count: number }[]
  participantTypes: { name: string; count: number }[]
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

function HBar({ data, color = PRIMARY, yAxisWidth = 160 }: { data: { name: string; count: number }[]; color?: string; yAxisWidth?: number }) {
  return (
    <ResponsiveContainer width="100%" height={data.length * 28 + 10}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={yAxisWidth}
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card card-bordered bg-base-200">
      <div className="card-body p-5">
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm text-base-content/60">{label}</p>
      </div>
    </div>
  )
}

export function VizStats({ data }: { data: VizData }) {
  return (
    <div className="grid grid-cols-2 gap-4 mt-4">
      <StatCard label="Citation relationships stored" value={data.totalCitations.toLocaleString()} />
      <StatCard label="Unique cited papers not yet in DB" value={data.uniqueCited.toLocaleString()} />
    </div>
  )
}

export function DbCharts({ data }: { data: DbData }) {
  return (
    <div className="space-y-6">
      <div className="card card-bordered bg-base-200">
        <div className="card-body p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-4">
            {data.summary.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                <p className="text-xs text-base-content/60 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Papers by publication year">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.years} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
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
          <HBar data={data.journals} yAxisWidth={220} />
        </ChartCard>

        <ChartCard title="Norms collected">
          <HBar data={data.norms} color="oklch(55% 0.18 160)" />
        </ChartCard>

        <ChartCard title="Languages">
          <HBar data={data.languages} color="oklch(55% 0.18 30)" />
        </ChartCard>

        {data.participantTypes.length > 0 && (
          <ChartCard title="Participant types">
            <HBar data={data.participantTypes} color="oklch(55% 0.18 310)" />
          </ChartCard>
        )}
      </div>
    </div>
  )
}
