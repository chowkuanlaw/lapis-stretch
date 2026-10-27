export interface DayRecord { total: number; water: number; by: Record<string, number> }
export interface MobileState {
  lang: 'en' | 'ms'; kuih: string; collect: boolean; idx: number;
  history: Record<string, DayRecord>; interval: number; snooze: number;
  goal: number; waterGoal: number; workOn: boolean; workDays: number[];
  workStart: number; workEnd: number; lunchOn: boolean; lunchStart: number; lunchEnd: number;
  waterOn: boolean; waterEvery: number; ramadanOn: boolean; streakSaver: boolean;
  notificationsOn: boolean; nextDue: number; pauseUntil: number; onboarded: boolean;
}
export interface Reminder { kind: 'stretch' | 'water'; at: number }
export const Data: any;
export const I18N: any;
export const DEFAULTS: MobileState;
export function cleanState(raw: unknown): MobileState;
export function todayRecord(state: MobileState, now?: Date): DayRecord;
export function nextExercise(state: MobileState, now?: Date): any;
export function recordStretch(state: MobileState, id: string, now?: Date): MobileState;
export function recordWater(state: MobileState, now?: Date): MobileState;
export function stats(state: MobileState, now?: Date): any;
export function availableKuih(state: MobileState, now?: Date): any[];
export function reminderPlan(state: MobileState, now?: Date, limit?: number): Reminder[];
