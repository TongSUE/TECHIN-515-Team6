import { useEffect, useState } from 'react';
import {
  FlatList, SafeAreaView, StyleSheet, Text, View,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { ref, onValue } from 'firebase/database';
import { db } from './firebase';

const TRIGGER_ICONS  = { pir: '🚶', voice: '🎙️', app: '📱', voc: '💨' };
const TRIGGER_LABELS = { pir: 'Motion', voice: 'Voice', app: 'App', voc: 'VOC' };

function SprayCard({ item }) {
  const icon  = TRIGGER_ICONS[item.trigger]  ?? '❓';
  const label = TRIGGER_LABELS[item.trigger] ?? item.trigger;
  const date  = new Date(item.unixMs);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.cardBody}>
        <Text style={styles.trigger}>{label} spray</Text>
        <Text style={styles.time}>{dateStr} · {timeStr}</Text>
        <Text style={styles.duration}>{(item.duration_ms / 1000).toFixed(1)} s</Text>
      </View>
    </View>
  );
}

export default function App() {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const eventsRef   = ref(db, 'spray_events');
    const unsubscribe = onValue(eventsRef, (snapshot) => {
      const data = snapshot.val() ?? {};
      const list = Object.entries(data)
        .map(([id, ev]) => ({ id, ...ev }))
        .sort((a, b) => b.unixMs - a.unixMs);
      setEvents(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.header}>AuraSync</Text>
      <Text style={styles.subheader}>Spray History</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#0891b2" style={{ marginTop: 40 }} />
      ) : events.length === 0 ? (
        <Text style={styles.empty}>No spray events yet.</Text>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SprayCard item={item} />}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f0fdfa' },
  header:     { fontSize: 28, fontWeight: '700', color: '#0e7490', textAlign: 'center', marginTop: 16 },
  subheader:  { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 16 },
  empty:      { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    marginHorizontal: 16, marginVertical: 6,
    padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  icon:     { fontSize: 32, marginRight: 14 },
  cardBody: { flex: 1 },
  trigger:  { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  time:     { fontSize: 13, color: '#64748b', marginTop: 2 },
  duration: { fontSize: 12, color: '#0891b2', marginTop: 4, fontWeight: '500' },
});
