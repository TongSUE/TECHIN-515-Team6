import {
  useEffect, useState, useRef, useCallback, useMemo,
  createContext, useContext,
} from 'react';
import {
  SafeAreaView, ScrollView, StyleSheet, Text, View,
  StatusBar, Pressable, Animated, useColorScheme, Switch,
  Platform, Alert,
} from 'react-native';
import { ref, onValue, set } from 'firebase/database';
import { db } from './firebase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

// ── Notification handler ──────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Palettes ──────────────────────────────────────────────────────────────────
const ACCENT = {
  blue:   '#0A84FF',
  green:  '#32D74B',
  orange: '#FF9F0A',
  red:    '#FF453A',
  purple: '#BF5AF2',
  teal:   '#5AC8FA',
};

const PALETTES = {
  dark: {
    bg:        '#000000',
    surface:   '#1C1C1E',
    surface2:  '#2C2C2E',
    border:    'rgba(255,255,255,0.08)',
    text:      '#FFFFFF',
    textSoft:  'rgba(255,255,255,0.55)',
    textFaint: 'rgba(255,255,255,0.28)',
    statusBar: 'light-content',
    cardShadowOpacity: 0,
  },
  light: {
    bg:        '#F2F2F7',
    surface:   '#FFFFFF',
    surface2:  '#E5E5EA',
    border:    'rgba(0,0,0,0.07)',
    text:      '#000000',
    textSoft:  'rgba(0,0,0,0.50)',
    textFaint: 'rgba(0,0,0,0.30)',
    statusBar: 'dark-content',
    cardShadowOpacity: 0.07,
  },
};

// ── IAQ quality from raw gas resistance (ohm) ─────────────────────────────────
function gasToIAQ(gasOhm) {
  if (gasOhm == null) return { label: '—',        color: '#888888' };
  if (gasOhm > 50000) return { label: 'Good',     color: ACCENT.green  };
  if (gasOhm > 10000) return { label: 'Moderate', color: ACCENT.orange };
                      return { label: 'Poor',     color: ACCENT.red    };
}

// ── Context labels / icons ─────────────────────────────────────────────────────
const CTX = {
  idle:     { label: 'Idle',     icon: '😴', color: ACCENT.teal   },
  awake:    { label: 'Motion',   icon: '🚶', color: ACCENT.blue   },
  spraying: { label: 'Spraying', icon: '💨', color: ACCENT.green  },
  cooldown: { label: 'Cooldown', icon: '⏳', color: ACCENT.orange },
};

// ── Trigger metadata ──────────────────────────────────────────────────────────
const TRIGGER = {
  pir:           { label: 'Motion',    icon: '🚶', color: ACCENT.blue   },
  voice:         { label: 'Voice',     icon: '🎙️', color: ACCENT.purple },
  app:           { label: 'App',       icon: '📱', color: ACCENT.green  },
  voc:           { label: 'VOC',       icon: '💨', color: ACCENT.orange },
  p2_voc:        { label: 'VOC',       icon: '💨', color: ACCENT.orange },
  p3_inflection: { label: 'PIR+VOC',  icon: '🌿', color: ACCENT.teal   },
  iaq_poor:      { label: 'IAQ Poor',  icon: '🌫️', color: ACCENT.red    },
  p3_shower_end: { label: 'Shower',    icon: '🚿', color: ACCENT.blue   },
};

// ── Reservoir config ──────────────────────────────────────────────────────────
const RESERVOIR_ML  = 30;
const RATE_ML_PER_S = 0.03;
// Must match firmware SPRAY_CD_MS in TEST_MODE
const COOLDOWN_MS   = 20000;

// ── Theme context ─────────────────────────────────────────────────────────────
const ThemeCtx = createContext(null);
const useTheme = () => useContext(ThemeCtx);

