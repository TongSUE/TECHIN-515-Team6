#!/usr/bin/env python3
"""
Preprocess raw session CSVs: sliding baseline normalization, feature engineering,
IAQ rule-based labeling, shower event labeling, and window extraction for CNN.

Usage:
    python preprocess.py                    # process all_sessions.csv
    python preprocess.py --plot             # also save gas_norm diagnostic plots
"""
import argparse
import math
import os
import pickle

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

RAW_DIR  = os.path.join(os.path.dirname(__file__), "..", "..", "Data", "raw")
PROC_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "Data", "processed")
ANN_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "Data", "shower_annotations.csv")

WINDOW_SIZE   = 30    # 30 readings × 10 s = 5 minutes per window
WINDOW_STRIDE = 5     # slide 5 readings = 50 seconds
BASELINE_WIN  = 120   # 120 readings = 20-minute rolling max baseline
FEATURES = [
    "temp_c", "humidity_pct", "gas_norm",
    "humidity_delta_5m", "temp_delta_5m", "gas_delta_5m",
]


# ── Feature Engineering ───────────────────────────────────────────────────────

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add normalized gas, delta, rolling, and time features to a single-session df."""
    df = df.copy().sort_values("unix_ms").reset_index(drop=True)

    # Sliding baseline: rolling max over 20-minute window
    gas = df["gas_ohm"]
    baseline = gas.rolling(window=BASELINE_WIN, min_periods=10).max()
    df["gas_baseline"] = baseline
    df["gas_norm"] = ((gas - baseline) / baseline).clip(-1.0, 0.1)

    # 5-minute rate-of-change (30 readings × 10 s)
    df["humidity_delta_5m"] = df["humidity_pct"].diff(periods=30)
    df["temp_delta_5m"]     = df["temp_c"].diff(periods=30)
    df["gas_delta_5m"]      = df["gas_norm"].diff(periods=30)

    # 10-minute rolling statistics
    df["humidity_max_10m"] = df["humidity_pct"].rolling(60).max()
    df["gas_min_10m"]      = df["gas_norm"].rolling(60).min()

    # Cyclical time-of-day encoding
    hour = df["datetime_utc"].apply(
        lambda x: pd.to_datetime(x, utc=True).hour + pd.to_datetime(x, utc=True).minute / 60
    )
    df["hour_sin"] = hour.apply(lambda h: math.sin(2 * math.pi * h / 24))
    df["hour_cos"] = hour.apply(lambda h: math.cos(2 * math.pi * h / 24))

    # Drop rows where baseline window hasn't filled (first ~100 s of each session)
    df = df.dropna(subset=["gas_norm", "humidity_delta_5m"]).reset_index(drop=True)
    return df


# ── IAQ Labeling (rule-based) ─────────────────────────────────────────────────

def assign_iaq_label(row) -> str:
    """
    Thresholds based on Bosch BME680 IAQ recommendations and 30kΩ baseline.
    Verify against your plots after first run and adjust if needed.
    """
    if row["gas_norm"] > -0.15 and row["humidity_pct"] < 65 and row["temp_c"] < 27:
        return "Good"
    if row["gas_norm"] < -0.40 or row["humidity_pct"] > 80:
        return "Poor"
    return "Moderate"


# ── Shower Event Labeling ─────────────────────────────────────────────────────

def load_annotations() -> pd.DataFrame:
    if not os.path.exists(ANN_PATH):
        print(f"WARNING: No annotation file at {ANN_PATH}")
        print("Shower labels will all be 0. Create the file to enable shower training.")
        return pd.DataFrame(columns=["session_id", "shower_start_utc", "shower_end_utc", "notes"])
    ann = pd.read_csv(ANN_PATH)
    ann["shower_start_utc"] = pd.to_datetime(ann["shower_start_utc"], utc=True)
    ann["shower_end_utc"]   = pd.to_datetime(ann["shower_end_utc"],   utc=True)
    return ann


def label_shower(df: pd.DataFrame, annotations: pd.DataFrame) -> pd.DataFrame:
    """Add binary shower_label column (1=showering, 0=not)."""
    df = df.copy()
    df["shower_label"] = 0
    if df.empty:
        return df
    df["datetime_utc"] = pd.to_datetime(df["datetime_utc"], utc=True)

    sid_anns = annotations[annotations["session_id"] == df["session_id"].iloc[0]]
    for _, ann in sid_anns.iterrows():
        # Buffer: start-30s to end+60s for annotation imprecision and sensor lag
        start = ann["shower_start_utc"] - pd.Timedelta(seconds=30)
        end   = ann["shower_end_utc"]   + pd.Timedelta(seconds=60)
        mask  = (df["datetime_utc"] >= start) & (df["datetime_utc"] <= end)
        df.loc[mask, "shower_label"] = 1
    return df


# ── Window Extraction ─────────────────────────────────────────────────────────

def extract_windows(df: pd.DataFrame, features: list, scaler=None):
    """
    Extract sliding windows for sequence models.
    Returns (X, y, scaler) where X shape = (N, WINDOW_SIZE, n_features).
    Pass a pre-fitted scaler to transform without refitting.
    """
    arr    = df[features].values.astype(np.float32)
    labels = df["shower_label"].values

    X_list, y_list = [], []
    for i in range(0, len(arr) - WINDOW_SIZE + 1, WINDOW_STRIDE):
        window = arr[i : i + WINDOW_SIZE]
        if np.isnan(window).any():
            continue
        y_list.append(1 if labels[i : i + WINDOW_SIZE].mean() > 0.5 else 0)
        X_list.append(window)

    if not X_list:
        return np.empty((0, WINDOW_SIZE, len(features))), np.empty(0), scaler

    X = np.stack(X_list)   # (N, window_size, n_features)
    y = np.array(y_list)

    N, W, F = X.shape
    X_flat = X.reshape(-1, F)
    if scaler is None:
        scaler = StandardScaler()
        X_flat = scaler.fit_transform(X_flat)
    else:
        X_flat = scaler.transform(X_flat)
    X = X_flat.reshape(N, W, F)

    return X, y, scaler


# ── Session Split ─────────────────────────────────────────────────────────────

def split_sessions(session_ids: list, annotated_ids: list = None,
                   test_frac=0.2, val_frac=0.15, seed=42):
    """
    Split sessions into train/val/test.
    Annotated sessions (with shower labels) are distributed across splits
    so that val and test always have positive examples when possible.
    """
    rng = np.random.default_rng(seed)
    annotated = [s for s in (annotated_ids or []) if s in session_ids]
    others    = [s for s in session_ids if s not in annotated]

    rng.shuffle(annotated)
    rng.shuffle(others)

    # Annotated sessions: first → train, second → val, rest → train
    # (test gets no annotated sessions when there are only 1-2 total;
    #  val F1 is used as the evaluation proxy in that case)
    val_ids, test_ids, train_ids = [], [], []
    for i, sid in enumerate(annotated):
        if i == 0:
            train_ids.append(sid)
        elif i == 1:
            val_ids.append(sid)
        else:
            train_ids.append(sid)

    # Fill val/test with non-annotated sessions to reach target fractions
    n_total   = len(session_ids)
    n_val_target  = max(1, int(n_total * val_frac))
    n_test_target = max(1, int(n_total * test_frac))

    for sid in others:
        if len(val_ids) < n_val_target:
            val_ids.append(sid)
        elif len(test_ids) < n_test_target:
            test_ids.append(sid)
        else:
            train_ids.append(sid)

    return train_ids, val_ids, test_ids


# ── Diagnostic Plot ───────────────────────────────────────────────────────────

def plot_gas_norm(df: pd.DataFrame, session_id: str, out_dir: str):
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from zoneinfo import ZoneInfo

    PDT = ZoneInfo("America/Los_Angeles")
    times = pd.to_datetime(df["datetime_utc"], utc=True).dt.tz_convert(PDT)

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 6), sharex=True)
    fig.suptitle(f"gas_ohm vs gas_norm — {session_id}  (Seattle local time)")

    ax1.plot(times, df["gas_ohm"],      color="darkorange", lw=0.8, label="gas_ohm (Ω)")
    ax1.plot(times, df["gas_baseline"], color="gray",       lw=0.8, ls="--", label="baseline")
    ax1.set_ylabel("Gas Resistance (Ω)")
    ax1.legend(fontsize=8)
    ax1.grid(True, alpha=0.3)

    ax2.plot(times, df["gas_norm"], color="steelblue", lw=0.8)
    ax2.axhline(0,     color="gray",  lw=0.5)
    ax2.axhline(-0.15, color="green", lw=0.5, ls="--", label="Good threshold (-0.15)")
    ax2.axhline(-0.40, color="red",   lw=0.5, ls="--", label="Poor threshold (-0.40)")
    ax2.set_ylabel("gas_norm (relative)")
    ax2.set_xlabel("Seattle local time (PDT = UTC-7)")
    ax2.legend(fontsize=8)
    ax2.grid(True, alpha=0.3)

    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%m/%d %H:%M", tz=PDT))
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()

    path = os.path.join(out_dir, f"{session_id}_gas_norm.png")
    plt.savefig(path, dpi=150)
    plt.close()
    print(f"  Diagnostic plot → {path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--plot", action="store_true", help="Save gas_norm diagnostic plots")
    args = parser.parse_args()

    os.makedirs(PROC_DIR, exist_ok=True)

    raw_csv = os.path.join(RAW_DIR, "all_sessions.csv")
    if not os.path.exists(raw_csv):
        print(f"ERROR: {raw_csv} not found. Run fetch_firebase.py first.")
        return

    MIN_SESSION_ROWS = 60  # sessions shorter than 10 min have unreliable baselines

    print(f"Loading {raw_csv}...")
    all_raw  = pd.read_csv(raw_csv, parse_dates=["datetime_utc"])

    # Filter out sessions too short for a reliable rolling baseline
    session_counts = all_raw.groupby("session_id").size()
    valid_sessions = session_counts[session_counts >= MIN_SESSION_ROWS].index.tolist()
    dropped = set(all_raw["session_id"].unique()) - set(valid_sessions)
    if dropped:
        print(f"  Dropping {len(dropped)} short session(s) (< {MIN_SESSION_ROWS} rows): {sorted(dropped)}")
    all_raw  = all_raw[all_raw["session_id"].isin(valid_sessions)]
    sessions = valid_sessions
    print(f"  {len(sessions)} sessions, {len(all_raw)} total rows")

    annotations = load_annotations()
    annotated_sessions = annotations["session_id"].unique().tolist()
    train_ids, val_ids, test_ids = split_sessions(sessions, annotated_ids=annotated_sessions)
    print(f"  Split → train={len(train_ids)} | val={len(val_ids)} | test={len(test_ids)}")
    print(f"  Annotated sessions → val: {[s for s in val_ids if s in annotated_sessions]}"
          f"  test: {[s for s in test_ids if s in annotated_sessions]}"
          f"  train: {[s for s in train_ids if s in annotated_sessions]}")
    print(f"  Test sessions (hold-out): {test_ids}")

    processed_dfs = []
    for sid in sessions:
        df_raw = all_raw[all_raw["session_id"] == sid].copy()
        df = engineer_features(df_raw)
        df = label_shower(df, annotations)
        df["iaq_label"] = df.apply(assign_iaq_label, axis=1)
        df["split"]     = ("train" if sid in train_ids else
                           "val"   if sid in val_ids   else "test")
        processed_dfs.append(df)
        if args.plot:
            plot_gas_norm(df, sid, PROC_DIR)

    all_feat = pd.concat(processed_dfs, ignore_index=True)

    feat_path = os.path.join(PROC_DIR, "all_features.csv")
    all_feat.to_csv(feat_path, index=False)
    print(f"\nSaved all_features.csv ({len(all_feat)} rows) → {feat_path}")

    iaq_cols = FEATURES + ["hour_sin", "hour_cos", "humidity_max_10m", "gas_min_10m",
                            "iaq_label", "session_id", "split", "datetime_utc"]
    iaq_path = os.path.join(PROC_DIR, "iaq_features.csv")
    all_feat[iaq_cols].to_csv(iaq_path, index=False)
    print(f"Saved iaq_features.csv → {iaq_path}")
    print(f"  IAQ label distribution:\n{all_feat['iaq_label'].value_counts().to_string()}")

    # Window extraction — scaler fitted on train only
    train_df = all_feat[all_feat["split"] == "train"]
    val_df   = all_feat[all_feat["split"] == "val"]
    test_df  = all_feat[all_feat["split"] == "test"]

    X_train, y_train, scaler = extract_windows(train_df, FEATURES)
    X_val,   y_val,   _      = extract_windows(val_df,   FEATURES, scaler=scaler)
    X_test,  y_test,  _      = extract_windows(test_df,  FEATURES, scaler=scaler)

    for name, X, y in [("train", X_train, y_train), ("val", X_val, y_val), ("test", X_test, y_test)]:
        np.save(os.path.join(PROC_DIR, f"shower_{name}_X.npy"), X)
        np.save(os.path.join(PROC_DIR, f"shower_{name}_y.npy"), y)

    with open(os.path.join(PROC_DIR, "scalers.pkl"), "wb") as f:
        pickle.dump({"window_scaler": scaler, "features": FEATURES}, f)

    print(f"\nShower windows:")
    print(f"  Train: {X_train.shape}  pos={y_train.sum():<4} neg={(y_train==0).sum()}")
    print(f"  Val:   {X_val.shape}    pos={y_val.sum():<4}   neg={(y_val==0).sum()}")
    print(f"  Test:  {X_test.shape}   pos={y_test.sum():<4}  neg={(y_test==0).sum()}")
    print(f"  Scalers saved → {os.path.join(PROC_DIR, 'scalers.pkl')}")

    if y_train.sum() == 0:
        print("\nWARNING: No shower windows in training set.")
        print(f"Fill in {ANN_PATH} with UTC start/end times before running train_shower.py")


if __name__ == "__main__":
    main()
