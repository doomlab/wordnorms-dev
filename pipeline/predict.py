#!/usr/bin/env python3
"""
Trains the paper classifier on reviewed papers in the DB, scores
PENDING_REVIEW papers, and logs a ModelRun with validation metrics.

Rebalances the validation set if it has drifted below 20% of all
labeled papers, promoting newly reviewed papers as needed.
"""
import re
import random
import unicodedata

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
from sklearn.svm import LinearSVC
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

from db import get_conn, get_engine

VAL_RATIO = 0.20
VAL_THRESHOLD = 0.18   # rebalance when val share drops below this
RANDOM_SEED = 42


# ---------------------------------------------------------------------------
# Text preprocessing
# ---------------------------------------------------------------------------

_CONTRACTIONS = {
    "can't": "cannot", "won't": "will not", "n't": " not",
    "'re": " are", "'s": " is", "'d": " would", "'ll": " will",
    "'ve": " have", "'m": " am",
}
_contr_pat = re.compile(
    "|".join(map(re.escape, sorted(_CONTRACTIONS, key=len, reverse=True)))
)


def _to_ascii(s):
    return unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii")


def clean_text(title, abstract):
    text = " ".join([str(title or ""), str(abstract or "")])
    text = _to_ascii(text)
    text = re.sub(r"^\s*keywords[:\-]?\s*", " ", text, flags=re.I)
    text = re.sub(r"(^|\s)NA\b", " ", text, flags=re.I)
    text = text.lower()
    text = _contr_pat.sub(lambda m: _CONTRACTIONS[m.group(0)], text)
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\d+", " ", text)
    tokens = [t for t in text.split() if t not in ENGLISH_STOP_WORDS]
    return re.sub(r"\s+", " ", " ".join(tokens)).strip()


# ---------------------------------------------------------------------------
# Validation rebalancing
# ---------------------------------------------------------------------------

def rebalance_validation(conn, seed=RANDOM_SEED):
    cur = conn.cursor()

    cur.execute("""
        SELECT COUNT(*) FROM "Paper"
        WHERE status IN ('ACCEPTED'::"PaperStatus", 'EXCLUDED'::"PaperStatus")
    """)
    total_labeled = cur.fetchone()[0]
    if total_labeled == 0:
        return False

    cur.execute("""
        SELECT COUNT(*) FROM "Paper"
        WHERE status IN ('ACCEPTED'::"PaperStatus", 'EXCLUDED'::"PaperStatus")
          AND "isValidation" = true
    """)
    current_val = cur.fetchone()[0]

    if current_val / total_labeled >= VAL_THRESHOLD:
        return False

    # fetch non-validation labeled papers as promotion candidates
    cur.execute("""
        SELECT id, status FROM "Paper"
        WHERE status IN ('ACCEPTED'::"PaperStatus", 'EXCLUDED'::"PaperStatus")
          AND "isValidation" = false
    """)
    candidates = cur.fetchall()

    needed = int(total_labeled * VAL_RATIO) - current_val
    if needed <= 0 or not candidates:
        return False

    include_ids = [r[0] for r in candidates if r[1] == "ACCEPTED"]
    exclude_ids = [r[0] for r in candidates if r[1] == "EXCLUDED"]

    rng = random.Random(seed)
    rng.shuffle(include_ids)
    rng.shuffle(exclude_ids)

    # stratified split of `needed` slots
    n_inc = round(needed * len(include_ids) / len(candidates))
    n_exc = needed - n_inc

    to_promote = include_ids[:n_inc] + exclude_ids[:n_exc]
    if not to_promote:
        return False

    cur.execute(
        'UPDATE "Paper" SET "isValidation" = true WHERE id = ANY(%s)',
        (to_promote,),
    )
    print(f"Rebalanced validation: promoted {len(to_promote)} papers "
          f"({n_inc} include / {n_exc} exclude)")
    return True


# ---------------------------------------------------------------------------
# Training and scoring
# ---------------------------------------------------------------------------

