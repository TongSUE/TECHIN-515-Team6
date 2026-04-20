"""
AuraSync Firebase Dashboard — real-time spray event monitor
Run: streamlit run firebase_dashboard.py
"""

import time
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

# ── Config ────────────────────────────────────────────────────────────────────
DATABASE_URL    = "https://aurasync-team6-default-rtdb.firebaseio.com"
DATABASE_SECRET = "REDACTED"
REFRESH_S       = 5
TZ              = ZoneInfo("America/Los_Angeles")
TZ_LABEL        = "Seattle"

st.set_page_config(page_title="AuraSync Monitor", page_icon="💧", layout="wide")

# ── Theme state ───────────────────────────────────────────────────────────────
if "dark" not in st.session_state:
    st.session_state.dark = True

dark = st.session_state.dark

# ── CSS ───────────────────────────────────────────────────────────────────────
if dark:
    VARS = """
      --bg:        #09090b;
      --surface:   #111113;
      --surface-2: #1c1c1f;
      --border:    #2e2e32;
      --text:      #fafafa;
      --text-2:    #8c8c99;
      --text-3:    #4a4a55;
      --accent:    #22d3ee;
      --accent-bg: rgba(34,211,238,.07);
      --green:     #4ade80;
      --green-bg:  rgba(74,222,128,.08);
      --shadow:    0 0 0 1px #2e2e32, 0 8px 32px rgba(0,0,0,.5);
    """
    pg   = "#09090b"
    grid = "#1c1c1f"
    txc  = "#8c8c99"
    acc  = "#22d3ee"
else:
    VARS = """
      --bg:        #f1f5f9;
      --surface:   #ffffff;
      --surface-2: #f8fafc;
      --border:    #e2e8f0;
      --text:      #0f172a;
      --text-2:    #64748b;
      --text-3:    #94a3b8;
      --accent:    #0891b2;
      --accent-bg: rgba(8,145,178,.06);
      --green:     #16a34a;
      --green-bg:  rgba(22,163,74,.07);
      --shadow:    0 0 0 1px #e2e8f0, 0 4px 16px rgba(0,0,0,.06);
    """
    pg   = "#f1f5f9"
    grid = "#f1f5f9"
    txc  = "#94a3b8"
    acc  = "#0891b2"

