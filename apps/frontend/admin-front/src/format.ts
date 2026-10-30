/** How the screens write numbers, dates and the names the services use. */

import { formatBytes } from '@tumbaland/frontend-core';

const NUMBER = new Intl.NumberFormat();

export const formatCount = (value: number): string => NUMBER.format(value);

export const formatPercent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

export { formatBytes };

/** `-1` is how a plan says there is no ceiling. */
export const formatLimit = (limit: number, unit: 'bytes' | 'count'): string =>
  limit < 0 ? 'No limit' : unit === 'bytes' ? formatBytes(limit) : formatCount(limit);

export const formatAmount = (value: number, unit: 'bytes' | 'count'): string =>
  unit === 'bytes' ? formatBytes(value) : formatCount(value);

/** A UTC day as `Tue 27 Oct`. Days are UTC everywhere, so no local timezone creeps in. */
export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

/** `27 Oct` for a chart's axis. */
export function formatShortDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "today", "yesterday", "5 days ago", "3 months ago", or "Never". */
export function ago(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return 'Never';
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 60) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months < 24 ? `${months} months ago` : `${Math.floor(days / 365)} years ago`;
}

/** The names a person knows the parts of the app by. The keys are the shell's routes. */
const MODULES: Record<string, string> = {
  home: 'Home',
  relationship: 'Journal',
  album: 'Album',
  finance: 'Money',
  chat: 'Chat',
  account: 'Profile',
  groups: 'Groups',
  payments: 'Billing',
  admin: 'Admin'
};

export const moduleLabel = (key: string): string => MODULES[key] ?? key;

const SERVICES: Record<string, string> = {
  'album-service': 'Album',
  'relationship-service': 'Journal',
  'finance-service': 'Money',
  'chat-service': 'Chat',
  'auth-service': 'Account',
  'group-service': 'Groups',
  'payment-service': 'Billing',
  'mcp-service': 'Assistant tools'
};

export const serviceLabel = (service: string): string => SERVICES[service] ?? service.replace(/-service$/, '');

const PLATFORMS: Record<string, string> = { web: 'Browser', pwa: 'Installed app', ios: 'iOS app', android: 'Android app' };

export const platformLabel = (key: string): string => PLATFORMS[key] ?? key;

export function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * An assistant cost, from the meter's units (ten-thousandths of a dollar) to
 * dollars. Four decimals under a cent, because one cheap reply is a fraction of
 * one and "$0.00" would hide it; two otherwise.
 */
export function formatMoney(units: number): string {
  const dollars = units / 10_000;
  return `$${dollars.toFixed(units > 0 && units < 100 ? 4 : 2)}`;
}
