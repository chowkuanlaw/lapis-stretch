import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Core from './src/core';
import { copy } from './src/copy';
import { Art, Button, Card, Chip, PlatformTabBar, UiProvider, useUi } from './src/ui';
import { requestReminderPermission, syncReminders } from './src/reminders';

type Tab = 'today' | 'stretches' | 'progress' | 'kuih' | 'settings';
const KEY = 'lapis-mobile-v1';
let saveQueue = Promise.resolve();

export default function App() { return <SafeAreaProvider><UiProvider><LapisApp /></UiProvider></SafeAreaProvider>; }

function LapisApp() {
  const { palette, styles, isIos, dark } = useUi();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<Core.MobileState>(() => Core.cleanState(null));
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [chosen, setChosen] = useState<string | null>(null);
  const [session, setSession] = useState<{ id: string; endAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState('');
  const currentState = useRef(state);
  const finished = useRef(false);
  const w = copy[state.lang];
  currentState.current = state;

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY).then(value => {
      if (alive) setState(Core.cleanState(value ? JSON.parse(value) : null));
    }).catch(() => { if (alive) setNotice('Saved progress could not be read.'); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (loaded) {
      const value = JSON.stringify(state);
      saveQueue = saveQueue.catch(() => {}).then(() => AsyncStorage.setItem(KEY, value));
      saveQueue.catch(() => setNotice('Progress could not be saved.'));
    }
  }, [state, loaded]);

  const scheduleKey = JSON.stringify({
    lang: state.lang, interval: state.interval, waterEvery: state.waterEvery, waterOn: state.waterOn,
    workOn: state.workOn, workDays: state.workDays, workStart: state.workStart, workEnd: state.workEnd,
    lunchOn: state.lunchOn, lunchStart: state.lunchStart, lunchEnd: state.lunchEnd,
    ramadanOn: state.ramadanOn, notificationsOn: state.notificationsOn,
    pauseUntil: state.pauseUntil, nextDue: state.nextDue
  });
  useEffect(() => {
    if (loaded) syncReminders(currentState.current).catch(() => setNotice('Reminders could not be scheduled.'));
  }, [loaded, scheduleKey]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', status => {
      if (status === 'active') {
        setNow(Date.now());
        if (loaded) syncReminders(currentState.current).catch(() => setNotice('Reminders could not be refreshed.'));
      }
    });
    const tap = Notifications.addNotificationResponseReceivedListener(() => { setTab('today'); setNow(Date.now()); });
    return () => { sub.remove(); tap.remove(); };
  }, [loaded]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), session ? 1000 : 30_000); return () => clearInterval(timer); }, [session]);

  const update = useCallback((patch: Partial<Core.MobileState>) => setState(s => Core.cleanState({ ...s, ...patch })), []);
  const exercise = chosen ? Core.Data.BY[chosen] : Core.nextExercise(state, new Date(now));
  const today = Core.todayRecord(state, new Date(now));
  const stats = Core.stats(state, new Date(now));
  const available = Core.availableKuih(state, new Date(now));
  const availableIds = new Set(available.map((k: any) => k.id));
  const nextReminder = Core.reminderPlan(state, new Date(now)).find(e => e.kind === 'stretch');
  const current = session ? Core.Data.BY[session.id] : exercise;

  const complete = useCallback(() => {
    if (!session || finished.current) return;
    finished.current = true;
    setState(s => Core.recordStretch(s, session.id));
    setSession(null); setChosen(null); setNotice(w.done);
  }, [session, w.done]);
  useEffect(() => { if (session && now >= session.endAt) complete(); }, [session, now, complete]);
  const start = () => { finished.current = false; setSession({ id: exercise.id, endAt: Date.now() + exercise.secs * 1000 }); setNotice(''); };
  const enableNotifications = async () => {
    if (Platform.OS === 'web') { setNotice('Phone notifications need an iOS or Android device.'); return; }
    try {
      if (await requestReminderPermission()) update({ notificationsOn: true, onboarded: true });
      else Alert.alert(w.reminders, w.permission, [
        { text: w.later, style: 'cancel' }, { text: w.openSettings, onPress: () => Linking.openSettings() }
      ]);
    } catch { setNotice('Notification permission could not be requested.'); }
  };
  const resetHistory = () => Alert.alert(w.reset, w.resetAsk, [
    { text: w.cancel, style: 'cancel' },
    { text: w.reset, style: 'destructive', onPress: () => { update({ history: {}, idx: 0 }); setNotice(w.reset); } }
  ]);
  const tabTitle: Record<Tab, string> = { today: w.today, stretches: w.stretches, progress: w.progress, kuih: w.kuih, settings: w.settings };
  const tx = (item: any, field: string) => Core.I18N.tx(state.lang, item, field);
  const time = (minutes: number) => new Date(2026, 0, 1, 0, minutes).toLocaleTimeString(Core.I18N.locale(state.lang), { hour: 'numeric', minute: '2-digit' });
  const select = (values: number[], value: number, key: keyof Core.MobileState, suffix = '') =>
    <View style={styles.row}>{values.map(n => <Chip key={n} title={`${n}${suffix}`} selected={n === value} onPress={() => update({ [key]: n })} />)}</View>;
  const changeTime = (key: 'workStart' | 'workEnd' | 'lunchStart' | 'lunchEnd', step: number) => {
    const next = state[key] + step;
    const other = key === 'workStart' ? state.workEnd : key === 'workEnd' ? state.workStart : key === 'lunchStart' ? state.lunchEnd : state.lunchStart;
    if (next < 0 || next > 1440) return;
    if ((key.endsWith('Start') && next >= other) || (key.endsWith('End') && next <= other)) return;
    update({ [key]: next });
  };
  const timeControl = (label: string, key: 'workStart' | 'workEnd' | 'lunchStart' | 'lunchEnd') =>
    <View style={styles.settingRow} key={key}><Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.row}><Chip title="−" selected={false} onPress={() => changeTime(key, -30)} />
        <Text style={styles.time}>{time(state[key])}</Text>
        <Chip title="+" selected={false} onPress={() => changeTime(key, 30)} /></View>
    </View>;

  if (!loaded) return <View style={[styles.safe, { paddingTop: insets.top + 12 }]}><Text style={styles.brand}>Lapis</Text></View>;
  return <View style={styles.safe}>
    <StatusBar style={dark ? 'light' : 'dark'} />
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}><Text style={styles.brand}>Lapis</Text><Text style={styles.headerSub}>{tabTitle[tab]}</Text></View>
    {!!notice && <Pressable onPress={() => setNotice('')} style={styles.notice}><Text style={styles.noticeText}>{notice}  ×</Text></Pressable>}
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: isIos ? Math.max(insets.bottom, 10) + 105 : 30 }]}>
      {tab === 'today' && <>
        {!state.onboarded && <Card><Text style={styles.title}>{w.intro}</Text><Text style={styles.body}>{w.introText}</Text>
          <View style={styles.row}><Chip title="English" selected={state.lang === 'en'} onPress={() => update({ lang: 'en' })} /><Chip title="Bahasa Melayu" selected={state.lang === 'ms'} onPress={() => update({ lang: 'ms' })} /></View>
          <Button title={w.enable} onPress={enableNotifications} /><Button title={w.later} onPress={() => update({ onboarded: true })} quiet /></Card>}
        <Card><View style={styles.hero}><Art skin={state.kuih} pose={current.pose} size={145} /><View style={styles.heroText}><Text style={styles.overline}>{w.next}</Text><Text style={styles.title}>{tx(current, 'name')}</Text><Text style={styles.body}>{tx(current, 'dose')}</Text></View></View>
          {session ? <><Text style={styles.countdown}>{Math.max(0, Math.ceil((session.endAt - now) / 1000))} {w.seconds}</Text>
            <Text style={styles.body}>{tx(current, 'cue')}</Text>{current.sides && <Text style={styles.body}>{w.switchSides}</Text>}
            <Button title={w.finish} onPress={complete} /><Button title={w.cancel} quiet onPress={() => setSession(null)} /></> : <>
            <Text style={styles.body}>{tx(current, 'cue')}</Text><Button title={w.start} onPress={start} />
            <View style={styles.row}><Chip title={`${w.snooze} ${state.snooze}m`} selected={false} onPress={() => update({ pauseUntil: Date.now() + state.snooze * 60_000 })} />
              <Chip title={state.pauseUntil > now ? w.resume : w.pause} selected={state.pauseUntil > now} onPress={() => update({ pauseUntil: state.pauseUntil > now ? 0 : Date.now() + 30 * 60_000 })} /></View>
            <Text style={styles.hint}>{w.due}: {state.notificationsOn ? nextReminder ? new Date(nextReminder.at).toLocaleString(Core.I18N.locale(state.lang), { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : w.resting : w.enable}</Text></>}
        </Card>
        <View style={styles.halves}><View style={styles.half}><Text style={styles.overline}>{w.dailyGoal}</Text><Text style={styles.metric}>{today.total}<Text style={styles.metricSmall}> / {state.goal}</Text></Text></View>
          <View style={styles.half}><Text style={styles.overline}>{w.water}</Text><Text style={styles.metric}>{today.water}<Text style={styles.metricSmall}> / {state.waterGoal}</Text></Text></View></View>
        <Button title={w.drink} quiet onPress={() => setState(s => Core.recordWater(s))} />
        <Card><Text style={styles.section}>{w.how}</Text>{tx(current, 'steps').map((step: string, i: number) => <Text key={i} style={styles.step}>{i + 1}. {step}</Text>)}</Card>
        <Card><Text style={styles.section}>{w.nextUp}</Text><View style={styles.row}>{Array.from({ length: 3 }, (_, i) => Core.Data.CYCLE[(state.idx + i + 1) % Core.Data.CYCLE.length]).map((id: string, i: number) =>
          <Chip key={`${id}-${i}`} title={tx(Core.Data.BY[id], 'name')} selected={false} onPress={() => setChosen(id)} />)}</View></Card>
      </>}
      {tab === 'stretches' && Core.Data.EX.map((item: any) => <Pressable key={item.id} accessibilityRole="button" onPress={() => { setChosen(item.id); setTab('today'); }} style={styles.list}>
        <Art skin={state.kuih} pose={item.pose} size={68} /><View style={styles.listText}><Text style={styles.listTitle}>{tx(item, 'name')}</Text><Text style={styles.body}>{tx(item, 'dose')}</Text><Text style={styles.hint}>{tx(item, 'cue')}</Text></View></Pressable>)}
      {tab === 'progress' && <><View style={styles.halves}><View style={styles.half}><Text style={styles.overline}>{w.total}</Text><Text style={styles.metric}>{stats.total}</Text></View>
        <View style={styles.half}><Text style={styles.overline}>{w.streak}</Text><Text style={styles.metric}>{stats.streak}<Text style={styles.metricSmall}> {w.days}</Text></Text></View></View>
        <Card><Text style={styles.section}>{w.week}</Text>{[6, 5, 4, 3, 2, 1, 0].map(offset => {
          const day = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate() - offset);
          const count = state.history[Core.Data.dayKey(day)]?.total || 0;
          return <View key={offset} style={styles.barRow}><Text style={styles.barLabel}>{day.toLocaleDateString(Core.I18N.locale(state.lang), { weekday: 'short' })}</Text>
            <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.min(100, (count / state.goal) * 100)}%` }]} /></View><Text style={styles.barValue}>{count}</Text></View>;
        })}</Card><Card><Text style={styles.section}>{w.water}</Text><Text style={styles.metric}>{today.water}<Text style={styles.metricSmall}> / {state.waterGoal}</Text></Text></Card></>}
      {tab === 'kuih' && <><Card><View style={styles.hero}><Art skin={state.kuih} size={100} /><View style={styles.heroText}><Text style={styles.overline}>{w.collected} {available.length} / {Core.Data.KUIH.length}</Text>
        <Text style={styles.title}>{Core.Data.KUIH_BY[state.kuih].name}</Text><Text style={styles.body}>{tx(Core.Data.KUIH_BY[state.kuih], 'note')}</Text></View></View></Card>
        {Core.Data.KUIH_GROUPS.map((group: any) => <View key={group.id}><Text style={styles.section}>{tx(group, 'title')}</Text><View style={styles.grid}>
          {Core.Data.KUIH.filter((k: any) => k.group === group.id).map((k: any) => {
            const unlocked = availableIds.has(k.id), rule = Core.Data.RULE_BY[k.id];
            const p = rule ? Core.Data.ruleProgress(rule, stats) : null;
            return <Pressable key={k.id} accessibilityRole="button" accessibilityState={{ disabled: !unlocked, selected: state.kuih === k.id }} disabled={!unlocked}
              onPress={() => update({ kuih: k.id })} style={[styles.kuihCard, !unlocked && styles.disabled]}><Art skin={k.id} size={84} /><Text style={styles.kuihName}>{k.name}</Text>
              <Text style={styles.hint}>{unlocked ? state.kuih === k.id ? w.chosen : w.choose :
                `${Core.I18N.t(state.lang, `rule.${rule.type}`, { n: rule.n })} · ${p?.have || 0}/${p?.need || 0}`}</Text></Pressable>;
          })}</View></View>)}</>}
      {tab === 'settings' && <>
        <Card><Text style={styles.section}>{w.language}</Text><View style={styles.row}><Chip title="English" selected={state.lang === 'en'} onPress={() => update({ lang: 'en' })} /><Chip title="Bahasa Melayu" selected={state.lang === 'ms'} onPress={() => update({ lang: 'ms' })} /></View></Card>
        <Card><View style={styles.settingRow}><Text style={styles.section}>{w.reminders}</Text><Switch value={state.notificationsOn} onValueChange={v => v ? enableNotifications() : update({ notificationsOn: false })} trackColor={{ true: palette.primary }} /></View><Text style={styles.hint}>{w.refresh}</Text></Card>
        <Card><Text style={styles.section}>{w.interval}</Text>{select([15, 20, 30, 45, 60], state.interval, 'interval', 'm')}
          <Text style={styles.section}>{w.goal}</Text>{select([4, 6, 8, 10, 12], state.goal, 'goal')}</Card>
        <Card><View style={styles.settingRow}><Text style={styles.section}>{w.water}</Text><Switch value={state.waterOn} onValueChange={waterOn => update({ waterOn })} trackColor={{ true: palette.primary }} /></View>
          {state.waterOn && <><Text style={styles.settingLabel}>{w.waterEvery}</Text>{select([30, 45, 60, 90, 120], state.waterEvery, 'waterEvery', 'm')}
            <Text style={styles.settingLabel}>{w.waterGoal}</Text>{select([4, 6, 8, 10, 12], state.waterGoal, 'waterGoal')}</>}</Card>
        <Card><View style={styles.settingRow}><Text style={styles.section}>{w.workOn}</Text><Switch value={state.workOn} onValueChange={workOn => update({ workOn })} trackColor={{ true: palette.primary }} /></View>
          {state.workOn && <><Text style={styles.settingLabel}>{w.workdays}</Text><View style={styles.row}>{[1, 2, 3, 4, 5, 6, 0].map(day => <Chip key={day} title={w.weekdays[day]}
            selected={state.workDays.includes(day)} onPress={() => { const days = state.workDays.includes(day) ? state.workDays.filter(d => d !== day) : [...state.workDays, day].sort(); if (days.length) update({ workDays: days }); }} />)}</View>
            {timeControl(w.workStart, 'workStart')}{timeControl(w.workEnd, 'workEnd')}
            <View style={styles.settingRow}><Text style={styles.settingLabel}>{w.lunch}</Text><Switch value={state.lunchOn} onValueChange={lunchOn => update({ lunchOn })} trackColor={{ true: palette.primary }} /></View>
            {state.lunchOn && <>{timeControl(w.lunchStart, 'lunchStart')}{timeControl(w.lunchEnd, 'lunchEnd')}</>}</>}</Card>
        <Card><View style={styles.settingRow}><Text style={styles.settingLabel}>{w.collect}</Text><Switch value={state.collect} onValueChange={collect => update({ collect })} trackColor={{ true: palette.primary }} /></View>
          <View style={styles.settingRow}><Text style={styles.settingLabel}>{w.ramadan}</Text><Switch value={state.ramadanOn} onValueChange={ramadanOn => update({ ramadanOn })} trackColor={{ true: palette.primary }} /></View></Card>
        <Button title={w.reset} quiet onPress={resetHistory} />
      </>}
    </ScrollView>
    <PlatformTabBar tab={tab} titles={tabTitle} onChange={setTab} bottomInset={insets.bottom} />
  </View>;
}
