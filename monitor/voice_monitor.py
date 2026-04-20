"""
AuraSync Voice Monitor — real-time voice recognition dashboard (st.empty streaming)
Run: streamlit run app.py
"""

import threading
import time
from collections import deque
from datetime import datetime

import serial
import serial.tools.list_ports
import plotly.graph_objects as go
import streamlit as st


# ── Persistent shared state ───────────────────────────────────────────────────
@st.cache_resource
def get_shared():
    return {
        "levels":      deque(maxlen=150),
        "words":       [],    # [(datetime, raw_word, prob)]
        "counts":      {},    # canonical → int
        "lock":        threading.Lock(),
        "thread":      None,
        "last_cmd":    None,   # canonical
        "last_cmd_ts": None,
        "sys_state":   "idle", # "idle" | "listening"
        "listen_ts":   None,   # when listening window started
        "error":       "",
    }


# ── Vocabulary: (match prefix, display label, icon, fg color, bg color, description) ──
VOCAB = [
    ("aura",  "Aura",  "🌊", "#7c3aed", "#ede9fe", "Wake word"),
    ("spray", "Spray", "💧", "#1565c0", "#dbeafe", "Start spray"),
    ("stop",  "Stop",  "⏹",  "#b71c1c", "#fee2e2", "Stop spray"),
]

STATUS_CONFIG = {
    "aura":  ("🌊 AURA — Say a command",  "#7c3aed", "#ede9fe"),
    "spray": ("💧 SPRAY — Spraying",      "#1565c0", "#dbeafe"),
    "stop":  ("⏹ STOP — Stopped",         "#b71c1c", "#fee2e2"),
}

LISTEN_WINDOW_S = 5  # must match the Arduino firmware constant


def resolve_word(raw: str):
    """MultiNet raw string → (canonical, label, icon, fg, bg)"""
    r = raw.lower()
    for key, label, icon, fg, bg, _ in VOCAB:
        if r == key or r.startswith(key[:3]):
            return key, label, icon, fg, bg
    return raw, raw.upper(), "❓", "#555", "#f3f4f6"


def serial_loop(data: dict, port: str):
    try:
        ser = serial.Serial(port, 115200, timeout=1)
        data["error"] = ""
        while True:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
            if line.startswith("LEVEL:"):
                try:
                    with data["lock"]:
                        data["levels"].append(float(line[6:]))
                        data["error"] = ""
                except ValueError:
                    pass
            elif line.startswith("STATE:"):
                state = line[6:].strip()
                with data["lock"]:
                    data["sys_state"] = state
                    if state == "listening":
                        data["listen_ts"] = datetime.now()
            elif line.startswith("WORD:"):
                parts = line.split(":")
                if len(parts) >= 3:
                    raw = parts[1].strip()
                    try:
                        prob = float(parts[2])
                    except ValueError:
                        prob = 0.0
                    canonical, *_ = resolve_word(raw)
                    with data["lock"]:
                        data["words"].append((datetime.now(), raw, prob))
                        if len(data["words"]) > 100:
                            data["words"].pop(0)
                        data["counts"][canonical] = data["counts"].get(canonical, 0) + 1
                        data["last_cmd"]    = canonical
                        data["last_cmd_ts"] = datetime.now()
    except Exception as e:
        data["error"] = str(e)


def ensure_thread(data: dict, port: str):
    t = data["thread"]
    if t is None or not t.is_alive():
        t = threading.Thread(target=serial_loop, args=(data, port), daemon=True)
        t.start()
        data["thread"] = t


# ════════════════════════════════════════════════════════════════
#  Page config & global CSS
# ════════════════════════════════════════════════════════════════
st.set_page_config(
    page_title="AuraSync Voice Monitor",
    page_icon="🎙️",
    layout="wide",
)

st.markdown("""
<style>
/* State banner */
.status-banner {
    border-radius: 14px;
    padding: 18px 28px;
    margin-bottom: 4px;
    text-align: center;
    font-size: 1.55em;
    font-weight: 800;
    letter-spacing: 0.04em;
    transition: background 0.4s, color 0.4s;
}
/* Vocabulary cards */
.vocab-card {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    border-radius: 12px;
    padding: 10px 18px;
    margin: 4px;
    min-width: 90px;
    border: 2px solid transparent;
    cursor: default;
}
.vocab-card.active-word {
    border-color: currentColor;
    box-shadow: 0 2px 12px rgba(0,0,0,0.18);
    transform: scale(1.06);
}
/* History rows */
.hist-row {
    border-radius: 8px;
    padding: 6px 14px;
    margin: 3px 0;
    display: flex;
    align-items: center;
    gap: 10px;
}
</style>
""", unsafe_allow_html=True)

st.title("🎙️ AuraSync Voice Monitor")
st.caption("ESP32-S3 + SPH0645  ·  Real-time voice recognition")

# ── Shared state & port discovery
data  = get_shared()
ports = [p.device for p in serial.tools.list_ports.comports()]
port  = ports[0] if ports else None

