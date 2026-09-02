/**
 * prayerCalendars.ts
 * Printed-timetable prayer times, as an alternative to computing them.
 *
 * Most masjids are happy with the calculated times, but a congregation that has
 * followed a printed calendar for years wants the app to agree with the sheet on
 * the wall, to the minute -- an astronomical model that lands a minute off is
 * still "wrong" to them. So a masjid may opt into a calendar here instead, and
 * every row of the day comes from the table: fajr, sunrise, dhuhr, asr, maghrib
 * and isha alike. Iqamah is not printed on these sheets, so it stays what it has
 * always been: the masjid's own per-prayer wait added to the adhan.
 *
 * Coverage is deliberately narrow. Only the dates actually transcribed from a
 * sheet are here; asking for any other date returns null and the caller falls
 * back to calculating, so a masjid that leaves calendar mode on past the last
 * transcribed day keeps showing sane times rather than nothing.
 *
 * Rows are stored the way they are printed -- one row per pair of dates, times
 * in the order the sheet prints them -- so a new month can be checked against
 * the paper line by line. Times are 24-hour "HH:MM"; the sheets print 12-hour
 * with no am/pm marker, and converting once here beats guessing at read time.
 */

export type CalendarPrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export type CalendarDay = Record<CalendarPrayerKey, string>;

export interface CalendarZone {
  id: string;
  label: string;
}

export interface PrayerCalendar {
  id: string;
  label: string;
  /** Human-readable coverage, shown in Settings. */
  coverage: string;
  zones: CalendarZone[];
  /** zoneId -> "YYYY-MM-DD" -> times. */
  days: Record<string, Record<string, CalendarDay>>;
}

/** One printed row: the dates it covers, then fajr/sunrise/dhuhr/asr/maghrib/isha. */
type Row = [days: number[], string, string, string, string, string, string];

const both = (from: number, to: number): number[] => [from, to];

const expand = (year: number, month: number, rows: Row[]): Record<string, CalendarDay> => {
  const out: Record<string, CalendarDay> = {};
  const mm = String(month).padStart(2, '0');
  for (const [days, fajr, sunrise, dhuhr, asr, maghrib, isha] of rows) {
    for (const day of days) {
      out[`${year}-${mm}-${String(day).padStart(2, '0')}`] = {
        fajr,
        sunrise,
        dhuhr,
        asr,
        maghrib,
        isha,
      };
    }
  }
  return out;
};

// -- Kerala Salafi calendar, September 2026 ---------------------
// Transcribed from the printed sheet; each entry below is one printed line.

const KASARGOD_SEP_2026: Row[] = [
  [both(1, 2), '05:08', '06:19', '12:31', '15:42', '18:41', '19:53'],
  [both(3, 4), '05:09', '06:19', '12:30', '15:42', '18:40', '19:51'],
  [both(5, 6), '05:09', '06:19', '12:29', '15:42', '18:39', '19:50'],
  [both(7, 8), '05:09', '06:19', '12:29', '15:42', '18:37', '19:48'],
  [both(9, 10), '05:09', '06:19', '12:28', '15:42', '18:36', '19:47'],
  [both(11, 12), '05:09', '06:19', '12:28', '15:42', '18:34', '19:45'],
  [both(13, 14), '05:09', '06:19', '12:27', '15:42', '18:33', '19:44'],
  [both(15, 16), '05:09', '06:19', '12:26', '15:42', '18:32', '19:42'],
  [both(17, 18), '05:09', '06:19', '12:25', '15:42', '18:30', '19:41'],
  [both(19, 20), '05:09', '06:19', '12:24', '15:41', '18:29', '19:39'],
  [both(21, 22), '05:09', '06:19', '12:24', '15:41', '18:27', '19:38'],
  [both(23, 24), '05:09', '06:19', '12:23', '15:41', '18:26', '19:36'],
  [both(25, 26), '05:09', '06:19', '12:22', '15:41', '18:25', '19:35'],
  [both(27, 28), '05:09', '06:19', '12:22', '15:41', '18:23', '19:34'],
  [both(29, 30), '05:09', '06:19', '12:21', '15:40', '18:22', '19:32'],
];

const KOZHIKODE_SEP_2026: Row[] = [
  [both(1, 2), '05:06', '06:16', '12:28', '15:36', '18:37', '19:49'],
  [both(3, 4), '05:07', '06:16', '12:27', '15:37', '18:36', '19:47'],
  [both(5, 6), '05:07', '06:16', '12:27', '15:37', '18:35', '19:46'],
  [both(7, 8), '05:07', '06:16', '12:26', '15:37', '18:34', '19:44'],
  [both(9, 10), '05:07', '06:16', '12:26', '15:37', '18:33', '19:43'],
  [both(11, 12), '05:07', '06:16', '12:25', '15:37', '18:31', '19:41'],
  [both(13, 14), '05:07', '06:16', '12:24', '15:37', '18:30', '19:40'],
  [both(15, 16), '05:07', '06:16', '12:24', '15:37', '18:29', '19:39'],
  [both(17, 18), '05:07', '06:16', '12:22', '15:37', '18:27', '19:37'],
  [both(19, 20), '05:07', '06:16', '12:21', '15:37', '18:26', '19:36'],
  [both(21, 22), '05:07', '06:16', '12:21', '15:37', '18:24', '19:34'],
  [both(23, 24), '05:07', '06:16', '12:20', '15:37', '18:23', '19:33'],
  [both(25, 26), '05:07', '06:15', '12:19', '15:37', '18:22', '19:32'],
  [both(27, 28), '05:07', '06:15', '12:19', '15:37', '18:22', '19:30'],
  [both(29, 30), '05:06', '06:15', '12:18', '15:36', '18:19', '19:29'],
];

