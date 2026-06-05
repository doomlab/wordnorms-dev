import { Navbar } from "../components/Navbar"
import { TrainingBanner } from "../components/TrainingBanner"
import db from "db"

export const metadata = { title: "Training Progress – WordNorms" }

const GOAL = 500
const STRETCH_GOAL = 1000

export default async function ProgressPage() {
  const [users, totalPapers, withExtraction, verified, lastRun] = await Promise.all([
    db.user.count(),
    db.paper.count({ where: { status: "ACCEPTED", canonicalPaperId: null } }),
    db.paperExtraction.count({ where: { paper: { status: "ACCEPTED", canonicalPaperId: null } } }),
    db.paperExtraction.count({
      where: {
        verifiedAt: { not: null },
        paper: { status: "ACCEPTED", canonicalPaperId: null },
      },
    }),
    db.modelRun.findFirst({ orderBy: { createdAt: "desc" } }),
  ])

  const goalPct = Math.min(100, Math.round((verified / GOAL) * 100))
  const stretchPct = Math.min(100, Math.round((verified / STRETCH_GOAL) * 100))

  return (
    <div className="min-h-screen bg-base-100 flex flex-col">
      <Navbar />
      <TrainingBanner />

      <div className="max-w-3xl mx-auto w-full px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Training Dataset Progress</h1>
        <p className="text-base-content/60 mb-10 text-sm">
          We&apos;re building a verified dataset to train a model that automatically extracts word
          norm metadata from papers. Every verification you submit helps improve the model.
        </p>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body py-6 px-6">
              <p className="text-4xl font-bold tabular-nums">{users.toLocaleString()}</p>
              <p className="text-sm text-base-content/60 mt-1">Contributors</p>
            </div>
          </div>
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body py-6 px-6">
              <p className="text-4xl font-bold tabular-nums">{totalPapers.toLocaleString()}</p>
              <p className="text-sm text-base-content/60 mt-1">Papers in dataset</p>
            </div>
          </div>
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body py-6 px-6">
              <p className="text-4xl font-bold tabular-nums">{withExtraction.toLocaleString()}</p>
              <p className="text-sm text-base-content/60 mt-1">Papers with extracted metadata</p>
            </div>
          </div>
        </div>

        {/* Verification progress */}
        <div className="card bg-base-200 shadow-sm mb-6">
          <div className="card-body px-6 py-6">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="font-semibold text-base">Verified extractions</h2>
              <span className="text-sm text-base-content/60 tabular-nums">
                {verified.toLocaleString()} / {GOAL.toLocaleString()} goal
              </span>
            </div>
            <div className="w-full bg-base-300 rounded-full h-4 mb-1 overflow-hidden">
              <div
                className="bg-success h-4 rounded-full transition-all duration-500"
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <p className="text-xs text-base-content/50">{goalPct}% of first milestone</p>

            {verified >= GOAL && (
              <>
                <div className="flex items-baseline justify-between mb-1 mt-5">
                  <h2 className="font-semibold text-base">Stretch goal</h2>
                  <span className="text-sm text-base-content/60 tabular-nums">
                    {verified.toLocaleString()} / {STRETCH_GOAL.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-base-300 rounded-full h-4 mb-1 overflow-hidden">
                  <div
                    className="bg-primary h-4 rounded-full transition-all duration-500"
                    style={{ width: `${stretchPct}%` }}
                  />
                </div>
                <p className="text-xs text-base-content/50">{stretchPct}% of stretch goal</p>
              </>
            )}
          </div>
        </div>

        {/* Why 500? */}
        <div className="card bg-base-200 shadow-sm mb-10">
          <div className="card-body px-6 py-5">
            <h2 className="font-semibold text-base mb-2">Why 500 verifications?</h2>
            <p className="text-sm text-base-content/70">
              500 human-verified extractions gives us enough labeled examples to train a supervised
              model that can reliably predict a paper&apos;s language, stimuli type, norms
              collected, and participant details directly from its title and abstract. Reaching 1,000
              unlocks our stretch goal: a higher-accuracy model that can flag uncertain predictions
              for human review.
            </p>
          </div>
        </div>

        {/* Last model run */}
        {lastRun && (
          <div className="mb-10">
            <h2 className="font-semibold text-base mb-3">Latest model run</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Training samples", value: lastRun.trainSize.toLocaleString() },
                { label: "Validation samples", value: lastRun.valSize.toLocaleString() },
                { label: "F1 score", value: lastRun.f1.toFixed(3) },
                { label: "Accuracy", value: `${(lastRun.accuracy * 100).toFixed(1)}%` },
              ].map((s) => (
                <div key={s.label} className="card bg-base-200 shadow-sm">
                  <div className="card-body py-4 px-5">
                    <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                    <p className="text-xs text-base-content/60 mt-0.5">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
            {lastRun.notes && (
              <p className="text-xs text-base-content/50 mt-2">{lastRun.notes}</p>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-3">
          <a href="/login" className="btn btn-primary btn-sm">
            Log in to verify papers
          </a>
          <a href="/" className="btn btn-outline btn-sm">
            Browse the database
          </a>
        </div>
      </div>
    </div>
  )
}