# ── Sidebar
with st.sidebar:
    st.header("⚙️ Device")
    if port:
        t = data["thread"]
        if data["error"]:
            st.error(f"❌ {port}: {data['error']}")
            st.caption("Close the Arduino IDE serial monitor, then refresh.")
        elif t and t.is_alive():
            st.success(f"✅ Reading: {port}")
        else:
            st.warning(f"⏳ Connecting: {port}")
    else:
        st.error("❌ No serial port found")
    if len(ports) > 1:
        st.caption(", ".join(ports))
    st.divider()
    if st.button("🗑️ Clear history", use_container_width=True):
        with data["lock"]:
            data["levels"].clear()
            data["words"].clear()
            data["counts"].clear()
            data["last_cmd"]    = None
            data["last_cmd_ts"] = None

if port:
    ensure_thread(data, port)

# ════════════════════════════════════════════════════════════════
#  Static layout skeleton (rendered once)
# ════════════════════════════════════════════════════════════════

# 1. State banner (full width)
status_ph = st.empty()

st.divider()

# 2. Two-column main layout
col_left, col_right = st.columns([1, 1], gap="large")

with col_left:
    st.subheader("📊 Live audio level")
    level_ph = st.empty()   # pure-HTML level bar (no flicker)
    line_ph  = st.empty()   # Plotly line chart (throttled)

with col_right:
    st.subheader("🗒️ Vocabulary")
    vocab_ph = st.empty()   # word cards, highlighted on last command

    st.divider()
    st.subheader("🗣️ Recognition history")
    words_ph = st.empty()
    bar_ph   = st.empty()


# ════════════════════════════════════════════════════════════════
#  HTML builder functions
# ════════════════════════════════════════════════════════════════

def build_status(cmd, ts, sys_state, listen_ts) -> str:
    if sys_state == "listening" and listen_ts:
        elapsed = (datetime.now() - listen_ts).total_seconds()
        remaining = max(0, LISTEN_WINDOW_S - elapsed)
        bar_pct = remaining / LISTEN_WINDOW_S * 100
        return (
            "<div class='status-banner' style='background:#ede9fe;color:#7c3aed'>"
            "🎧 Listening… say Spray or Stop"
            f"<div style='margin-top:8px;background:#d8b4fe;border-radius:6px;"
            f"height:8px;overflow:hidden'>"
            f"<div style='background:#7c3aed;width:{bar_pct:.0f}%;height:100%;"
            f"border-radius:6px;transition:width 0.4s linear'></div></div>"
            f"<div style='font-size:0.45em;font-weight:400;color:#9333ea;margin-top:4px'>"
            f"Window closes in {remaining:.1f}s</div>"
            "</div>"
        )
    if cmd is None:
        return (
            "<div class='status-banner' style='background:#f1f5f9;color:#94a3b8'>"
            "💤 AuraSync standby &nbsp;"
            "<span style='font-size:0.5em;font-weight:400'>Say <b>Aura</b> to wake</span>"
            "</div>"
        )
    text, fg, bg = STATUS_CONFIG.get(cmd, (cmd.upper(), "#555", "#eee"))
    elapsed = (datetime.now() - ts).total_seconds() if ts else 999
    age = "just now" if elapsed < 1 else f"{elapsed:.0f}s ago"
    return (
        f"<div class='status-banner' style='background:{bg};color:{fg}'>"
        f"{text}&nbsp;"
        f"<span style='font-size:0.5em;font-weight:400;color:#999'>({age})</span>"
        f"</div>"
    )


def build_vocab(active_cmd) -> str:
    html = "<div style='display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px'>"
    for key, label, icon, fg, bg, desc in VOCAB:
        active_cls = "active-word" if key == active_cmd else ""
        html += (
            f"<div class='vocab-card {active_cls}' "
            f"style='background:{bg};color:{fg}'>"
            f"<span style='font-size:1.6em'>{icon}</span>"
            f"<span style='font-weight:800;font-size:1em'>{label}</span>"
            f"<span style='font-size:0.72em;color:#888;text-align:center'>{desc}</span>"
            f"</div>"
        )
    html += "</div>"
    return html


def build_level(level: float) -> str:
    pct = min(level / 80 * 100, 100)
    if pct < 25:
        color, label = "#22c55e", "Quiet"
    elif pct < 56:
        color, label = "#f59e0b", "Normal"
    else:
        color, label = "#ef4444", "Loud"
    return (
        f"<div style='padding:8px 4px 4px'>"
        f"<div style='display:flex;align-items:baseline;gap:10px'>"
        f"<span style='font-size:3em;font-weight:800;color:{color};line-height:1'>{level:.1f}</span>"
        f"<span style='color:#888;font-size:0.9em'>/ 80 &nbsp;·&nbsp; {label}</span>"
        f"</div>"
        f"<div style='background:#e5e7eb;border-radius:8px;height:16px;overflow:hidden;margin-top:8px'>"
        f"<div style='background:{color};width:{pct:.1f}%;height:100%;border-radius:8px;"
        f"transition:width 0.3s ease'></div></div>"
        f"</div>"
    )


