#!/usr/bin/env python3
"""
Fetch all VOC logger sessions from Firebase and export to CSV.

Usage:
    python fetch_firebase.py                    # fetch all sessions
    python fetch_firebase.py --session <id>     # fetch one session
    python fetch_firebase.py --since 20260430   # fetch sessions on or after date
"""
import argparse
import json
import os
import urllib.request
from datetime import datetime, timezone

import pandas as pd

DB_URL    = "https://aurasync-team6-default-rtdb.firebaseio.com"
DB_SECRET = "YsI1CXg3S4UiAHPZgUqJSRo9n6Vt1PIITw8VbR1z"

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "Data", "raw")


def fb_get(path):
    url = f"{DB_URL}{path}.json?auth={DB_SECRET}"
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read())


def session_to_dataframe(session_id: str, session_data: dict) -> pd.DataFrame:
    readings = (session_data or {}).get("readings") or {}
    rows = []
    for push_id, r in readings.items():
        iso = r.get("iso", "")
        if not iso:
            continue
        if r.get("heater_stable") is False:
            continue
        try:
            dt = datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        if dt.year < 2025:
            continue
        gas = r.get("gas_ohm")
        if gas is None or gas <= 0:
            continue
        rows.append({
            "session_id":    session_id,
            "push_id":       push_id,
            "datetime_utc":  dt,
            "unix_ms":       r.get("unix_ms"),
            "elapsed_s":     r.get("elapsed_s"),
            "temp_c":        r.get("temp_c"),
            "humidity_pct":  r.get("humidity_pct"),
            "pressure_hpa":  r.get("pressure_hpa"),
            "gas_ohm":       gas,
        })
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows).sort_values("unix_ms").reset_index(drop=True)
    return df


def fetch_all_sessions(since_date: str = None) -> dict:
    print("Fetching session list from Firebase...")
    sessions = fb_get("/voc_dataset/sessions")
    if not sessions:
        print("No sessions found.")
        return {}
    if since_date:
        sessions = {k: v for k, v in sessions.items() if k >= since_date}
    print(f"Found {len(sessions)} session(s).")
    return sessions


def save_csvs(dfs: list, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)
    all_rows = []
    for df in dfs:
        if df.empty:
            continue
        sid = df["session_id"].iloc[0]
        path = os.path.join(out_dir, f"{sid}.csv")
        df.to_csv(path, index=False)
        print(f"  Saved {len(df)} rows → {path}")
        all_rows.append(df)
    if all_rows:
        combined = pd.concat(all_rows, ignore_index=True)
        combined_path = os.path.join(out_dir, "all_sessions.csv")
        combined.to_csv(combined_path, index=False)
        print(f"\nCombined: {len(combined)} rows → {combined_path}")
        return combined
    return pd.DataFrame()


def main():
    parser = argparse.ArgumentParser(description="Export Firebase VOC sessions to CSV")
    parser.add_argument("--session", help="Fetch only this session ID (e.g. 20260430-035330)")
    parser.add_argument("--since",   help="Only fetch sessions on or after YYYYMMDD (e.g. 20260430)")
    args = parser.parse_args()

    if args.session:
        print(f"Fetching single session: {args.session}")
        data = fb_get(f"/voc_dataset/sessions/{args.session}")
        df = session_to_dataframe(args.session, data)
        if df.empty:
            print("No valid readings found.")
            return
        save_csvs([df], OUT_DIR)
    else:
        since = args.since.replace("-", "")[:8] if args.since else None
        sessions = fetch_all_sessions(since_date=since)
        dfs = []
        for sid, sdata in sessions.items():
            print(f"  Processing session {sid}...", end=" ")
            df = session_to_dataframe(sid, sdata)
            print(f"{len(df)} stable readings")
            dfs.append(df)
        combined = save_csvs(dfs, OUT_DIR)
        if not combined.empty:
            print(f"\nSummary:")
            print(f"  Sessions:      {combined['session_id'].nunique()}")
            print(f"  Total rows:    {len(combined)}")
            print(f"  Date range:    {combined['datetime_utc'].min()} → {combined['datetime_utc'].max()}")
            print(f"  gas_ohm range: {combined['gas_ohm'].min():.0f} – {combined['gas_ohm'].max():.0f} Ω")


if __name__ == "__main__":
    main()
