import { useEffect, useState, useRef, useCallback } from 'react';
import {
  SafeAreaView, ScrollView, StyleSheet, Text, View,
  StatusBar, Pressable, Animated,
} from 'react-native';
import { ref, onValue, set } from 'firebase/database';
import { db } from './firebase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:           '#000000',
  surface:      '#1C1C1E',
  surface2:     '#2C2C2E',
  border:       'rgba(255,255,255,0.08)',
  text:         '#FFFFFF',
  textSoft:     'rgba(255,255,255,0.55)',
  textFaint:    'rgba(255,255,255,0.28)',
  blue:         '#0A84FF',
  green:        '#32D74B',
  orange:       '#FF9F0A',
  red:          '#FF453A',
  purple:       '#BF5AF2',
};

const TRIGGER = {
  pir:   { label: 'Motion',  icon: '🚶', color: C.blue },
  voice: { label: 'Voice',   icon: '🎙️', color: C.purple },
  app:   { label: 'App',     icon: '📱', color: C.green },
  voc:   { label: 'VOC',     icon: '💨', color: C.orange },
};

// ── Utilities ─────────────────────────────────────────────────────────────────
function relTime(ms) {
  const d = Date.now() - ms;
  if (d < 5000)     return 'just now';
  if (d < 60000)    return `${Math.floor(d / 1000)}s ago`;
  if (d < 3600000)  return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── StatusDot ─────────────────────────────────────────────────────────────────
function StatusDot({ connected }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (connected) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.8, duration: 1400, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 1400, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
    pulse.setValue(1);
  }, [connected]);

  return (
    <View style={s.dotWrap}>
      {connected && (
        <Animated.View
          style={[s.dotRing, { transform: [{ scale: pulse }] }]}
        />
      )}
      <View style={[s.dot, { backgroundColor: connected ? C.green : C.red }]} />
    </View>
  );
}

// ── SprayButton ───────────────────────────────────────────────────────────────
const BTN = {
  idle:    { colors: ['#1A6FFF', '#0A50CC'], label: 'Spray Now',    sub: 'Tap to trigger fragrance' },
  pending: { colors: ['#FF9F0A', '#E07800'], label: 'Sending…',     sub: 'Waiting for device'       },
  done:    { colors: ['#32D74B', '#22A83B'], label: 'Triggered ✓',  sub: 'Spray on its way'         },
  error:   { colors: ['#FF453A', '#CC2020'], label: 'No Response',  sub: 'Device may be offline'    },
};

function SprayButton({ onPress, state }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === 'pending') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.06, duration: 700, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.00, duration: 700, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  }, [state]);

  const cfg = BTN[state] ?? BTN.idle;
  const shadowColor = { idle: C.blue, pending: C.orange, done: C.green, error: C.red }[state] ?? C.blue;
  const disabled = state === 'pending' || state === 'done';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [s.btnWrap, pressed && !disabled && { opacity: 0.82 }]}
    >
      <Animated.View style={[s.btnOuter, { shadowColor, transform: [{ scale }] }]}>
        <LinearGradient
          colors={cfg.colors}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={s.btnGrad}
        >
          <Text style={s.btnIcon}>💨</Text>
          <Text style={s.btnLabel}>{cfg.label}</Text>
          <Text style={s.btnSub}>{cfg.sub}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// ── ActivityRow ───────────────────────────────────────────────────────────────
