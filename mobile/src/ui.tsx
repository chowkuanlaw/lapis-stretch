import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Image, Platform, Pressable, StyleProp, StyleSheet, Text, useColorScheme, useWindowDimensions, View, ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Data } from './core';
import { mascots } from './mascots';

const colors = {
  ios: {
    light: { bg: '#F8F7F4', ink: '#211C1B', muted: '#68615F', primary: '#B82C50', onPrimary: '#FFFFFF', primaryContainer: '#FBE8ED', card: '#FFFFFF', line: '#EAE5E2', secondary: '#3E7458', nav: 'rgba(255,255,255,0.88)' },
    dark: { bg: '#171515', ink: '#F8F2F1', muted: '#C4B9B6', primary: '#FF88A4', onPrimary: '#4B1020', primaryContainer: '#49232F', card: '#262222', line: '#433A3A', secondary: '#9ED8B1', nav: 'rgba(39,34,34,0.92)' }
  },
  android: {
    light: { bg: '#FCF8F8', ink: '#251A1D', muted: '#75666B', primary: '#9D3651', onPrimary: '#FFFFFF', primaryContainer: '#FFD9E2', card: '#FFF8F9', line: '#E8DDE0', secondary: '#536C56', nav: '#F7EFF1' },
    dark: { bg: '#1C1719', ink: '#F3E7E9', muted: '#D1BDC3', primary: '#FFB0C1', onPrimary: '#5C1027', primaryContainer: '#79334A', card: '#281F23', line: '#504047', secondary: '#B6D2B5', nav: '#292125' }
  }
};

type Palette = typeof colors.ios.light;
type Ui = { palette: Palette; styles: ReturnType<typeof makeStyles>; isIos: boolean; dark: boolean; glass: boolean; reduceTransparency: boolean };
const UiContext = createContext<Ui | null>(null);
export function useUi(): Ui {
  const ui = useContext(UiContext);
  if (!ui) throw new Error('UiProvider is required');
  return ui;
}
export function UiProvider({ children }: { children: React.ReactNode }) {
  const isIos = Platform.OS === 'ios' || (Platform.OS === 'web' && process.env.EXPO_PUBLIC_DESIGN_PREVIEW === 'ios');
  const dark = useColorScheme() === 'dark';
  const palette = colors[isIos ? 'ios' : 'android'][dark ? 'dark' : 'light'];
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    if (typeof AccessibilityInfo.isReduceTransparencyEnabled === 'function')
      AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency).catch(() => {});
    if (typeof AccessibilityInfo.addEventListener !== 'function') return;
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => subscription?.remove();
  }, []);
  let glass = false;
  if (Platform.OS === 'ios' && !reduceTransparency) {
    try { glass = isGlassEffectAPIAvailable() && isLiquidGlassAvailable(); } catch { glass = false; }
  }
  const styles = useMemo(() => makeStyles(palette, isIos), [palette, isIos]);
  return <UiContext.Provider value={{ palette, styles, isIos, dark, glass, reduceTransparency }}>{children}</UiContext.Provider>;
}

function GlassSurface({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { palette, dark, glass, reduceTransparency } = useUi();
  if (glass) return <GlassView glassEffectStyle="regular" isInteractive colorScheme={dark ? 'dark' : 'light'} style={style}>{children}</GlassView>;
  return <View style={[{ backgroundColor: reduceTransparency ? palette.card : palette.nav }, style]}>{children}</View>;
}

export function Button({ title, onPress, quiet = false }: { title: string; onPress: () => void; quiet?: boolean }) {
  const { isIos, palette, styles } = useUi();
  const label = <Text style={[styles.buttonText, quiet && styles.quietText]}>{title}</Text>;
  const button = <Pressable accessibilityRole="button" onPress={onPress} android_ripple={{ color: palette.primaryContainer }} style={[styles.button, quiet && styles.quietButton]}>{label}</Pressable>;
  return quiet && isIos ? <GlassSurface style={styles.quietGlass}>{button}</GlassSurface> : button;
}
export function Chip({ title, selected, onPress, disabled = false }: { title: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  const { palette, styles } = useUi();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} android_ripple={{ color: palette.primaryContainer }} style={[styles.chip, selected && styles.chipSelected, disabled && styles.disabled]}><Text style={[styles.chipText, selected && styles.selectedText]}>{title}</Text></Pressable>;
}
export function Card({ children }: { children: React.ReactNode }) { const { styles } = useUi(); return <View style={styles.card}>{children}</View>; }
export function Art({ skin, pose = 'idle', size = 120 }: { skin: string; pose?: string; size?: number }) {
  return <Image source={mascots[`${skin}-${pose}`] || mascots['lapis-idle']} resizeMode="contain" style={{ width: size, height: size * 1.22 }} accessibilityLabel={Data.KUIH_BY[skin]?.name || 'Kuih Lapis'} />;
}

type Tab = 'today' | 'stretches' | 'progress' | 'kuih' | 'settings';
const symbols = {
  today: { ios: 'house.fill', android: 'home', web: 'home' },
  stretches: { ios: 'figure.walk', android: 'fitness_center', web: 'fitness_center' },
  progress: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  kuih: { ios: 'heart.fill', android: 'bakery_dining', web: 'bakery_dining' },
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' }
} as const;
export function PlatformTabBar({ tab, titles, onChange, bottomInset }: { tab: Tab; titles: Record<Tab, string>; onChange: (tab: Tab) => void; bottomInset: number }) {
  const { palette, styles, isIos } = useUi();
  const { fontScale } = useWindowDimensions();
  const items = (Object.keys(symbols) as Tab[]).map(name => {
    const selected = tab === name;
    return <Pressable key={name} accessibilityRole="tab" accessibilityLabel={titles[name]} accessibilityState={{ selected }} onPress={() => { if (name !== tab) { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); onChange(name); } }} android_ripple={{ color: palette.primaryContainer, borderless: true }} style={styles.tab}>
      <View style={[styles.tabIconWrap, !isIos && selected && styles.tabIndicator]}><SymbolView name={symbols[name]} size={isIos ? 22 : 24} tintColor={selected ? palette.primary : palette.muted} fallback={<Text style={styles.tabFallback}>{titles[name].slice(0, 1)}</Text>} /></View>
      {fontScale <= 1.4 && <Text numberOfLines={1} style={[styles.tabText, selected && styles.activeTab]}>{titles[name]}</Text>}
    </Pressable>;
  });
  if (isIos) return <View pointerEvents="box-none" style={[styles.iosTabDock, { bottom: Math.max(bottomInset, 10) + 6 }]}><GlassSurface style={styles.iosTabBar}>{items}</GlassSurface></View>;
  return <View style={[styles.androidNav, { paddingBottom: Math.max(bottomInset, 8) }]}>{items}</View>;
}