function makeStyles(C) {
  const cardBase = {
    backgroundColor: C.surface, borderRadius: 24, padding: 20,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: C.cardShadowOpacity, shadowRadius: 8, elevation: 3,
  };
  return StyleSheet.create({
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

    // StatusDot
    dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
    dot:     { width: 8, height: 8, borderRadius: 4, position: 'absolute' },
    dotRing: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.green + '35', position: 'absolute' },

    // Cards
    card:      { ...cardBase, marginTop: 16 },
    deviceCard:{ ...cardBase, marginTop: 20 },
    cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    cardTitle: { fontSize: 17, fontWeight: '600', color: C.text },
    cardSub:   { fontSize: 12, color: C.textSoft, marginTop: 2 },

    // Device card specifics
    deviceRoom: { fontSize: 12, color: C.textSoft, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
    deviceName: { fontSize: 20, fontWeight: '600', color: C.text, marginTop: 4, letterSpacing: -0.3 },
    badge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    badgeText:  { fontSize: 12, fontWeight: '600' },
    lastSpray:  { fontSize: 12, color: C.textFaint, textAlign: 'center', marginTop: 16 },

    // Spray button
    btnWrap:  { alignItems: 'center', marginBottom: 4 },
    btnOuter: {
      width: 168, height: 168, borderRadius: 84,
      shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 14,
    },
    btnGrad:  { width: 168, height: 168, borderRadius: 84, alignItems: 'center', justifyContent: 'center' },
    btnIcon:  { fontSize: 38, marginBottom: 7 },
    btnLabel: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
    btnSub:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

    // Cooldown bar
    cdWrap:  { marginTop: 16, marginBottom: 4 },
    cdLabel: { fontSize: 12, color: C.textSoft, marginBottom: 8, textAlign: 'center' },
    cdTrack: { height: 6, backgroundColor: C.surface2, borderRadius: 3, overflow: 'hidden' },
    cdFill:  { height: 6, borderRadius: 3 },

    // Context chip
    ctxChip:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: C.surface2 },
    ctxIcon:  { fontSize: 13 },
    ctxLabel: { fontSize: 12, fontWeight: '600' },

    // Sensor grid
    sensorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
    sensorItem: { flex: 1, minWidth: 90, backgroundColor: C.surface2, borderRadius: 14, padding: 14 },
    sensorVal:  { fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: -0.5 },
    sensorUnit: { fontSize: 13, fontWeight: '500', color: C.textSoft },
    sensorLbl:  { fontSize: 11, color: C.textFaint, marginTop: 4, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
    iaqPill:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 4 },
    iaqPillTxt: { fontSize: 12, fontWeight: '700' },

    // Settings rows
    settingRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    settingLbl:    { fontSize: 15, fontWeight: '500', color: C.text },
    settingSubLbl: { fontSize: 12, color: C.textSoft, marginTop: 2 },
    settingSep:    { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
    stepper:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
    stepBtnTxt:    { fontSize: 20, color: C.text, lineHeight: 24 },
    stepVal:       { fontSize: 15, fontWeight: '600', color: C.text, minWidth: 34, textAlign: 'center' },

    // Usage card
    statsRow:     { flexDirection: 'row', gap: 10, marginTop: 4 },
    statBox:      { flex: 1, backgroundColor: C.surface2, borderRadius: 16, padding: 14, alignItems: 'center' },
    statNum:      { fontSize: 26, fontWeight: '700', color: C.text, letterSpacing: -0.5 },
    statLbl:      { fontSize: 11, color: C.textSoft, marginTop: 3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
    breakdownRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
    chipTxt:      { fontSize: 12, fontWeight: '500', color: C.textSoft },
    resWrap:      { marginTop: 14 },
    resLabelRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    resLabelTxt:  { fontSize: 12, color: C.textSoft, fontWeight: '500' },
    resTrack:     { height: 8, backgroundColor: C.surface2, borderRadius: 4, overflow: 'hidden' },
    resFill:      { height: 8, borderRadius: 4 },

    // Section head
    sectionHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 24 },
    sectionTitle: { fontSize: 17, fontWeight: '600', color: C.text },
    countBadge:   { backgroundColor: C.surface2, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
    countText:    { fontSize: 12, fontWeight: '600', color: C.textSoft },

    // Activity list
    list:     { backgroundColor: C.surface, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: C.cardShadowOpacity, shadowRadius: 4, elevation: 1 },
    row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
    rowIcon:  { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    rowEmoji: { fontSize: 19 },
    rowBody:  { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '500', color: C.text },
    rowSub:   { fontSize: 12, color: C.textSoft, marginTop: 2 },
    rowRel:   { fontSize: 12, color: C.textFaint },
    sep:      { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 68 },

    // Misc
    center:     { alignItems: 'center', paddingVertical: 48 },
    emptyTitle: { fontSize: 17, fontWeight: '500', color: C.textSoft, marginBottom: 6 },
    softText:   { fontSize: 14, color: C.textFaint },
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function relTime(ms) {
  const d = Date.now() - ms;
  if (d < 5000)     return 'just now';
  if (d < 60000)    return `${Math.floor(d / 1000)}s ago`;
  if (d < 3600000)  return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isToday(ms) {
  return new Date(ms).toDateString() === new Date().toDateString();
}

// ── StatusDot ─────────────────────────────────────────────────────────────────
function StatusDot({ connected }) {
  const { C, s } = useTheme();
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
        <Animated.View style={[s.dotRing, { transform: [{ scale: pulse }] }]} />
      )}
      <View style={[s.dot, { backgroundColor: connected ? C.green : C.red }]} />
    </View>
  );
}

// ── SprayButton ───────────────────────────────────────────────────────────────
const BTN_CFG = {
  idle:     { colors: ['#1A6FFF', '#0A50CC'], label: 'Spray Now',    sub: 'Tap to trigger fragrance' },
  pending:  { colors: ['#FF9F0A', '#E07800'], label: 'Sending…',     sub: 'Waiting for device'       },
  done:     { colors: ['#32D74B', '#22A83B'], label: 'Triggered ✓',  sub: 'Spray on its way'         },
  error:    { colors: ['#FF453A', '#CC2020'], label: 'No Response',  sub: 'Device may be offline'    },
  cooldown: { colors: ['#48484A', '#3A3A3C'], label: 'Cooling Down', sub: 'Auto-spray paused'        },
};
const SHADOW_COLORS = {
  idle: ACCENT.blue, pending: ACCENT.orange, done: ACCENT.green, error: ACCENT.red, cooldown: '#48484A',
};

function SprayButton({ onPress, state, inCooldown }) {
  const { s } = useTheme();
  const btnState = inCooldown && state === 'idle' ? 'cooldown' : state;
  const scale    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (btnState === 'pending') {
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
  }, [btnState]);

  const cfg      = BTN_CFG[btnState] ?? BTN_CFG.idle;
  const disabled = btnState !== 'idle';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [s.btnWrap, pressed && !disabled && { opacity: 0.82 }]}
    >
      <Animated.View style={[s.btnOuter, {
        shadowColor: SHADOW_COLORS[btnState] ?? ACCENT.blue,
        transform: [{ scale }],
      }]}>
        <LinearGradient colors={cfg.colors} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={s.btnGrad}>
          <Text style={s.btnIcon}>💨</Text>
          <Text style={s.btnLabel}>{cfg.label}</Text>
          <Text style={s.btnSub}>{cfg.sub}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// ── CooldownBar ───────────────────────────────────────────────────────────────
function CooldownBar({ cooldownEndsAt }) {
  const { C, s } = useTheme();
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!cooldownEndsAt || cooldownEndsAt <= Date.now()) { setRemaining(0); return; }
    const tick = () => setRemaining(Math.max(0, cooldownEndsAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownEndsAt]);

  if (!cooldownEndsAt || remaining <= 0) return null;

  const pct = Math.min(1, remaining / COOLDOWN_MS);
  return (
    <View style={s.cdWrap}>
      <Text style={s.cdLabel}>Cooling down · {Math.ceil(remaining / 1000)}s remaining</Text>
      <View style={s.cdTrack}>
        <View style={[s.cdFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: C.orange }]} />
      </View>
    </View>
  );
}