const KOCHI_SEP_2026: Row[] = [
  [both(1, 2), '05:06', '06:15', '12:26', '15:32', '18:35', '19:46'],
  [both(3, 4), '05:06', '06:15', '12:25', '15:32', '18:34', '19:44'],
  [both(5, 6), '05:06', '06:15', '12:24', '15:33', '18:32', '19:43'],
  [both(7, 8), '05:06', '06:15', '12:24', '15:33', '18:32', '19:43'],
  [both(9, 10), '05:06', '06:15', '12:23', '15:33', '18:30', '19:40'],
  [both(11, 12), '05:06', '06:15', '12:22', '15:33', '18:29', '19:39'],
  [both(13, 14), '05:05', '06:15', '12:22', '15:34', '18:28', '19:38'],
  [both(15, 16), '05:05', '06:14', '12:21', '15:34', '18:27', '19:37'],
  [both(17, 18), '05:05', '06:14', '12:20', '15:34', '18:26', '19:36'],
  [both(19, 20), '05:05', '06:14', '12:20', '15:34', '18:24', '19:34'],
  [both(21, 22), '05:05', '06:14', '12:19', '15:34', '18:23', '19:33'],
  [both(23, 24), '05:05', '06:14', '12:18', '15:34', '18:21', '19:31'],
  [both(25, 26), '05:05', '06:13', '12:17', '15:34', '18:19', '19:29'],
  [both(27, 28), '05:05', '06:13', '12:17', '15:34', '18:18', '19:28'],
  [both(29, 30), '05:05', '06:13', '12:16', '15:34', '18:17', '19:27'],
];

const THIRUVANANTHAPURAM_SEP_2026: Row[] = [
  [both(1, 2), '05:04', '06:13', '12:23', '15:26', '18:31', '19:41'],
  [both(3, 4), '05:04', '06:13', '12:22', '15:27', '18:30', '19:40'],
  [both(5, 6), '05:04', '06:13', '12:22', '15:27', '18:29', '19:39'],
  [both(7, 8), '05:04', '06:13', '12:21', '15:27', '18:28', '19:38'],
  [both(9, 10), '05:04', '06:13', '12:20', '15:28', '18:26', '19:36'],
  [both(11, 12), '05:04', '06:12', '12:19', '15:28', '18:25', '19:35'],
  [both(13, 14), '05:03', '06:12', '12:19', '15:28', '18:24', '19:34'],
  [both(15, 16), '05:03', '06:12', '12:18', '15:28', '18:23', '19:33'],
  [both(17, 18), '05:03', '06:11', '12:17', '15:29', '18:22', '19:31'],
  [both(19, 20), '05:03', '06:11', '12:17', '15:29', '18:20', '19:30'],
  [both(21, 22), '05:03', '06:11', '12:16', '15:29', '18:19', '19:29'],
  [both(23, 24), '05:03', '06:11', '12:15', '15:29', '18:18', '19:28'],
  [both(25, 26), '05:02', '06:11', '12:14', '15:29', '18:17', '19:27'],
  [both(27, 28), '05:02', '06:10', '12:14', '15:29', '18:16', '19:25'],
  [both(29, 30), '05:02', '06:10', '12:13', '15:29', '18:15', '19:24'],
];

export const KERALA_SALAFI: PrayerCalendar = {
  id: 'kerala_salafi',
  label: 'Kerala Salafi Calendar',
  coverage: '1-30 September 2026',
  zones: [
    { id: 'kasargod', label: 'Kasargod' },
    { id: 'kozhikode', label: 'Kozhikode' },
    { id: 'kochi', label: 'Kochi' },
    { id: 'thiruvananthapuram', label: 'Thiruvananthapuram' },
  ],
  days: {
    kasargod: expand(2026, 9, KASARGOD_SEP_2026),
    kozhikode: expand(2026, 9, KOZHIKODE_SEP_2026),
    kochi: expand(2026, 9, KOCHI_SEP_2026),
    thiruvananthapuram: expand(2026, 9, THIRUVANANTHAPURAM_SEP_2026),
  },
};

export const PRAYER_CALENDARS: PrayerCalendar[] = [KERALA_SALAFI];

export const findCalendar = (id: string): PrayerCalendar | null =>
  PRAYER_CALENDARS.find((c) => c.id === id) ?? null;

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The printed times for [date], or null if this calendar/zone does not cover it. */
export function lookupCalendarDay(
  calendarId: string,
  zoneId: string,
  date: Date,
): CalendarDay | null {
  const calendar = findCalendar(calendarId);
  if (!calendar) return null;
  return calendar.days[zoneId]?.[dateKey(date)] ?? null;
}

export interface CalendarRow {
  /** "YYYY-MM-DD". */
  date: string;
  times: CalendarDay;
}

/**
 * Every covered day for one zone, in date order -- for the Settings table a
 * masjid checks against its printed sheet before trusting the mode.
 */
export function calendarRows(calendarId: string, zoneId: string): CalendarRow[] {
  const days = findCalendar(calendarId)?.days[zoneId];
  if (!days) return [];
  return Object.keys(days)
    .sort()
    .map((date) => ({ date, times: days[date] }));
}

/**
 * Back to the 12-hour "3:42" the sheets print. The table exists to be compared
 * against paper, so it should read the way the paper does -- am/pm markers the
 * sheet does not have would only make the two harder to line up.
 */
export function asPrinted(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  const hour = parseInt(h, 10) % 12;
  return `${hour === 0 ? 12 : hour}:${m}`;
}

/** Whether [date] is inside a calendar's coverage -- for the Settings notice. */
export const calendarCovers = (calendarId: string, zoneId: string, date: Date): boolean =>
  lookupCalendarDay(calendarId, zoneId, date) !== null;