st.markdown(f"""
<style>
:root {{ {VARS} }}

/* ── Streamlit reset ── */
.stApp, section.main, .stApp > div {{
    background: var(--bg) !important;
}}
.block-container {{
    padding: 28px 36px 60px !important;
    max-width: 1440px !important;
}}
#MainMenu, footer, header,
[data-testid="stToolbar"],
[data-testid="stDecoration"] {{ display: none !important; }}

/* ── Typography ── */
*, p, div, span, h1, h2, h3 {{ color: var(--text); }}

/* ── Metric card ── */
.mc {{
    background: var(--surface);
    box-shadow: var(--shadow);
    border-radius: 16px;
    padding: 22px 24px 18px;
    height: 100%;
}}
.mc-label {{
    font-size: 10px; font-weight: 700;
    letter-spacing: .16em; text-transform: uppercase;
    color: var(--text-3); margin-bottom: 12px;
}}
.mc-value {{
    font-size: 42px; font-weight: 800;
    line-height: 1; letter-spacing: -.02em;
    color: var(--text);
    font-variant-numeric: tabular-nums;
}}
.mc-value.hi {{ color: var(--accent); }}
.mc-sub {{
    font-size: 12px; color: var(--text-2);
    margin-top: 6px;
    font-variant-numeric: tabular-nums;
}}

/* ── Section label ── */
.sl {{
    font-size: 10px; font-weight: 700;
    letter-spacing: .16em; text-transform: uppercase;
    color: var(--text-3); margin: 32px 0 14px;
}}

/* ── Chart card ── */
.cc {{
    background: var(--surface);
    box-shadow: var(--shadow);
    border-radius: 16px;
    padding: 20px 16px 12px;
}}
.cc-title {{
    font-size: 10px; font-weight: 700;
    letter-spacing: .14em; text-transform: uppercase;
    color: var(--text-3); padding-left: 4px; margin-bottom: 4px;
}}

/* ── Event row ── */
.er {{
    display: flex; align-items: center; gap: 16px;
    padding: 13px 18px;
    background: var(--surface);
    box-shadow: var(--shadow);
    border-radius: 12px;
    margin-bottom: 8px;
    transition: box-shadow .15s;
}}
.er-bar {{
    width: 3px; height: 28px; border-radius: 2px;
    background: var(--accent); flex-shrink: 0;
}}
.er-cmd {{
    font-size: 11px; font-weight: 800;
    letter-spacing: .12em; text-transform: uppercase;
    color: var(--accent); min-width: 48px;
}}
.er-time {{
    font-size: 13.5px; color: var(--text);
    font-variant-numeric: tabular-nums; flex: 1;
}}
.er-ago {{
    font-size: 12px; color: var(--text-3);
    background: var(--surface-2);
    padding: 3px 8px; border-radius: 6px;
}}

/* ── Live pill ── */
.lp {{
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--green-bg);
    border: 1px solid var(--green);
    border-radius: 999px; padding: 5px 12px;
    font-size: 10px; font-weight: 800;
    letter-spacing: .14em; color: var(--green);
}}
.ld {{
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--green);
    animation: blink 1.5s ease-in-out infinite;
}}
@keyframes blink {{
    0%,100%{{ opacity:1; }} 50%{{ opacity:.2; }}
}}

/* ── Theme button ── */
.stButton > button {{
    background: var(--surface-2) !important;
    border: 1px solid var(--border) !important;
    color: var(--text-2) !important;
    border-radius: 10px !important;
    font-size: 14px !important;
    padding: 5px 14px !important;
    font-weight: 500 !important;
}}
.stButton > button:hover {{
    border-color: var(--accent) !important;
    color: var(--accent) !important;
    background: var(--accent-bg) !important;
}}
</style>
""", unsafe_allow_html=True)

# ── Data ──────────────────────────────────────────────────────────────────────
@st.cache_data(ttl=REFRESH_S)
def fetch_events() -> list[dict]:
    try:
        r = requests.get(
            f"{DATABASE_URL}/spray_events.json?auth={DATABASE_SECRET}",
            timeout=8,
        )
        if r.status_code != 200: return []
        data = r.json()
        if not isinstance(data, dict): return []
        events = []
        for k, v in data.items():
            if isinstance(v, dict):
                v["_key"] = k
                events.append(v)
        return sorted(events, key=lambda e: e.get("unixMs", 0), reverse=True)
    except Exception:
        return []

def to_local(unix_ms: float) -> datetime:
    return datetime.fromtimestamp(unix_ms / 1000, tz=TZ)

def fmt(unix_ms: float, f="%b %d, %H:%M:%S") -> str:
    return to_local(unix_ms).strftime(f)

def ago(unix_ms: float) -> str:
    s = int(time.time() - unix_ms / 1000)
    if s < 60:   return f"{s}s ago"
    if s < 3600: return f"{s//60}m ago"
    return f"{s//3600}h ago"

events = fetch_events()
total  = len(events)

# ── Header ────────────────────────────────────────────────────────────────────
h_l, h_r = st.columns([1, 1])

with h_l:
    st.markdown(
        "<div style='display:flex;align-items:center;gap:14px;padding:4px 0'>"
        "<span style='font-size:28px;font-weight:800;letter-spacing:-.03em'>"
        "💧 AuraSync</span>"
        "<span style='font-size:13px;color:var(--text-3);font-weight:500'>"
        "Spray Event Monitor</span>"
        f"<div class='lp'><div class='ld'></div>LIVE</div>"
        "</div>",
        unsafe_allow_html=True,
    )

with h_r:
    btn_c, info_c = st.columns([1, 3])
    with btn_c:
        label = "☀️ Light" if dark else "🌙 Dark"
        if st.button(label, key="theme_btn"):
            st.session_state.dark = not dark
            st.rerun()
    with info_c:
        now_local = datetime.now(TZ)
        st.markdown(
            f"<div style='text-align:right;font-size:12px;color:var(--text-3);"
            f"padding-top:10px;font-variant-numeric:tabular-nums'>"
            f"{now_local.strftime('%A, %b %d · %H:%M:%S')} {TZ_LABEL} · "
            f"refreshes every {REFRESH_S}s</div>",
            unsafe_allow_html=True,
        )

