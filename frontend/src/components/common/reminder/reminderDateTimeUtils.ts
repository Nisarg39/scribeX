/**
 * ScribeX Reminder Date/Time Formatting & Parsing Utilities
 */

export function formatDisplayDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = d.getDate();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day} ${month}, ${hours}:${minutes} ${period}`;
  } catch {
    return isoString;
  }
}

export function formatRemainingDuration(isoString: string): { text: string; isPast: boolean } {
  try {
    const target = new Date(isoString).getTime();
    if (isNaN(target)) return { text: '', isPast: false };
    const now = Date.now();
    const diffMs = target - now;

    if (diffMs <= 0) {
      const pastSec = Math.floor(-diffMs / 1000);
      if (pastSec < 60) return { text: 'Triggered just now', isPast: true };
      const pastMin = Math.floor(pastSec / 60);
      if (pastMin < 60) return { text: `Triggered ${pastMin}m ago`, isPast: true };
      const pastHr = Math.floor(pastMin / 60);
      return { text: `Triggered ${pastHr}h ago`, isPast: true };
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return { text: `Triggers in ${days}d ${hours}h`, isPast: false };
    }
    if (hours > 0) {
      return { text: `Triggers in ${hours}h ${minutes}m`, isPast: false };
    }
    if (minutes > 0) {
      return { text: `Triggers in ${minutes}m`, isPast: false };
    }
    return { text: 'Triggers in < 1m', isPast: false };
  } catch {
    return { text: '', isPast: false };
  }
}

export function getTodayString(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getDefaultTimeString(): string {
  const now = new Date();
  const plus5Min = new Date(now.getTime() + 5 * 60 * 1000);
  const hh = String(plus5Min.getHours()).padStart(2, '0');
  const mm = String(plus5Min.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function parse24to12(time24: string): { hour12: number; minute: number; period: 'AM' | 'PM' } {
  const [hStr, mStr] = (time24 || '12:00').split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) h = 12;
  let m = parseInt(mStr, 10);
  if (isNaN(m)) m = 0;
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute: m, period };
}

export function format12to24(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let h = hour12 % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatDate(text: string, prevVal: string): string {
  if (prevVal && prevVal.endsWith('-') && text === prevVal.slice(0, -1)) {
    return text.slice(0, -1);
  }
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 4) return digits;
  const yearStr = digits.slice(0, 4);
  if (digits.length <= 6) {
    const mDigits = digits.slice(4);
    if (mDigits.length === 2) {
      let m = parseInt(mDigits, 10);
      if (m > 12) m = 12;
      if (m === 0) m = 1;
      return `${yearStr}-${String(m).padStart(2, '0')}`;
    }
    return `${yearStr}-${mDigits}`;
  }
  let m = parseInt(digits.slice(4, 6), 10);
  if (m > 12) m = 12;
  if (m === 0) m = 1;
  const monthStr = String(m).padStart(2, '0');
  const dDigits = digits.slice(6);
  if (dDigits.length === 2) {
    let d = parseInt(dDigits, 10);
    if (d > 31) d = 31;
    if (d === 0) d = 1;
    return `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
  }
  return `${yearStr}-${monthStr}-${dDigits}`;
}

export function formatTime12(text: string, prevVal: string, currentPeriod: 'AM' | 'PM'): { formatted: string; period: 'AM' | 'PM' } {
  let period = currentPeriod;
  if (/a/i.test(text)) period = 'AM';
  if (/p/i.test(text)) period = 'PM';

  if (prevVal && prevVal.endsWith(':') && text === prevVal.slice(0, -1)) {
    return { formatted: text.slice(0, -1), period };
  }

  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (!digits) return { formatted: '', period };
  if (digits.length === 1) return { formatted: digits, period };

  let h = parseInt(digits.slice(0, 2), 10);
  if (h > 12) h = 12;
  if (h === 0) h = 12;
  const hStr = String(h).padStart(2, '0');

  if (digits.length === 2) {
    return { formatted: `${hStr}:`, period };
  }

  const mDigits = digits.slice(2);
  let m1 = parseInt(mDigits[0], 10);
  if (m1 > 5) m1 = 5;

  if (mDigits.length === 1) {
    return { formatted: `${hStr}:${m1}`, period };
  }

  let m = parseInt(mDigits, 10);
  if (m > 59) m = 59;
  const mStr = String(m).padStart(2, '0');
  return { formatted: `${hStr}:${mStr}`, period };
}

export function parseDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const trimmedDate = dateStr.trim();
  const trimmedTime = timeStr.trim();

  // Parse Date (support YYYY-MM-DD, YYYY/MM/DD, and MM/DD/YYYY)
  let year: number;
  let month: number;
  let day: number;

  const isoMatch = trimmedDate.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10) - 1;
    day = parseInt(isoMatch[3], 10);
  } else {
    const usMatch = trimmedDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (usMatch) {
      const first = parseInt(usMatch[1], 10);
      const second = parseInt(usMatch[2], 10);
      if (first > 12) {
        day = first;
        month = second - 1;
      } else {
        month = first - 1;
        day = second;
      }
      year = parseInt(usMatch[3], 10);
    } else {
      return null;
    }
  }

  // Parse Time (support 24-hr "14:30", "9:30", and 12-hr "9:30 AM", "2:15 pm", "11pm")
  let hours = 0;
  let minutes = 0;
  const timeMatch = trimmedTime.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/i);
  if (!timeMatch) return null;

  const rawH = parseInt(timeMatch[1], 10);
  const rawM = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const period = timeMatch[3] ? timeMatch[3].toUpperCase() : null;

  if (period) {
    if (rawH < 1 || rawH > 12) return null;
    if (rawM < 0 || rawM > 59) return null;
    hours = period === 'AM' ? (rawH === 12 ? 0 : rawH) : (rawH === 12 ? 12 : rawH + 12);
    minutes = rawM;
  } else {
    if (rawH < 0 || rawH > 23) return null;
    if (rawM < 0 || rawM > 59) return null;
    hours = rawH;
    minutes = rawM;
  }

  const d = new Date(year, month, day, hours, minutes, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}
