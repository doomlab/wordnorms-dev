#!/usr/bin/env node
/**
 * Queries the database for a weekly admin summary and emails all ADMIN and SUPER_ADMIN users.
 *
 * Cron (weekly, Mondays at 8am):
 *   0 8 * * 1 cd /path/to/wordnorms-dev && node --env-file=.env.local scripts/weekly-admin-summary.mjs >> /var/log/wordnorms-weekly.log 2>&1
 *
 * Run manually:
 *   node --env-file=.env.local scripts/weekly-admin-summary.mjs
 */

import { PrismaClient } from "@prisma/client"
import { Resend } from "resend"

const db = new PrismaClient()
const resend = new Resend(process.env.RESEND_API_KEY)

const APP_ORIGIN = process.env.APP_ORIGIN || "https://wordnorms.com"

async function collectStats() {
  const now = new Date()
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

  const [
    adminUsers,
    papersByStatus,
    newPapersThisWeek,
    totalUsers,
    newUsersThisWeek,
    usersByRole,
    unresolvedReports,
    unresolvedMetadataEdits,
    unresolvedExtractionEdits,
    unresolvedArticleSuggestions,
    recentPipelineRuns,
    latestModelRun,
    totalExtractions,
  ] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { email: true },
    }),
    db.paper.groupBy({ by: ["status"], _count: { _all: true } }),
    db.paper.count({ where: { createdAt: { gte: weekAgo } } }),
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: weekAgo } } }),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.paperReport.count({ where: { resolved: false } }),
    db.metadataEditSuggestion.count({ where: { resolved: false } }),
    db.extractionEditSuggestion.count({ where: { resolved: false } }),
    db.articleSuggestion.count({ where: { resolved: false } }),
    db.pipelineRun.findMany({
      where: { createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, createdAt: true, status: true, step: true, finishedAt: true },
    }),
    db.modelRun.findFirst({
      orderBy: { createdAt: "desc" },
    }),
    db.paperExtraction.count(),
  ])

  return {
    now,
    weekAgo,
    adminUsers,
    papersByStatus,
    newPapersThisWeek,
    totalUsers,
    newUsersThisWeek,
    usersByRole,
    unresolvedReports,
    unresolvedMetadataEdits,
    unresolvedExtractionEdits,
    unresolvedArticleSuggestions,
    recentPipelineRuns,
    latestModelRun,
    totalExtractions,
  }
}

function statusColor(status) {
  const colors = {
    PENDING_REVIEW: "#f59e0b",
    PENDING_PDF: "#6366f1",
    ACCEPTED: "#10b981",
    EXCLUDED: "#ef4444",
    ADDED_TO_TRAINING: "#3b82f6",
  }
  return colors[status] || "#6b7280"
}

