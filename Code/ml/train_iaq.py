#!/usr/bin/env python3
"""
Train Indoor Air Quality classifier (Good / Moderate / Poor).

Model: Random Forest (primary) + MLP baseline
Input: Data/processed/iaq_features.csv (produced by preprocess.py)

Usage:
    python train_iaq.py
    python train_iaq.py --cv      # 5-fold GroupKFold cross-validation
"""
import argparse
import json
import os

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (classification_report, confusion_matrix,
                              f1_score)
from sklearn.model_selection import GroupKFold
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler

PROC_DIR   = os.path.join(os.path.dirname(__file__), "..", "..", "Data", "processed")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "Data", "models")

FEATURE_COLS = [
    "temp_c", "humidity_pct", "gas_norm",
    "humidity_delta_5m", "temp_delta_5m", "gas_delta_5m",
    "humidity_max_10m", "gas_min_10m",
    "hour_sin", "hour_cos",
]
LABEL_COL  = "iaq_label"
CLASSES    = ["Good", "Moderate", "Poor"]


def load_data(csv_path: str):
    df = pd.read_csv(csv_path).dropna(subset=FEATURE_COLS + [LABEL_COL])
    le = LabelEncoder().fit(CLASSES)
    df["label_enc"] = le.transform(df[LABEL_COL])
    return df, le


def build_rf() -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("clf", RandomForestClassifier(
            n_estimators=200,
            max_depth=10,
            min_samples_leaf=5,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )),
    ])


def build_mlp() -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("clf", MLPClassifier(
            hidden_layer_sizes=(64, 32),
            max_iter=300,
            random_state=42,
        )),
    ])


def evaluate(model, X_val, y_val, le, split_name="val"):
    y_pred = model.predict(X_val)
    all_labels = list(range(len(le.classes_)))
    f1 = f1_score(y_val, y_pred, average="macro", labels=all_labels, zero_division=0)
    print(f"\n── {split_name} results ──")
    print(classification_report(y_val, y_pred, labels=all_labels,
                                target_names=le.classes_, zero_division=0))
    print(f"Macro F1: {f1:.4f}")
    return f1, y_pred


def plot_confusion_matrix(y_true, y_pred, le, title: str, out_path: str):
    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(le.classes_))))
    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(le.classes_)))
    ax.set_yticks(range(len(le.classes_)))
    ax.set_xticklabels(le.classes_)
    ax.set_yticklabels(le.classes_)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(title)
    for i in range(len(le.classes_)):
        for j in range(len(le.classes_)):
            ax.text(j, i, cm[i, j], ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black")
    plt.colorbar(im)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"Confusion matrix → {out_path}")


def plot_feature_importance(model: Pipeline, feature_names: list, out_path: str):
    rf = model.named_steps["clf"]
    importances = rf.feature_importances_
    idx = np.argsort(importances)[::-1][:8]
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.bar(range(len(idx)), importances[idx], color="steelblue")
    ax.set_xticks(range(len(idx)))
    ax.set_xticklabels([feature_names[i] for i in idx], rotation=30, ha="right")
    ax.set_ylabel("Importance")
    ax.set_title("RF Feature Importances (Top 8)")
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"Feature importance → {out_path}")


def cross_validate(df: pd.DataFrame, le: LabelEncoder):
    X = df[FEATURE_COLS].values
    y = df["label_enc"].values
    groups = df["session_id"].values

    gkf = GroupKFold(n_splits=5)
    f1_scores = []
    for fold, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups)):
        model = build_rf()
        model.fit(X[train_idx], y[train_idx])
        y_pred = model.predict(X[val_idx])
        f1 = f1_score(y[val_idx], y_pred, average="macro")
        f1_scores.append(f1)
        print(f"  Fold {fold+1}: Macro F1 = {f1:.4f}")
    print(f"\nCross-val Macro F1: {np.mean(f1_scores):.4f} ± {np.std(f1_scores):.4f}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cv", action="store_true", help="Run 5-fold GroupKFold cross-validation")
    args = parser.parse_args()

    os.makedirs(MODELS_DIR, exist_ok=True)

    csv_path = os.path.join(PROC_DIR, "iaq_features.csv")
    if not os.path.exists(csv_path):
        print(f"ERROR: {csv_path} not found. Run preprocess.py first.")
        return

    df, le = load_data(csv_path)
    print(f"Loaded {len(df)} rows, {df['session_id'].nunique()} sessions")
    print(f"Label distribution:\n{df[LABEL_COL].value_counts().to_string()}\n")

    if args.cv:
        print("Running 5-fold GroupKFold cross-validation...")
        cross_validate(df, le)
        return

    train_df = df[df["split"] == "train"]
    val_df   = df[df["split"] == "val"]
    test_df  = df[df["split"] == "test"]

    X_train = train_df[FEATURE_COLS].values
    y_train = train_df["label_enc"].values
    X_val   = val_df[FEATURE_COLS].values
    y_val   = val_df["label_enc"].values
    X_test  = test_df[FEATURE_COLS].values
    y_test  = test_df["label_enc"].values

    # ── Random Forest ──────────────────────────────────────────────────────────
    print("Training Random Forest...")
    rf = build_rf()
    rf.fit(X_train, y_train)

    val_f1, val_pred = evaluate(rf, X_val, y_val, le, "Validation")
    test_f1, test_pred = evaluate(rf, X_test, y_test, le, "Test")

    plot_confusion_matrix(y_test, test_pred, le, "IAQ RF — Test",
                          os.path.join(MODELS_DIR, "iaq_rf_confusion.png"))
    plot_feature_importance(rf, FEATURE_COLS,
                            os.path.join(MODELS_DIR, "iaq_rf_features.png"))

    # ── MLP baseline ──────────────────────────────────────────────────────────
    print("\nTraining MLP baseline...")
    mlp = build_mlp()
    mlp.fit(X_train, y_train)
    mlp_f1, _ = evaluate(mlp, X_val, y_val, le, "MLP Validation")

    # ── Save best model ────────────────────────────────────────────────────────
    best = rf if val_f1 >= mlp_f1 else mlp
    best_name = "RF" if val_f1 >= mlp_f1 else "MLP"
    model_path = os.path.join(MODELS_DIR, "iaq_rf_v1.pkl")
    joblib.dump({"model": best, "label_encoder": le, "features": FEATURE_COLS}, model_path)
    print(f"\nSaved {best_name} model → {model_path}")

    # ── Record results ─────────────────────────────────────────────────────────
    results_path = os.path.join(MODELS_DIR, "results.json")
    try:
        results = json.load(open(results_path))
    except FileNotFoundError:
        results = {}
    results["iaq"] = {"rf_val_macro_f1": round(val_f1, 4),
                       "rf_test_macro_f1": round(test_f1, 4),
                       "mlp_val_macro_f1": round(mlp_f1, 4)}
    json.dump(results, open(results_path, "w"), indent=2)
    print(f"Results → {results_path}")

    if val_f1 < 0.65:
        print("\nWARNING: Val Macro F1 < 0.65. Consider adjusting IAQ thresholds in preprocess.py.")


if __name__ == "__main__":
    main()
