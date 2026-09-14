#!/usr/bin/env python3
"""
Re-scores papers the pipeline auto-processed (never touched by a human
reviewer) on or after a cutoff date, using the current trained model.

Targets: status IN (PENDING_REVIEW, EXCLUDED), "reviewedById" IS NULL,
"modelScore" IS NOT NULL, "canonicalPaperId" IS NULL, "updatedAt" >= cutoff.

Useful after a model change (e.g. SVM -> XGBoost) to recover papers that
were auto-excluded by a worse model without ever having a human look at
them. Defaults to a dry run; pass --apply to write changes.

Usage:
    python rescore_since.py --cutoff 2026-07-01
    python rescore_since.py --cutoff 2026-07-01 --apply
"""
import argparse

import pandas as pd

from db import get_conn, get_engine
from predict import load_labeled, train, clean_text


def load_targets(engine, cutoff):
    df = pd.read_sql(
        """
        SELECT id, title, abstract, status
        FROM "Paper"
        WHERE status IN ('PENDING_REVIEW'::"PaperStatus", 'EXCLUDED'::"PaperStatus")
          AND "reviewedById" IS NULL
          AND "modelScore" IS NOT NULL
          AND "canonicalPaperId" IS NULL
          AND "updatedAt" >= %(cutoff)s
        """,
        engine,
        params={"cutoff": cutoff},
    )
    df["text"] = df.apply(lambda r: clean_text(r["title"], r["abstract"]), axis=1)
    return df


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cutoff", required=True, help="e.g. 2026-07-01")
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    args = parser.parse_args()

    conn = get_conn()
    engine = get_engine()

    try:
        df_labeled = load_labeled(engine)
        df_train = df_labeled[~df_labeled["isValidation"]].copy()
        print(f"Training current model on {len(df_train)} labeled papers")
        vectorizer, model = train(df_train)

        df_targets = load_targets(engine, args.cutoff)
        print(f"Found {len(df_targets)} auto-processed, unreviewed papers "
              f"on/after {args.cutoff}\n")
        if df_targets.empty:
            return

        X = vectorizer.transform(df_targets["text"])
        df_targets["predicted"] = model.predict(X)
        df_targets["score"] = model.predict_proba(X)[:, 1]

        excluded_to_pending = df_targets[
            (df_targets["status"] == "EXCLUDED") & (df_targets["predicted"] == 1)
        ]
        pending_to_excluded = df_targets[
            (df_targets["status"] == "PENDING_REVIEW") & (df_targets["predicted"] == 0)
        ]
        unchanged = len(df_targets) - len(excluded_to_pending) - len(pending_to_excluded)

        print(f"EXCLUDED -> PENDING_REVIEW (recovered): {len(excluded_to_pending)}")
        print(f"PENDING_REVIEW -> EXCLUDED (newly excluded): {len(pending_to_excluded)}")
        print(f"Unchanged status (modelScore still refreshed): {unchanged}")

        if not args.apply:
            print("\nDry run only — no changes written. Re-run with --apply to commit.")
            return

        cur = conn.cursor()

        if not excluded_to_pending.empty:
            cur.executemany(
                """
                UPDATE "Paper"
                   SET "modelScore" = %s, status = 'PENDING_REVIEW'::"PaperStatus"
                 WHERE id = %s
                """,
                [(float(r["score"]), int(r["id"])) for _, r in excluded_to_pending.iterrows()],
            )

        if not pending_to_excluded.empty:
            cur.executemany(
                """
                UPDATE "Paper"
                   SET "modelScore" = %s, status = 'EXCLUDED'::"PaperStatus"
                 WHERE id = %s
                """,
                [(float(r["score"]), int(r["id"])) for _, r in pending_to_excluded.iterrows()],
            )

        df_rest = df_targets[
            ~df_targets["id"].isin(excluded_to_pending["id"])
            & ~df_targets["id"].isin(pending_to_excluded["id"])
        ]
        if not df_rest.empty:
            cur.executemany(
                'UPDATE "Paper" SET "modelScore" = %s WHERE id = %s',
                [(float(r["score"]), int(r["id"])) for _, r in df_rest.iterrows()],
            )

        conn.commit()
        print("\nApplied.")

    finally:
        conn.close()
        engine.dispose()


if __name__ == "__main__":
    main()