function ActivityRow({ item, last }) {
  const meta = TRIGGER[item.trigger] ?? { label: item.trigger ?? '?', icon: '❓', color: C.textSoft };
  const date = new Date(item.unixMs);
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <View style={s.row}>
        <View style={[s.rowIcon, { backgroundColor: meta.color + '28' }]}>
          <Text style={s.rowEmoji}>{meta.icon}</Text>
        </View>
        <View style={s.rowBody}>
          <Text style={s.rowTitle}>{meta.label} Spray</Text>
          <Text style={s.rowSub}>{time} · {(item.duration_ms / 1000).toFixed(1)} s</Text>
        </View>
        <Text style={s.rowRel}>{relTime(item.unixMs)}</Text>
      </View>
      {!last && <View style={s.sep} />}
    </>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [events,     setEvents]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [connected,  setConnected]  = useState(false);
  const [sprayState, setSprayState] = useState('idle');

  const sprayRef  = useRef('idle');
  const timerRef  = useRef(null);

  const setState = useCallback((next) => {
    sprayRef.current = next;
    setSprayState(next);
  }, []);

  // ── spray events (read) ───────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(
      ref(db, 'spray_events'),
      (snap) => {
        const data = snap.val() ?? {};
        setEvents(
          Object.entries(data)
            .map(([id, ev]) => ({ id, ...ev }))
            .sort((a, b) => b.unixMs - a.unixMs)
        );
        setLoading(false);
        setConnected(true);
      },
      () => { setLoading(false); setConnected(false); }
    );
    return () => unsub();
  }, []);

  // ── watch /commands/action for ESP32 acknowledgement ─────────────────────
  useEffect(() => {
    const unsub = onValue(ref(db, 'commands/action'), (snap) => {
      if (snap.val() === null && sprayRef.current === 'pending') {
        clearTimeout(timerRef.current);
        setState('done');
        timerRef.current = setTimeout(() => setState('idle'), 2200);
      }
    });
    return () => unsub();
  }, []);

  // ── spray handler ─────────────────────────────────────────────────────────
  const handleSpray = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState('pending');

    try {
      await set(ref(db, 'commands/action'), {
        action:      'spray',
        source:      'app',
        requestedAt: Date.now(),
      });

      timerRef.current = setTimeout(() => {
        setState('error');
        timerRef.current = setTimeout(() => setState('idle'), 3000);
      }, 10000);
    } catch {
      setState('error');
      timerRef.current = setTimeout(() => setState('idle'), 3000);
    }
  }, []);

  const last = events[0];
  const visible = events.slice(0, 20);

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>SMART HOME</Text>
          <Text style={s.title}>AuraSync</Text>
        </View>
        <View style={s.headerRight}>
          <StatusDot connected={connected} />
          <Text style={s.headerStatus}>{connected ? 'Connected' : 'Connecting…'}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Device card ── */}
        <View style={s.deviceCard}>
          <View style={s.deviceCardTop}>
            <View>
              <Text style={s.deviceRoom}>Bathroom</Text>
              <Text style={s.deviceName}>Scent Diffuser</Text>
            </View>
            <View style={s.badge}>
              <Text style={s.badgeText}>Active</Text>
            </View>
          </View>

          <SprayButton onPress={handleSpray} state={sprayState} />

          <Text style={s.lastSpray}>
            {last
              ? `Last spray ${relTime(last.unixMs)} · ${TRIGGER[last.trigger]?.label ?? last.trigger}`
              : 'No sprays recorded yet'}
          </Text>
        </View>

        {/* ── Activity section ── */}
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Recent Activity</Text>
          {events.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countText}>{events.length}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={s.center}>
            <Text style={s.softText}>Loading…</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={s.center}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>💨</Text>
            <Text style={s.emptyTitle}>No activity yet</Text>
            <Text style={s.softText}>Spray events will appear here</Text>
          </View>
        ) : (
          <View style={s.list}>
            {visible.map((item, i) => (
              <ActivityRow key={item.id} item={item} last={i === visible.length - 1} />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 16, paddingTop: 8 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  eyebrow:      { fontSize: 10, fontWeight: '700', color: C.textFaint, letterSpacing: 1.5 },
  title:        { fontSize: 28, fontWeight: '700', color: C.text, letterSpacing: -0.6, marginTop: 3 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerStatus: { fontSize: 13, color: C.textSoft },

  // Status dot
  dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  dot:     { width: 8, height: 8, borderRadius: 4, position: 'absolute' },
  dotRing: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.green + '35', position: 'absolute' },

  // Device card
  deviceCard: {
    backgroundColor: C.surface, borderRadius: 24,
    padding: 20, marginTop: 20, marginBottom: 24,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
  },
  deviceCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  deviceRoom:    { fontSize: 12, color: C.textSoft, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  deviceName:    { fontSize: 20, fontWeight: '600', color: C.text, marginTop: 4, letterSpacing: -0.3 },
  badge:         { backgroundColor: C.green + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText:     { fontSize: 12, fontWeight: '600', color: C.green },
  lastSpray:     { fontSize: 12, color: C.textFaint, textAlign: 'center', marginTop: 20 },

  // Spray button
  btnWrap:  { alignItems: 'center', marginBottom: 4 },
  btnOuter: {
    width: 168, height: 168, borderRadius: 84,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 14,
  },
  btnGrad:  {
    width: 168, height: 168, borderRadius: 84,
    alignItems: 'center', justifyContent: 'center',
  },
  btnIcon:  { fontSize: 38, marginBottom: 7 },
  btnLabel: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  btnSub:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

  // Section
  sectionHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: C.text },
  countBadge:   { backgroundColor: C.surface2, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  countText:    { fontSize: 12, fontWeight: '600', color: C.textSoft },

  // Activity list
  list: {
    backgroundColor: C.surface, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    overflow: 'hidden',
  },
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  rowIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowEmoji:{ fontSize: 19 },
  rowBody: { flex: 1 },
  rowTitle:{ fontSize: 15, fontWeight: '500', color: C.text },
  rowSub:  { fontSize: 12, color: C.textSoft, marginTop: 2 },
  rowRel:  { fontSize: 12, color: C.textFaint },
  sep:     { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 68 },

  // Misc
  center:     { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 17, fontWeight: '500', color: C.textSoft, marginBottom: 6 },
  softText:   { fontSize: 14, color: C.textFaint },
});