def load_labeled(engine):
    df = pd.read_sql(
        """
        SELECT id, title, abstract, status, "isValidation"
        FROM "Paper"
        WHERE status IN ('ACCEPTED'::"PaperStatus", 'EXCLUDED'::"PaperStatus")
        """,
        engine,
    )
    df["class"] = (df["status"] == "ACCEPTED").astype(int)
    df["text"] = df.apply(lambda r: clean_text(r["title"], r["abstract"]), axis=1)
    return df


def load_pending(engine):
    df = pd.read_sql(
        'SELECT id, title, abstract FROM "Paper" WHERE status = \'PENDING_REVIEW\'::"PaperStatus"',
        engine,
    )
    df["text"] = df.apply(lambda r: clean_text(r["title"], r["abstract"]), axis=1)
    return df


def train(df_train):
    vectorizer = TfidfVectorizer(
        use_idf=True, min_df=0.0, max_df=1.0, max_features=1500
    )
    X = vectorizer.fit_transform(df_train["text"])
    svm = LinearSVC(penalty="l2", C=1, random_state=RANDOM_SEED)
    svm.fit(X, df_train["class"])
    return vectorizer, svm


def evaluate(vectorizer, svm, df_val):
    X = vectorizer.transform(df_val["text"])
    y_pred = svm.predict(X)
    return {
        "accuracy": accuracy_score(df_val["class"], y_pred),
        "precision": precision_score(df_val["class"], y_pred, zero_division=0),
        "recall": recall_score(df_val["class"], y_pred, zero_division=0),
        "f1": f1_score(df_val["class"], y_pred, zero_division=0),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    conn = get_conn()
    engine = get_engine()

    try:
        rebalanced = rebalance_validation(conn)
        conn.commit()

        df_labeled = load_labeled(engine)
        if len(df_labeled) < 10:
            print("Not enough labeled papers to train. Run seed.py first.")
            return

        df_train = df_labeled[~df_labeled["isValidation"]].copy()
        df_val = df_labeled[df_labeled["isValidation"]].copy()

        print(f"Training on {len(df_train)} papers, validating on {len(df_val)}")

        vectorizer, svm = train(df_train)
        metrics = evaluate(vectorizer, svm, df_val)

        print(
            f"Metrics — accuracy: {metrics['accuracy']:.3f}  "
            f"precision: {metrics['precision']:.3f}  "
            f"recall: {metrics['recall']:.3f}  "
            f"F1: {metrics['f1']:.3f}"
        )

        # score pending papers
        df_pending = load_pending(engine)
        if df_pending.empty:
            print("No PENDING_REVIEW papers to score.")
        else:
            X_pending = vectorizer.transform(df_pending["text"])
            df_pending["predicted"] = svm.predict(X_pending)
            df_pending["score"] = svm.decision_function(X_pending)

            df_include = df_pending[df_pending["predicted"] == 1]
            df_exclude = df_pending[df_pending["predicted"] == 0]

            cur = conn.cursor()

            # predicted include → stays PENDING_REVIEW, update score only
            if not df_include.empty:
                cur.executemany(
                    'UPDATE "Paper" SET "modelScore" = %s WHERE id = %s',
                    [(float(r["score"]), int(r["id"])) for _, r in df_include.iterrows()],
                )

            # predicted exclude → auto-excluded
            if not df_exclude.empty:
                cur.executemany(
                    """
                    UPDATE "Paper"
                       SET "modelScore" = %s,
                           status = 'EXCLUDED'::"PaperStatus"
                     WHERE id = %s
                    """,
                    [(float(r["score"]), int(r["id"])) for _, r in df_exclude.iterrows()],
                )

            print(
                f"Scored {len(df_pending)} papers — "
                f"{len(df_include)} for review, {len(df_exclude)} auto-excluded"
            )

        # log ModelRun
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO "ModelRun"
                ("createdAt", "trainSize", "valSize",
                 accuracy, "precision", recall, f1, "valRebalanced")
            VALUES (NOW(), %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                len(df_train),
                len(df_val),
                metrics["accuracy"],
                metrics["precision"],
                metrics["recall"],
                metrics["f1"],
                rebalanced,
            ),
        )
        conn.commit()
        print("ModelRun logged.")

    finally:
        conn.close()
        engine.dispose()


if __name__ == "__main__":
    main()