// ── SensorCard ────────────────────────────────────────────────────────────────
function SensorCard({ sensor }) {
  const { s } = useTheme();
  const iaq = gasToIAQ(sensor?.gas_ohm);
  const ctx = CTX[sensor?.context] ?? CTX.idle;

  return (
    <View style={s.card}>
      <View style={[s.cardTop, { marginBottom: 12 }]}>
        <View>
          <Text style={s.cardTitle}>Air Quality</Text>
          <Text style={s.cardSub}>
            {sensor ? `Updated ${relTime(sensor.updatedAt)}` : 'Waiting for sensor…'}
          </Text>
        </View>
        {sensor && (
          <View style={s.ctxChip}>
            <Text style={s.ctxIcon}>{ctx.icon}</Text>
            <Text style={[s.ctxLabel, { color: ctx.color }]}>{ctx.label}</Text>
          </View>
        )}
      </View>

      <View style={s.sensorGrid}>
        <View style={s.sensorItem}>
          <Text style={[s.sensorVal, { fontSize: 18 }]}>
            {sensor?.gas_ohm != null ? `${(sensor.gas_ohm / 1000).toFixed(1)}` : '—'}
            {sensor?.gas_ohm != null && <Text style={s.sensorUnit}> kΩ</Text>}
          </Text>
          <View style={[s.iaqPill, { backgroundColor: iaq.color + '28', marginTop: 4 }]}>
            <Text style={[s.iaqPillTxt, { color: iaq.color }]} numberOfLines={1}>{iaq.label}</Text>
          </View>
          <Text style={s.sensorLbl}>Gas</Text>
        </View>

        <View style={s.sensorItem}>
          <Text style={s.sensorVal}>
            {sensor?.temp_c != null ? sensor.temp_c.toFixed(1) : '—'}
            {sensor?.temp_c != null && <Text style={s.sensorUnit}> °C</Text>}
          </Text>
          <Text style={s.sensorLbl}>Temp</Text>
        </View>

        <View style={s.sensorItem}>
          <Text style={s.sensorVal}>
            {sensor?.humidity_pct != null ? sensor.humidity_pct.toFixed(0) : '—'}
            {sensor?.humidity_pct != null && <Text style={s.sensorUnit}>%</Text>}
          </Text>
          <Text style={s.sensorLbl}>Humidity</Text>
        </View>
      </View>
    </View>
  );
}