st.markdown("<div style='height:24px'></div>", unsafe_allow_html=True)

# ── Metric cards ──────────────────────────────────────────────────────────────
c1, c2, c3, c4 = st.columns(4, gap="medium")

with c1:
    st.markdown(
        f"<div class='mc'><div class='mc-label'>Total sprays</div>"
        f"<div class='mc-value hi'>{total}</div>"
        f"<div class='mc-sub'>all time</div></div>",
        unsafe_allow_html=True,
    )

with c2:
    if total:
        ltime = fmt(events[0]["unixMs"])
        ldate = to_local(events[0]["unixMs"]).strftime("%A")
    else:
        ltime, ldate = "—", ""
    st.markdown(
        f"<div class='mc'><div class='mc-label'>Last spray</div>"
        f"<div class='mc-value' style='font-size:26px;padding-top:8px'>{ltime}</div>"
        f"<div class='mc-sub'>{ldate}</div></div>",
        unsafe_allow_html=True,
    )

with c3:
    a = ago(events[0]["unixMs"]) if total else "—"
    st.markdown(
        f"<div class='mc'><div class='mc-label'>Time since last</div>"
        f"<div class='mc-value'>{a}</div>"
        f"<div class='mc-sub'>&nbsp;</div></div>",
        unsafe_allow_html=True,
    )

with c4:
    cutoff = time.time() * 1000 - 3_600_000
    last_hr = sum(1 for e in events if e.get("unixMs", 0) > cutoff) if total else 0
    st.markdown(
        f"<div class='mc'><div class='mc-label'>Last 60 min</div>"
        f"<div class='mc-value hi'>{last_hr}</div>"
        f"<div class='mc-sub'>sprays</div></div>",
        unsafe_allow_html=True,
    )

# ── No data ───────────────────────────────────────────────────────────────────
if total == 0:
    st.markdown("<br>", unsafe_allow_html=True)
    st.info("No spray events yet — say **'Aura' → 'Spray'** on the device.")
    time.sleep(REFRESH_S)
    st.rerun()

# ── Build dataframe ───────────────────────────────────────────────────────────
df = pd.DataFrame(events)
df["dt"]    = df["unixMs"].apply(to_local)
df["hr"]    = df["dt"].dt.floor("h")
df["h_str"] = df["dt"].dt.strftime("%H:%M")

# Chronological for cumulative chart
df_asc = df.sort_values("dt")
df_asc["cumulative"] = range(1, len(df_asc) + 1)

# ── Charts ────────────────────────────────────────────────────────────────────
st.markdown("<div class='sl'>Activity</div>", unsafe_allow_html=True)
ch_main, ch_side = st.columns([3, 1], gap="medium")

layout_base = dict(
    paper_bgcolor=pg,
    plot_bgcolor=pg,
    font_color=txc,
    margin=dict(l=8, r=8, t=8, b=8),
    showlegend=False,
    xaxis=dict(gridcolor=grid, showgrid=True, linecolor=grid, tickfont_size=11),
    yaxis=dict(gridcolor=grid, showgrid=True, linecolor=grid, tickfont_size=11),
)

with ch_main:
    # Cumulative step chart
    fig = go.Figure()
    # Area fill
    fig.add_trace(go.Scatter(
        x=df_asc["dt"], y=df_asc["cumulative"],
        mode="lines",
        line=dict(color=acc, width=0),
        fill="tozeroy",
        fillcolor=f"rgba(34,211,238,.06)" if dark else "rgba(8,145,178,.05)",
        hoverinfo="skip",
    ))
    # Step line + dots
    fig.add_trace(go.Scatter(
        x=df_asc["dt"], y=df_asc["cumulative"],
        mode="lines+markers",
        line=dict(color=acc, width=2, shape="hv"),
        marker=dict(color=acc, size=7, line=dict(color=pg, width=2)),
        hovertemplate="<b>%{y} sprays</b><br>%{x|%b %d, %H:%M:%S}<extra></extra>",
    ))
    fig.update_layout(
        **layout_base,
        height=220,
        yaxis_title="",
        xaxis_tickformat="%H:%M<br>%b %d",
    )
    st.markdown("<div class='cc'><div class='cc-title'>Cumulative spray count</div>",
                unsafe_allow_html=True)
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
    st.markdown("</div>", unsafe_allow_html=True)

