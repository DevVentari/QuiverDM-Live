/**
 * Date formatting utilities for the dashboard
 */

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

/**
 * Format a date as a relative time string (e.g., "3 days ago", "in 2 hours")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  const absDiff = Math.abs(diff);

  if (absDiff < MINUTE) {
    return 'just now';
  } else if (absDiff < HOUR) {
    const minutes = Math.round(diff / MINUTE);
    return rtf.format(minutes, 'minute');
  } else if (absDiff < DAY) {
    const hours = Math.round(diff / HOUR);
    return rtf.format(hours, 'hour');
  } else if (absDiff < WEEK) {
    const days = Math.round(diff / DAY);
    return rtf.format(days, 'day');
  } else if (absDiff < MONTH) {
    const weeks = Math.round(diff / WEEK);
    return rtf.format(weeks, 'week');
  } else {
    const months = Math.round(diff / MONTH);
    return rtf.format(months, 'month');
  }
}

/**
 * Format a session time for display
 * - If today: "Today at 7:00 PM"
 * - If tomorrow: "Tomorrow at 7:00 PM"
 * - If this week: "Wednesday at 7:00 PM"
 * - Otherwise: "Dec 25 at 7:00 PM"
 */
export function formatSessionTime(date: Date | string): string {
  const target = new Date(date);
  const now = new Date();

  const isToday = isSameDay(target, now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = isSameDay(target, tomorrow);

  const timeString = target.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return `Today at ${timeString}`;
  } else if (isTomorrow) {
    return `Tomorrow at ${timeString}`;
  }

  // Check if within the next week
  const daysUntil = Math.floor((target.getTime() - now.getTime()) / DAY);
  if (daysUntil > 0 && daysUntil < 7) {
    const dayName = target.toLocaleDateString('en-US', { weekday: 'long' });
    return `${dayName} at ${timeString}`;
  }

  // Default: show date
  const dateString = target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${dateString} at ${timeString}`;
}

/**
 * Check if two dates are the same calendar day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string): boolean {
  return isSameDay(new Date(date), new Date());
}

/**
 * Check if a session is currently active (within session window)
 * Considers a session "active" if we're within 30 min before or 4 hours after start
 */
export function isSessionActive(session: { date: Date | string } | null): boolean {
  if (!session) return false;

  const now = new Date();
  const sessionTime = new Date(session.date);

  const thirtyMinBefore = new Date(sessionTime.getTime() - 30 * MINUTE);
  const fourHoursAfter = new Date(sessionTime.getTime() + 4 * HOUR);

  return now >= thirtyMinBefore && now <= fourHoursAfter;
}

/**
 * Check if a session is scheduled for today
 */
export function isSessionToday(session: { date: Date | string } | null): boolean {
  if (!session) return false;
  return isToday(session.date);
}
