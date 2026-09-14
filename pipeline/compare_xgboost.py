#!/usr/bin/env python3
"""
Read-only comparison of the current SVM (with class_weight="balanced") against
an XGBoost classifier, trained/evaluated on the exact same train/val split
used by predict.py. Does not touch PENDING_REVIEW papers, statuses, or the
ModelRun table — safe to run anytime.
"""
from xgboost import XGBClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

from db import get_engine
from predict import load_labeled, RANDOM_SEED


def evaluate(name, model, vectorizer, df_val):
    X = vectorizer.transform(df_val["text"])
    y_pred = model.predict(X)
    metrics = {
        "accuracy": accuracy_score(df_val["class"], y_pred),
        "precision": precision_score(df_val["class"], y_pred, zero_division=0),
        "recall": recall_score(df_val["class"], y_pred, zero_division=0),
        "f1": f1_score(df_val["class"], y_pred, zero_division=0),
    }
    print(
        f"{name:<20} accuracy: {metrics['accuracy']:.3f}  "
        f"precision: {metrics['precision']:.3f}  "
        f"recall: {metrics['recall']:.3f}  "
        f"F1: {metrics['f1']:.3f}"
    )
    return metrics


def main():
    engine = get_engine()
    df_labeled = load_labeled(engine)
    df_train = df_labeled[~df_labeled["isValidation"]].copy()
    df_val = df_labeled[df_labeled["isValidation"]].copy()

    print(f"Training on {len(df_train)} papers, validating on {len(df_val)}")
    print(f"Train class balance — accept: {df_train['class'].sum()}, "
          f"exclude: {(df_train['class'] == 0).sum()}\n")

    vectorizer = TfidfVectorizer(use_idf=True, min_df=0.0, max_df=1.0, max_features=1500)
    X_train = vectorizer.fit_transform(df_train["text"])

    svm_balanced = LinearSVC(penalty="l2", C=1, class_weight="balanced", random_state=RANDOM_SEED)
    svm_balanced.fit(X_train, df_train["class"])

    n_pos = df_train["class"].sum()
    n_neg = (df_train["class"] == 0).sum()
    scale_pos_weight = n_neg / n_pos if n_pos else 1.0

    xgb = XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.1,
        scale_pos_weight=scale_pos_weight,
        eval_metric="logloss",
        random_state=RANDOM_SEED,
    )
    xgb.fit(X_train, df_train["class"])

    evaluate("SVM (balanced)", svm_balanced, vectorizer, df_val)
    evaluate("XGBoost", xgb, vectorizer, df_val)


if __name__ == "__main__":
    main()
