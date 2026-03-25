import { format, formatDistanceToNow, parseISO, startOfWeek, endOfWeek } from 'date-fns';

export function formatDate(date: string | Date, fmt = 'dd MMM yyyy') {
  if (typeof date === 'string') {
    // Plain date string "2024-01-15" - append noon to avoid timezone day-shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return format(new Date(date + 'T12:00:00'), fmt);
    }
    return format(parseISO(date), fmt);
  }
  return format(date, fmt);
}

export function formatDateTime(date: string | Date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy, h:mm a');
}

// Handles both plain time strings "09:00:00" (from DB) and full ISO timestamps
export function formatTime(time: string | Date) {
  if (typeof time === 'string') {
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
      const [h, m] = time.split(':').map(Number);
      const period = h >= 12 ? 'pm' : 'am';
      const hour12 = h % 12 || 12;
      return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
    }
    return format(parseISO(time), 'h:mm a');
  }
  return format(time, 'h:mm a');
}

export function formatRelative(date: string | Date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatCurrency(amount: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// Input is minutes (minutes_worked/minutes_paid from DB earnings)
export function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatWeekRange(date: Date | string) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const start = startOfWeek(d, { weekStartsOn: 1 });
  const end = endOfWeek(d, { weekStartsOn: 1 });
  return `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`;
}

export function dayOfWeekName(day: number) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] ?? 'Unknown';
}

// Accepts single full_name string (actual DB schema - no first_name/last_name)
export function fullName(name?: string | null): string {
  return name?.trim() || 'Unknown User';
}
