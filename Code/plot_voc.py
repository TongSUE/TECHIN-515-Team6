#!/usr/bin/env python3
import urllib.request
import json
from datetime import datetime, timezone
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

DB_URL    = "https://aurasync-team6-default-rtdb.firebaseio.com"
DB_SECRET = "YsI1CXg3S4UiAHPZgUqJSRo9n6Vt1PIITw8VbR1z"

def fb_get(path):
    url = f"{DB_URL}{path}.json?auth={DB_SECRET}"
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read())

# ── Fetch readings from a specific session ────────────────────────────────────
SESSION_ID = "20260430-035330"  # change this to switch sessions

readings = fb_get(f"/voc_dataset/sessions/{SESSION_ID}/readings")

times, temps, humids, pressures, gases = [], [], [], [], []

for r in (readings or {}).values():
        iso = r.get("iso", "")
        if not iso:
            continue
        try:
            dt = datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            if dt.year < 2025:
                continue
            times.append(dt)
            temps.append(r.get("temp_c"))
            humids.append(r.get("humidity_pct"))
            pressures.append(r.get("pressure_hpa"))
            gases.append(r.get("gas_ohm"))
        except Exception:
            continue

# sort by time
data = sorted(zip(times, temps, humids, pressures, gases))
times, temps, humids, pressures, gases = zip(*data)

fmt = mdates.DateFormatter("%m/%d %H:%M")

# ── Plot 1: four separate subplots ────────────────────────────────────────────
fig1, axes = plt.subplots(4, 1, figsize=(12, 10), sharex=True)
fig1.suptitle(f"VOC Logger — Session {SESSION_ID}", fontsize=14)

for ax, values, label, color in zip(
    axes,
    [temps, humids, pressures, gases],
    ["Temperature (°C)", "Humidity (%)", "Pressure (hPa)", "Gas Resistance (Ω)"],
    ["tomato", "steelblue", "seagreen", "darkorange"],
):
    ax.plot(times, values, color=color, linewidth=0.8)
    ax.set_ylabel(label, fontsize=9)
    ax.grid(True, alpha=0.3)

axes[-1].xaxis.set_major_formatter(fmt)
plt.xticks(rotation=30, ha="right")
plt.tight_layout()
plt.savefig("voc_separate.png", dpi=150)
print("Saved: voc_separate.png")

# ── Plot 2: all four on one chart (normalised 0-1) ────────────────────────────
def norm(vals):
    mn, mx = min(vals), max(vals)
    return [(v - mn) / (mx - mn) if mx != mn else 0 for v in vals]

fig2, ax2 = plt.subplots(figsize=(12, 5))
fig2.suptitle(f"VOC Logger — Session {SESSION_ID} — All Metrics Normalised (0–1)", fontsize=14)

for values, label, color in zip(
    [temps, humids, pressures, gases],
    ["Temperature", "Humidity", "Pressure", "Gas Resistance"],
    ["tomato", "steelblue", "seagreen", "darkorange"],
):
    ax2.plot(times, norm(values), label=label, linewidth=0.8)

ax2.xaxis.set_major_formatter(fmt)
ax2.legend()
ax2.grid(True, alpha=0.3)
plt.xticks(rotation=30, ha="right")
plt.tight_layout()
plt.savefig("voc_combined.png", dpi=150)
print("Saved: voc_combined.png")

plt.show()