with ch_side:
    # Hourly distribution
    hourly = df.groupby(df["dt"].dt.hour).size().reset_index(name="n")
    hourly.columns = ["hour", "n"]
    fig2 = go.Figure(go.Bar(
        x=hourly["n"], y=[f"{h:02d}:00" for h in hourly["hour"]],
        orientation="h",
        marker=dict(
            color=hourly["n"],
            colorscale=[[0, f"rgba(34,211,238,.25)"], [1, acc]],
            showscale=False,
        ),
        hovertemplate="%{y} — <b>%{x}</b> sprays<extra></extra>",
    ))
    fig2.update_layout(
        **layout_base,
        height=220,
        xaxis_title="",
        xaxis_tickformat="d",
        bargap=0.3,
    )
    st.markdown("<div class='cc'><div class='cc-title'>By hour of day</div>",
                unsafe_allow_html=True)
    st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})
    st.markdown("</div>", unsafe_allow_html=True)

# ── Event log ─────────────────────────────────────────────────────────────────
log_l, log_r = st.columns([3, 2], gap="medium")

with log_l:
    st.markdown("<div class='sl'>Recent events</div>", unsafe_allow_html=True)
    for e in events[:10]:
        cmd  = e.get("command", "spray").upper()
        time_str = fmt(e["unixMs"], "%b %d · %H:%M:%S") + f" {TZ_LABEL}"
        a = ago(e["unixMs"])
        st.markdown(
            f"<div class='er'>"
            f"<div class='er-bar'></div>"
            f"<div class='er-cmd'>{cmd}</div>"
            f"<div class='er-time'>{time_str}</div>"
            f"<div class='er-ago'>{a}</div>"
            f"</div>",
            unsafe_allow_html=True,
        )
    if total > 10:
        st.markdown(
            f"<div style='text-align:center;font-size:11px;color:var(--text-3);"
            f"padding:8px'>+ {total - 10} older events</div>",
            unsafe_allow_html=True,
        )

with log_r:
    st.markdown("<div class='sl'>Daily breakdown</div>", unsafe_allow_html=True)
    daily = (
        df.groupby(df["dt"].dt.date)
          .size()
          .reset_index(name="count")
    )
    daily.columns = ["date", "count"]
    daily["date_str"] = pd.to_datetime(daily["date"]).dt.strftime("%a, %b %d")

    for _, row in daily.sort_values("date", ascending=False).iterrows():
        pct = int(row["count"] / daily["count"].max() * 100)
        st.markdown(
            f"<div style='background:var(--surface);box-shadow:var(--shadow);"
            f"border-radius:10px;padding:12px 16px;margin-bottom:8px'>"
            f"<div style='display:flex;justify-content:space-between;"
            f"align-items:center;margin-bottom:8px'>"
            f"<span style='font-size:13px;color:var(--text)'>{row['date_str']}</span>"
            f"<span style='font-size:13px;font-weight:700;color:var(--accent)'>"
            f"{int(row['count'])}</span></div>"
            f"<div style='background:var(--surface-2);border-radius:4px;height:4px'>"
            f"<div style='background:var(--accent);border-radius:4px;"
            f"width:{pct}%;height:4px'></div></div>"
            f"</div>",
            unsafe_allow_html=True,
        )

# ── Footer ────────────────────────────────────────────────────────────────────
st.markdown(
    "<div style='text-align:center;font-size:11px;color:var(--text-3);"
    "margin-top:48px;letter-spacing:.06em'>"
    "AuraSync · TECHIN 515 · Team 6 · Spring 2026</div>",
    unsafe_allow_html=True,
)

time.sleep(REFRESH_S)
st.rerun()