function makeStyles(p: Palette, ios: boolean) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.bg },
  header: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 22, paddingBottom: ios ? 9 : 13, gap: ios ? 2 : 3 },
  brand: { color: p.primary, fontSize: ios ? 14 : 16, fontWeight: '800', letterSpacing: ios ? 0.3 : 0.1 },
  headerSub: { color: p.ink, fontSize: ios ? 34 : 27, fontWeight: ios ? '800' : '700', letterSpacing: ios ? -0.8 : 0 },
  scroll: { flex: 1 }, content: { paddingHorizontal: 16, paddingTop: 9, gap: 14, width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: { backgroundColor: p.card, borderRadius: ios ? 21 : 24, borderWidth: ios ? StyleSheet.hairlineWidth : 1, borderColor: p.line, padding: 18, gap: 12 },
  title: { color: p.ink, fontSize: 23, fontWeight: '800' }, section: { color: p.ink, fontSize: 18, fontWeight: '800' },
  overline: { color: p.secondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.9 },
  body: { color: p.muted, fontSize: 15, lineHeight: 22 }, hint: { color: p.muted, fontSize: 13, lineHeight: 19 },
  button: { backgroundColor: p.primary, borderRadius: ios ? 14 : 100, paddingHorizontal: 16, minHeight: 50, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  quietButton: { backgroundColor: ios ? 'transparent' : p.primaryContainer }, quietGlass: { borderRadius: 14, overflow: 'hidden' },
  buttonText: { color: p.onPrimary, fontSize: 16, fontWeight: '700' }, quietText: { color: p.primary },
  chip: { borderWidth: 1, borderColor: p.line, borderRadius: ios ? 12 : 100, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', backgroundColor: p.card, overflow: 'hidden' },
  chipSelected: { borderColor: p.primary, backgroundColor: p.primaryContainer }, chipText: { fontSize: 14, fontWeight: '700', color: p.ink },
  selectedText: { color: p.primary }, disabled: { opacity: 0.45 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 }, heroText: { flex: 1, gap: 6 },
  halves: { flexDirection: 'row', gap: 12 }, half: { flex: 1, backgroundColor: p.card, borderRadius: ios ? 18 : 24, borderWidth: ios ? StyleSheet.hairlineWidth : 1, borderColor: p.line, padding: 16, gap: 6 },
  metric: { color: p.ink, fontSize: 32, fontWeight: '900' }, metricSmall: { fontSize: 14, color: p.muted, fontWeight: '600' },
  countdown: { color: p.primary, fontSize: 31, fontWeight: '900', textAlign: 'center' }, step: { color: p.ink, fontSize: 15, lineHeight: 23 },
  list: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: p.card, borderRadius: ios ? 16 : 22, padding: 12, borderWidth: ios ? StyleSheet.hairlineWidth : 1, borderColor: p.line, minHeight: 88 },
  listText: { flex: 1, gap: 3 }, listTitle: { color: p.ink, fontSize: 17, fontWeight: '800' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, barLabel: { width: 32, color: p.muted, fontWeight: '700' },
  barTrack: { height: 14, backgroundColor: p.primaryContainer, borderRadius: 8, flex: 1, overflow: 'hidden' },
  barFill: { height: 14, backgroundColor: p.primary, borderRadius: 8 }, barValue: { width: 26, textAlign: 'right', color: p.ink, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, kuihCard: { width: '47%', backgroundColor: p.card, borderWidth: ios ? StyleSheet.hairlineWidth : 1, borderColor: p.line, borderRadius: ios ? 16 : 22, padding: 10, alignItems: 'center', gap: 5, minHeight: 150 },
  kuihName: { color: p.ink, fontWeight: '800', textAlign: 'center' }, settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 48 },
  settingLabel: { color: p.ink, fontSize: 15, fontWeight: '700', flex: 1 }, time: { minWidth: 82, textAlign: 'center', color: p.ink, fontWeight: '700' },
  notice: { backgroundColor: p.primaryContainer, paddingHorizontal: 18, paddingVertical: 10 }, noticeText: { color: p.primary, fontWeight: '700' },
  iosTabDock: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  iosTabBar: { width: '100%', maxWidth: 560, flexDirection: 'row', borderRadius: 30, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: p.line, paddingVertical: 5, paddingHorizontal: 4 },
  androidNav: { flexDirection: 'row', backgroundColor: p.nav, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.line },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 56, paddingHorizontal: 2, gap: 1 },
  tabIconWrap: { width: 62, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 100 },
  tabIndicator: { backgroundColor: p.primaryContainer }, tabFallback: { color: p.primary, fontWeight: '800' },
  tabText: { color: p.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' }, activeTab: { color: p.primary, fontWeight: '800' }
}); }
