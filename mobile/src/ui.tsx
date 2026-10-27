import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Data } from './core';
import { mascots } from './mascots';

export const palette = { bg: '#F7F5EC', ink: '#2A1F1A', muted: '#6C6A60', pink: '#C9184A', green: '#4E8263', pale: '#FCE8EB', card: '#FFFDF7', line: '#E8E2D8' };
export function Button({ title, onPress, quiet = false }: { title: string; onPress: () => void; quiet?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, quiet && styles.quietButton]}><Text style={[styles.buttonText, quiet && styles.quietText]}>{title}</Text></Pressable>;
}
export function Chip({ title, selected, onPress, disabled = false }: { title: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.chip, selected && styles.chipSelected, disabled && styles.disabled]}><Text style={[styles.chipText, selected && styles.selectedText]}>{title}</Text></Pressable>;
}
export function Card({ children }: { children: React.ReactNode }) { return <View style={styles.card}>{children}</View>; }
export function Art({ skin, pose = 'idle', size = 120 }: { skin: string; pose?: string; size?: number }) {
  return <Image source={mascots[`${skin}-${pose}`] || mascots['lapis-idle']} resizeMode="contain" style={{ width: size, height: size * 1.22 }} accessibilityLabel={Data.KUIH_BY[skin]?.name || 'Kuih Lapis'} />;
}
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg }, header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  brand: { color: palette.pink, fontSize: 29, fontWeight: '900' }, headerSub: { color: palette.ink, fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 }, content: { padding: 16, paddingBottom: 32, gap: 14 },
  card: { backgroundColor: palette.card, borderRadius: 20, borderWidth: 1, borderColor: palette.line, padding: 18, gap: 12 },
  title: { color: palette.ink, fontSize: 23, fontWeight: '800' }, section: { color: palette.ink, fontSize: 18, fontWeight: '800' },
  overline: { color: palette.green, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  body: { color: palette.muted, fontSize: 15, lineHeight: 22 }, hint: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  button: { backgroundColor: palette.pink, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' },
  quietButton: { backgroundColor: palette.pale }, buttonText: { color: 'white', fontSize: 16, fontWeight: '800' }, quietText: { color: palette.pink },
  chip: { borderWidth: 1, borderColor: palette.line, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: 'white' },
  chipSelected: { borderColor: palette.green, backgroundColor: '#E2F0E7' }, chipText: { fontSize: 14, fontWeight: '700', color: palette.ink },
  selectedText: { color: palette.green }, disabled: { opacity: 0.42 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 }, heroText: { flex: 1, gap: 6 },
  halves: { flexDirection: 'row', gap: 12 }, half: { flex: 1, backgroundColor: palette.card, borderRadius: 18, borderWidth: 1, borderColor: palette.line, padding: 16, gap: 6 },
  metric: { color: palette.ink, fontSize: 32, fontWeight: '900' }, metricSmall: { fontSize: 14, color: palette.muted, fontWeight: '600' },
  countdown: { color: palette.pink, fontSize: 31, fontWeight: '900', textAlign: 'center' }, step: { color: palette.ink, fontSize: 15, lineHeight: 23 },
  list: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: palette.line },
  listText: { flex: 1, gap: 3 }, listTitle: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, barLabel: { width: 32, color: palette.muted, fontWeight: '700' },
  barTrack: { height: 14, backgroundColor: palette.pale, borderRadius: 8, flex: 1, overflow: 'hidden' },
  barFill: { height: 14, backgroundColor: palette.pink, borderRadius: 8 }, barValue: { width: 26, textAlign: 'right', color: palette.ink, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, kuihCard: { width: '47%', backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, borderRadius: 16, padding: 10, alignItems: 'center', gap: 5 },
  kuihName: { color: palette.ink, fontWeight: '800', textAlign: 'center' }, settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  settingLabel: { color: palette.ink, fontSize: 15, fontWeight: '700', flex: 1 }, time: { minWidth: 82, textAlign: 'center', color: palette.ink, fontWeight: '700' },
  notice: { backgroundColor: palette.pale, paddingHorizontal: 18, paddingVertical: 10 }, noticeText: { color: palette.pink, fontWeight: '700' },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderColor: palette.line, backgroundColor: palette.card, paddingVertical: 8 },
  tab: { flex: 1, alignItems: 'center', paddingHorizontal: 2, paddingVertical: 5 }, tabText: { color: palette.muted, fontSize: 11, fontWeight: '700', textAlign: 'center' }, activeTab: { color: palette.pink }
});