# ════════════════════════════════════════════════════════════════
#  Real-time update loop
# ════════════════════════════════════════════════════════════════
tick = 0
while True:
    with data["lock"]:
        levels_snap = list(data["levels"])
        words_snap  = list(data["words"])
        counts_snap = dict(data["counts"])
        last_cmd    = data["last_cmd"]
        last_cmd_ts = data["last_cmd_ts"]
        sys_state   = data["sys_state"]
        listen_ts   = data["listen_ts"]

    current_level = levels_snap[-1] if levels_snap else 0.0

    # State banner (every frame, pure HTML)
    status_ph.markdown(
        build_status(last_cmd, last_cmd_ts, sys_state, listen_ts),
        unsafe_allow_html=True,
    )

    # Vocabulary cards with active highlight
    vocab_ph.markdown(build_vocab(last_cmd), unsafe_allow_html=True)

    # Level bar (pure HTML, no Plotly flicker)
    level_ph.markdown(build_level(current_level), unsafe_allow_html=True)

    # Line chart (every 5 frames = 2 s, reduces flicker)
    if tick % 5 == 0 and len(levels_snap) > 2:
        fig_line = go.Figure(go.Scatter(
            y=levels_snap,
            mode="lines",
            line=dict(color="#00b4d8", width=1.5),
            fill="tozeroy",
            fillcolor="rgba(0,180,216,0.12)",
        ))
        fig_line.update_layout(
            height=130,
            margin=dict(l=10, r=10, t=4, b=24),
            xaxis={"showticklabels": False, "title": "← Last 150 frames"},
            yaxis={"range": [0, 80], "title": "Level"},
            showlegend=False,
            plot_bgcolor="#fafafa",
        )
        line_ph.plotly_chart(fig_line, use_container_width=True, key=f"line_{tick}")

    # Recognition history (card-style)
    with words_ph.container():
        if words_snap:
            # Latest command — large card
            ts0, w0, p0 = words_snap[-1]
            _, label0, icon0, fg0, bg0 = resolve_word(w0)
            st.markdown(
                f"<div style='background:{bg0};border-left:5px solid {fg0};"
                f"border-radius:10px;padding:14px 20px;margin-bottom:8px'>"
                f"<div style='color:{fg0};font-size:1.7em;font-weight:800'>"
                f"{icon0} {label0}</div>"
                f"<div style='color:#888;font-size:0.88em;margin-top:2px'>"
                f"{ts0.strftime('%H:%M:%S')} &nbsp;·&nbsp; Confidence&nbsp;"
                f"<b style='color:{fg0}'>{p0:.0%}</b></div>"
                f"</div>",
                unsafe_allow_html=True,
            )
            # Previous entries
            for ts, word, prob in reversed(words_snap[-13:-1]):
                _, label, icon, fg, bg = resolve_word(word)
                bar_str = "█" * int(prob * 10) + "░" * (10 - int(prob * 10))
                st.markdown(
                    f"<div class='hist-row' style='background:{bg}'>"
                    f"<span style='color:#aaa;font-size:0.8em;min-width:60px'>"
                    f"{ts.strftime('%H:%M:%S')}</span>"
                    f"<span style='color:{fg};font-weight:700;min-width:80px'>"
                    f"{icon} {label}</span>"
                    f"<span style='color:#bbb;font-size:0.78em;font-family:monospace'>"
                    f"{bar_str} {prob:.0%}</span>"
                    f"</div>",
                    unsafe_allow_html=True,
                )
        else:
            st.info("Waiting for speech…  Say Aura / Spray / Stop")

    # Word frequency bar chart (every 5 frames)
    if tick % 5 == 0 and counts_snap:
        order      = [v[0] for v in VOCAB]
        color_map  = {v[0]: v[3] for v in VOCAB}
        label_map  = {v[0]: f"{v[2]} {v[1]}" for v in VOCAB}
        items = [(k, counts_snap[k]) for k in order if k in counts_snap]
        if not items:
            items = sorted(counts_snap.items(), key=lambda x: x[1], reverse=True)
        fig_bar = go.Figure(go.Bar(
            x=[label_map.get(k, k) for k, _ in items],
            y=[c for _, c in items],
            marker_color=[color_map.get(k, "#888") for k, _ in items],
            text=[c for _, c in items],
            textposition="auto",
        ))
        fig_bar.update_layout(
            height=200,
            margin=dict(l=10, r=10, t=4, b=24),
            showlegend=False,
            plot_bgcolor="#fafafa",
            xaxis_title="Command",
            yaxis_title="Count",
        )
        bar_ph.plotly_chart(fig_bar, use_container_width=True, key=f"bar_{tick}")

    tick += 1
    time.sleep(0.4)