function pipelineStatusColor(status) {
  return status === "DONE" ? "#10b981" : status === "FAILED" ? "#ef4444" : "#f59e0b"
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function buildHtml(stats) {
  const {
    now,
    papersByStatus,
    newPapersThisWeek,
    totalUsers,
    newUsersThisWeek,
    usersByRole,
    unresolvedReports,
    unresolvedMetadataEdits,
    unresolvedExtractionEdits,
    unresolvedArticleSuggestions,
    recentPipelineRuns,
    latestModelRun,
    totalExtractions,
  } = stats

  const totalPapers = papersByStatus.reduce((s, r) => s + r._count._all, 0)

  const paperRows = papersByStatus
    .sort((a, b) => b._count._all - a._count._all)
    .map(
      (r) =>
        `<tr>
          <td style="padding:5px 12px 5px 0;vertical-align:middle">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${statusColor(r.status)};margin-right:6px"></span>${r.status.replace(/_/g, " ")}
          </td>
          <td style="padding:5px 0;font-weight:bold;text-align:right">${r._count._all.toLocaleString()}</td>
        </tr>`
    )
    .join("")

  const roleRows = usersByRole
    .map(
      (r) =>
        `<tr>
          <td style="padding:5px 12px 5px 0">${r.role}</td>
          <td style="padding:5px 0;font-weight:bold;text-align:right">${r._count._all}</td>
        </tr>`
    )
    .join("")

  const actionItems = [
    unresolvedReports > 0
      ? `<li style="margin-bottom:4px"><a href="${APP_ORIGIN}/admin/reports" style="color:#3b82f6">${unresolvedReports} unresolved paper report${unresolvedReports !== 1 ? "s" : ""}</a></li>`
      : "",
    unresolvedMetadataEdits > 0
      ? `<li style="margin-bottom:4px"><a href="${APP_ORIGIN}/admin/edits" style="color:#3b82f6">${unresolvedMetadataEdits} unresolved metadata edit suggestion${unresolvedMetadataEdits !== 1 ? "s" : ""}</a></li>`
      : "",
    unresolvedExtractionEdits > 0
      ? `<li style="margin-bottom:4px"><a href="${APP_ORIGIN}/admin/edits" style="color:#3b82f6">${unresolvedExtractionEdits} unresolved extraction edit suggestion${unresolvedExtractionEdits !== 1 ? "s" : ""}</a></li>`
      : "",
    unresolvedArticleSuggestions > 0
      ? `<li style="margin-bottom:4px"><a href="${APP_ORIGIN}/admin/suggestions" style="color:#3b82f6">${unresolvedArticleSuggestions} unresolved article suggestion${unresolvedArticleSuggestions !== 1 ? "s" : ""}</a></li>`
      : "",
  ]
    .filter(Boolean)
    .join("")

  const pipelineSection =
    recentPipelineRuns.length > 0
      ? `<h3 style="margin-top:24px;margin-bottom:8px;font-size:16px;color:#374151">Pipeline Runs This Week</h3>
        <table style="border-collapse:collapse;width:100%;max-width:500px">
          ${recentPipelineRuns
            .map(
              (r) => `<tr>
              <td style="padding:4px 12px 4px 0;font-size:13px;color:#6b7280">${formatDate(r.createdAt)}</td>
              <td style="padding:4px 12px 4px 0;font-size:13px">${r.step ?? "—"}</td>
              <td style="padding:4px 0;font-size:13px;font-weight:bold;color:${pipelineStatusColor(r.status)}">${r.status}</td>
            </tr>`
            )
            .join("")}
        </table>`
      : `<p style="color:#6b7280;font-style:italic">No pipeline runs this week.</p>`

  const modelSection = latestModelRun
    ? `<h3 style="margin-top:24px;margin-bottom:8px;font-size:16px;color:#374151">Latest Model Run</h3>
      <table style="border-collapse:collapse">
        <tr><td style="padding:3px 16px 3px 0;color:#6b7280;font-size:13px">Date</td><td style="font-size:13px">${formatDate(latestModelRun.createdAt)}</td></tr>
        <tr><td style="padding:3px 16px 3px 0;color:#6b7280;font-size:13px">Train / Val</td><td style="font-size:13px">${latestModelRun.trainSize.toLocaleString()} / ${latestModelRun.valSize.toLocaleString()}</td></tr>
        <tr><td style="padding:3px 16px 3px 0;color:#6b7280;font-size:13px">Accuracy</td><td style="font-size:13px">${(latestModelRun.accuracy * 100).toFixed(1)}%</td></tr>
        <tr><td style="padding:3px 16px 3px 0;color:#6b7280;font-size:13px">F1</td><td style="font-size:13px">${(latestModelRun.f1 * 100).toFixed(1)}%</td></tr>
        <tr><td style="padding:3px 16px 3px 0;color:#6b7280;font-size:13px">Precision / Recall</td><td style="font-size:13px">${(latestModelRun.precision * 100).toFixed(1)}% / ${(latestModelRun.recall * 100).toFixed(1)}%</td></tr>
      </table>`
    : ""

  return `
<html>
<body style="font-family:Arial,sans-serif;color:#1f2937;max-width:640px;margin:0 auto;padding:16px">
<center><img src="${APP_ORIGIN}/images/bannerWN_white.jpg" alt="WordNorms" style="max-width:600px;width:100%"></center>

<h2 style="margin-top:24px;margin-bottom:4px">Weekly Admin Summary</h2>
<p style="margin-top:0;color:#6b7280;font-size:14px">Week ending ${formatDate(now)}</p>

<h3 style="margin-top:24px;margin-bottom:8px;font-size:16px;color:#374151">Papers</h3>
<table style="border-collapse:collapse;min-width:240px">
  ${paperRows}
  <tr style="border-top:1px solid #e5e7eb">
    <td style="padding:6px 12px 6px 0;font-weight:bold">Total</td>
    <td style="padding:6px 0;font-weight:bold;text-align:right">${totalPapers.toLocaleString()}</td>
  </tr>
</table>
<p style="margin-top:8px;font-size:14px;color:#6b7280">
  ${newPapersThisWeek > 0 ? `+${newPapersThisWeek} new paper${newPapersThisWeek !== 1 ? "s" : ""} added this week` : "No new papers added this week"}
  &nbsp;·&nbsp; ${totalExtractions.toLocaleString()} extraction${totalExtractions !== 1 ? "s" : ""}
</p>

<h3 style="margin-top:24px;margin-bottom:8px;font-size:16px;color:#374151">Users</h3>
<table style="border-collapse:collapse;min-width:200px">
  ${roleRows}
  <tr style="border-top:1px solid #e5e7eb">
    <td style="padding:6px 12px 6px 0;font-weight:bold">Total</td>
    <td style="padding:6px 0;font-weight:bold;text-align:right">${totalUsers}</td>
  </tr>
</table>
<p style="margin-top:8px;font-size:14px;color:#6b7280">
  ${newUsersThisWeek > 0 ? `+${newUsersThisWeek} new user${newUsersThisWeek !== 1 ? "s" : ""} this week` : "No new users this week"}
</p>

${
  actionItems
    ? `<h3 style="margin-top:24px;margin-bottom:8px;font-size:16px;color:#374151">Needs Attention</h3>
       <ul style="margin:0;padding-left:20px">${actionItems}</ul>`
    : `<h3 style="margin-top:24px;margin-bottom:8px;font-size:16px;color:#374151">Needs Attention</h3>
       <p style="color:#10b981">Nothing pending — all clear!</p>`
}

${pipelineSection}
${modelSection}

<div style="margin-top:32px;border-top:1px solid #BFC3C8;padding-top:12px;text-align:center;color:#9ca3af;font-size:13px">
  <p style="margin:4px 0">WordNorms &nbsp;·&nbsp; <a href="${APP_ORIGIN}" style="color:#9ca3af">${APP_ORIGIN}</a></p>
  <p style="margin:4px 0">buchananlab@gmail.com</p>
</div>
</body>
</html>
  `
}

async function main() {
  console.log(`[${new Date().toISOString()}] Collecting weekly admin stats…`)
  const stats = await collectStats()

  const totalPapers = stats.papersByStatus.reduce((s, r) => s + r._count._all, 0)
  console.log(`  Papers: ${totalPapers} total, +${stats.newPapersThisWeek} this week`)
  console.log(`  Users: ${stats.totalUsers} total, +${stats.newUsersThisWeek} this week`)

  const recipients = stats.adminUsers.map((u) => u.email)
  if (recipients.length === 0) {
    console.warn("No ADMIN or SUPER_ADMIN users found — nothing sent.")
    return
  }
  console.log(`  Recipients: ${recipients.join(", ")}`)

  const html = buildHtml(stats)
  const subject = `WordNorms Weekly Summary – ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`

  const response = await resend.emails.send({
    from: "WordNorms <noreply@wordnorms.com>",
    to: recipients,
    replyTo: "buchananlab@gmail.com",
    subject,
    html,
  })

  if (response.error) {
    throw new Error(`Resend error: ${JSON.stringify(response.error)}`)
  }

  console.log(`[${new Date().toISOString()}] Done — sent to ${recipients.length} recipient(s), email id ${response.data?.id}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
