/**
 * Shared formatting utilities for the application
 */

/**
 * Format bytes into human-readable file size
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return 'Invalid size';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.min(i, sizes.length - 1);

  return `${(bytes / Math.pow(k, index)).toFixed(decimals)} ${sizes[index]}`;
}

/**
 * Format duration in seconds to human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "1h 30m 15s")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return 'Invalid duration';
  if (seconds === 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Format duration in milliseconds to human-readable format
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "1h 30m 15s")
 */
export function formatDurationMs(ms: number): string {
  return formatDuration(Math.floor(ms / 1000));
}

/**
 * Format a date for display
 * @param date - Date to format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }
): string {
  return new Intl.DateTimeFormat('en-US', options).format(new Date(date));
}

/**
 * Format a date as short date (e.g., "Jan 15, 2024")
 */
export function formatShortDate(date: Date | string): string {
  return formatDate(date, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date as date and time (e.g., "Jan 15, 2024 at 3:30 PM")
 */
export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  const dateStr = formatShortDate(d);
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} at ${timeStr}`;
}

/**
 * Format a number with comma separators (e.g., 1000000 -> "1,000,000")
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format a percentage (e.g., 0.756 -> "75.6%")
 * @param value - Value between 0 and 1
 * @param decimals - Number of decimal places (default: 1)
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