// ── SettingsCard ──────────────────────────────────────────────────────────────
function SettingsCard({ autoSpray, duration, onAutoSprayChange, onDurationChange }) {
  const { C, s } = useTheme();

  const decr = useCallback(() => {
    Haptics.selectionAsync();
    onDurationChange(Math.max(1, duration - 1));
  }, [duration, onDurationChange]);

  const incr = useCallback(() => {
    Haptics.selectionAsync();
    onDurationChange(Math.min(30, duration + 1));
  }, [duration, onDurationChange]);

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Settings</Text>

      <View style={[s.settingRow, { marginTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.settingLbl}>Auto-Spray</Text>
          <Text style={s.settingSubLbl}>VOC + motion triggers</Text>
        </View>
        <Switch
          value={autoSpray}
          onValueChange={onAutoSprayChange}
          trackColor={{ false: C.surface2, true: C.green }}
          thumbColor="#fff"
          ios_backgroundColor={C.surface2}
        />
      </View>

      <View style={s.settingSep} />

      <View style={[s.settingRow]}>
        <View style={{ flex: 1 }}>
          <Text style={s.settingLbl}>Spray Duration</Text>
          <Text style={s.settingSubLbl}>Atomizer on-time per spray</Text>
        </View>
        <View style={s.stepper}>
          <Pressable
            onPress={decr}
            style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={s.stepBtnTxt}>−</Text>
          </Pressable>
          <Text style={s.stepVal}>{duration}s</Text>
          <Pressable
            onPress={incr}
            style={({ pressed }) => [s.stepBtn, pressed && { opacity: 0.5 }]}
          >
            <Text style={s.stepBtnTxt}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── UsageCard ─────────────────────────────────────────────────────────────────
function UsageCard({ events, reservoirResetAt, reservoirStartMl, onReservoirReset }) {
  const { C, s } = useTheme();

  const todayEvents = useMemo(() => events.filter(e => isToday(e.unixMs)), [events]);
  const totalSecs   = useMemo(
    () => events.reduce((acc, e) => acc + (e.duration_ms ?? 5000) / 1000, 0),
    [events]
  );

  const eventsForReservoir = useMemo(
    () => events.filter(e => e.unixMs >= reservoirResetAt),
    [events, reservoirResetAt]
  );
  const reservoirSecs = useMemo(
    () => eventsForReservoir.reduce((acc, e) => acc + (e.duration_ms ?? 5000) / 1000, 0),
    [eventsForReservoir]
  );

  const consumed  = reservoirSecs * RATE_ML_PER_S;
  const remaining = Math.max(0, reservoirStartMl - consumed);
  const resPct    = remaining / reservoirStartMl;
  const resColor  = resPct > 0.5 ? C.green : resPct > 0.2 ? C.orange : C.red;

  const byTrigger = useMemo(() => {
    const counts = {};
    todayEvents.forEach(e => {
      const key = TRIGGER[e.trigger]?.label ?? e.trigger ?? '?';
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts);
  }, [todayEvents]);

  const runtimeLabel = totalSecs < 60
    ? `${Math.round(totalSecs)}s`
    : `${Math.round(totalSecs / 60)}m`;

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reservoir',
      `Estimated remaining: ${remaining.toFixed(1)} ml`,
      [
        {
          text: 'Fill to Full',
          onPress: () => onReservoirReset(RESERVOIR_ML),
        },
        {
          text: 'Set Amount…',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Alert.prompt(
                'Set Remaining',
                'Enter current amount in ml (0–30):',
                (input) => {
                  const ml = parseFloat(input);
                  if (!isNaN(ml)) onReservoirReset(Math.min(RESERVOIR_ML, Math.max(0, ml)));
                },
                'plain-text',
                remaining.toFixed(1),
              );
            } else {
              onReservoirReset(RESERVOIR_ML);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [remaining, onReservoirReset]);

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Usage</Text>

      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statNum}>{todayEvents.length}</Text>
          <Text style={s.statLbl}>Today</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statNum}>{events.length}</Text>
          <Text style={s.statLbl}>Total</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statNum}>{runtimeLabel}</Text>
          <Text style={s.statLbl}>Runtime</Text>
        </View>
      </View>

      {byTrigger.length > 0 && (
        <View style={s.breakdownRow}>
          {byTrigger.map(([label, count]) => {
            const meta = Object.values(TRIGGER).find(t => t.label === label) ?? { icon: '❓', color: '#888' };
            return (
              <View key={label} style={[s.chip, { borderWidth: 1, borderColor: meta.color + '44' }]}>
                <Text style={{ fontSize: 12 }}>{meta.icon}</Text>
                <Text style={s.chipTxt}>{label} · {count}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={s.resWrap}>
        <View style={s.resLabelRow}>
          <Text style={s.resLabelTxt}>Reservoir estimate</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[s.resLabelTxt, { color: resColor }]}>
              {remaining.toFixed(1)} / {reservoirStartMl} ml
            </Text>
            <Pressable onPress={handleReset} hitSlop={8}>
              <Text style={{ fontSize: 14, color: C.textSoft }}>⟳</Text>
            </Pressable>
          </View>
        </View>
        <View style={s.resTrack}>
          <View style={[s.resFill, { width: `${Math.round(resPct * 100)}%`, backgroundColor: resColor }]} />
        </View>
      </View>
    </View>
  );
}

// ── ActivityRow ───────────────────────────────────────────────────────────────
function ActivityRow({ item, last }) {
  const { s } = useTheme();
  const meta = TRIGGER[item.trigger] ?? { label: item.trigger ?? '?', icon: '❓', color: '#888' };
  const time = new Date(item.unixMs).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <View style={s.row}>
        <View style={[s.rowIcon, { backgroundColor: meta.color + '28' }]}>
          <Text style={s.rowEmoji}>{meta.icon}</Text>
        </View>
        <View style={s.rowBody}>
          <Text style={s.rowTitle}>{meta.label} Spray</Text>
          <Text style={s.rowSub}>{time} · {((item.duration_ms ?? 5000) / 1000).toFixed(1)} s</Text>
        </View>
        <Text style={s.rowRel}>{relTime(item.unixMs)}</Text>
      </View>
      {!last && <View style={s.sep} />}
    </>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const scheme = useColorScheme() ?? 'dark';
  const C = useMemo(() => ({ ...PALETTES[scheme], ...ACCENT }), [scheme]);
  const s = useMemo(() => makeStyles(C), [C]);

  // Firebase state
  const [events,         setEvents]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [connected,      setConnected]      = useState(false);
  const [sensor,         setSensor]         = useState(null);
  const [cooldownEndsAt, setCooldownEndsAt] = useState(null);

  // Settings
  const [autoSpray,          setAutoSpray]          = useState(true);
  const [duration,           setDuration]           = useState(5);
  const [reservoirResetAt,   setReservoirResetAt]   = useState(0);
  const [reservoirStartMl,   setReservoirStartMl]   = useState(RESERVOIR_ML);

  // 30-second tick to keep deviceOnline fresh when sensor stops updating
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Spray state machine
  const [sprayState, setSprayState] = useState('idle');
  const sprayRef    = useRef('idle');
  const timerRef    = useRef(null);
  const seenIdsRef  = useRef(new Set());
  const notifOkRef  = useRef(false);

  const setState = useCallback((next) => {
    sprayRef.current = next;
    setSprayState(next);
  }, []);

  // ── Push notification permissions ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      notifOkRef.current = status === 'granted';
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('spray', {
          name: 'Spray Events',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: true,
        });
      }
    })();
  }, []);

  // ── Spray events ───────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(
      ref(db, 'spray_events'),
      (snap) => {
        const data = snap.val() ?? {};
        const list = Object.entries(data)
          .map(([id, ev]) => ({ id, ...ev }))
          .sort((a, b) => b.unixMs - a.unixMs);
        setEvents(list);
        setLoading(false);
        setConnected(true);

        // Local notification for auto-triggered sprays (skip first render batch)
        const isFirstLoad = seenIdsRef.current.size === 0 && list.length > 0;
        list.forEach(ev => {
          if (!seenIdsRef.current.has(ev.id)) {
            seenIdsRef.current.add(ev.id);
            if (!isFirstLoad && ev.trigger !== 'app' && notifOkRef.current) {
              const meta = TRIGGER[ev.trigger] ?? { label: ev.trigger };
              Notifications.scheduleNotificationAsync({
                content: {
                  title: 'AuraSync — Auto Spray',
                  body: `${meta.label} triggered fragrance`,
                  channelId: 'spray',
                },
                trigger: null,
              });
            }
          }
        });
      },
      () => { setLoading(false); setConnected(false); }
    );
    return () => unsub();
  }, []);

  // ── Sensor data ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(db, 'sensors/latest'), (snap) => {
      const d = snap.val();
      if (d) setSensor(d);
    });
    return () => unsub();
  }, []);

  // ── Cooldown status ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(db, 'status/cooldownEndsAt'), (snap) => {
      const v = snap.val();
      setCooldownEndsAt(v ? Number(v) : null);
    });
    return () => unsub();
  }, []);

  // ── Settings (read + sync) ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onValue(ref(db, 'settings'), (snap) => {
      const d = snap.val() ?? {};
      if (d.autoSprayEnabled  != null) setAutoSpray(Boolean(d.autoSprayEnabled));
      if (d.sprayDurationS    != null) setDuration(Number(d.sprayDurationS));
      if (d.reservoirResetAt  != null) setReservoirResetAt(Number(d.reservoirResetAt));
      if (d.reservoirStartMl  != null) setReservoirStartMl(Number(d.reservoirStartMl));
    });
    return () => unsub();
  }, []);

  // ── Watch /commands/action for ESP32 acknowledgement ──────────────────────
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

  // ── Settings write handlers ────────────────────────────────────────────────
  const handleAutoSprayChange = useCallback((val) => {
    setAutoSpray(val);
    set(ref(db, 'settings/autoSprayEnabled'), val);
  }, []);

  const handleDurationChange = useCallback((val) => {
    setDuration(val);
    set(ref(db, 'settings/sprayDurationS'), val);
  }, []);

  // ── Spray handler ──────────────────────────────────────────────────────────
  const handleSpray = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState('pending');
    try {
      await set(ref(db, 'commands/action'), {
        action: 'spray', source: 'app', sprayDurationS: duration, requestedAt: Date.now(),
      });
      timerRef.current = setTimeout(() => {
        setState('error');
        timerRef.current = setTimeout(() => setState('idle'), 3000);
      }, 10000);
    } catch {
      setState('error');
      timerRef.current = setTimeout(() => setState('idle'), 3000);
    }
  }, [duration]);

  // ── Reservoir reset handler ────────────────────────────────────────────────
  const handleReservoirReset = useCallback((ml) => {
    const now = Date.now();
    setReservoirResetAt(now);
    setReservoirStartMl(ml);
    set(ref(db, 'settings/reservoirResetAt'), now);
    set(ref(db, 'settings/reservoirStartMl'), ml);
  }, []);

  const deviceOnline = !!(sensor && (Date.now() - sensor.updatedAt) < 120000);
  const inCooldown = !!(cooldownEndsAt && cooldownEndsAt > Date.now());
  const last       = events[0];
  const visible    = events.slice(0, 20);

  return (
    <ThemeCtx.Provider value={{ C, s }}>
      <SafeAreaView style={s.root}>
        <StatusBar barStyle={C.statusBar} />

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>SMART HOME</Text>
            <Text style={s.title}>AuraSync</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <View style={s.headerRight}>
              <StatusDot connected={connected} />
              <Text style={s.headerStatus}>{connected ? 'App' : 'Offline'}</Text>
            </View>
            <View style={s.headerRight}>
              <StatusDot connected={deviceOnline} />
              <Text style={s.headerStatus}>{deviceOnline ? 'Device' : 'No Device'}</Text>
            </View>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          {/* Device card */}
          <View style={s.deviceCard}>
            <View style={s.cardTop}>
              <View>
                <Text style={s.deviceRoom}>Bathroom</Text>
                <Text style={s.deviceName}>Scent Diffuser</Text>
              </View>
              <View style={[s.badge, { backgroundColor: inCooldown ? C.orange + '20' : C.green + '20' }]}>
                <Text style={[s.badgeText, { color: inCooldown ? C.orange : C.green }]}>
                  {inCooldown ? 'Cooldown' : 'Active'}
                </Text>
              </View>
            </View>

            <SprayButton onPress={handleSpray} state={sprayState} inCooldown={inCooldown} />
            <CooldownBar cooldownEndsAt={cooldownEndsAt} />

            <Text style={s.lastSpray}>
              {last
                ? `Last spray ${relTime(last.unixMs)} · ${TRIGGER[last.trigger]?.label ?? last.trigger}`
                : 'No sprays recorded yet'}
            </Text>
          </View>

          {/* Sensor card */}
          <SensorCard sensor={sensor} />

          {/* Settings card */}
          <SettingsCard
            autoSpray={autoSpray}
            duration={duration}
            onAutoSprayChange={handleAutoSprayChange}
            onDurationChange={handleDurationChange}
          />

          {/* Usage card */}
          <UsageCard
            events={events}
            reservoirResetAt={reservoirResetAt}
            reservoirStartMl={reservoirStartMl}
            onReservoirReset={handleReservoirReset}
          />

          {/* Activity section */}
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

          <View style={{ height: 48 }} />
        </ScrollView>
      </SafeAreaView>
    </ThemeCtx.Provider>
  );
}
