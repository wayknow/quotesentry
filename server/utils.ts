import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(prefix: string): string {
  return `${prefix}_${globalThis.crypto.randomUUID().slice(0, 8)}`;
}

export function hashText(value: string): string {
  return bytesToHex(sha256(utf8ToBytes(value)));
}

export function hashBytes(value: Uint8Array): string {
  return bytesToHex(sha256(value));
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function asciiSafe(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, '?');
}

export function addDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
