const DEFAULT_BASE_URL = 'https://l2calendar.com';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_SERVERS = 50;

export interface ServerChronicle {
  name: string;
  slug: string;
}

export interface ServerLabel {
  name: string;
  slug: string;
  color: string;
}

export interface PublicServer {
  name: string;
  website_url: string;
  rate: string;
  opening_date: string;
  opening_time: string | null;
  opening_datetime_utc: string | null;
  description: string | null;
  is_vip: boolean;
  vip_level: number;
  multiproff: boolean;
  multicraft: boolean;
  is_new: boolean;
  chronicle: ServerChronicle | null;
  labels: ServerLabel[];
}

export interface Chronicle {
  id: number;
  name: string;
  slug: string;
  display_order: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getBaseUrl(): string {
  const configured = process.env.L2CALENDAR_API_URL?.trim();
  if (!configured) return DEFAULT_BASE_URL;
  return configured.replace(/\/+$/, '');
}

async function requestJson<T>(path: string): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ApiError(`L2 Calendar API responded with HTTP ${response.status}`, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(`L2 Calendar API request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw new ApiError(
      `Failed to reach the L2 Calendar API: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return MAX_SERVERS;
  const value = Math.trunc(limit);
  if (value < 1) return 1;
  return Math.min(value, MAX_SERVERS);
}

export async function fetchServers(chronicle?: string): Promise<PublicServer[]> {
  const params = new URLSearchParams();
  if (chronicle) params.set('chronicle', chronicle);
  const search = params.toString();
  const servers = await requestJson<PublicServer[]>(`/api/servers${search ? `?${search}` : ''}`);
  return Array.isArray(servers) ? servers : [];
}

export async function fetchChronicles(): Promise<Chronicle[]> {
  const chronicles = await requestJson<Chronicle[]>('/api/chronicles');
  return Array.isArray(chronicles) ? chronicles : [];
}

export interface ServerQuery {
  chronicle?: string;
  limit?: number;
  onlyUpcoming?: boolean;
  newOnly?: boolean;
  minRate?: number;
  maxRate?: number;
}

export function parseRateNumeric(rate: string): number | null {
  if (!rate) return null;
  const normalized = rate.trim().toUpperCase().replace(/^X/, '').replace(/,/g, '.');
  if (normalized === 'GVE' || normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function selectServers(servers: PublicServer[], query: ServerQuery): PublicServer[] {
  let result = servers;

  if (query.newOnly) {
    result = result.filter((server) => server.is_new);
  }

  if (query.onlyUpcoming) {
    const today = startOfTodayUtc().getTime();
    result = result.filter((server) => {
      const timestamp = Date.parse(server.opening_date);
      return Number.isFinite(timestamp) && timestamp >= today;
    });
  }

  if (query.minRate !== undefined || query.maxRate !== undefined) {
    result = result.filter((server) => {
      const value = parseRateNumeric(server.rate);
      if (value === null) return false;
      if (query.minRate !== undefined && value < query.minRate) return false;
      if (query.maxRate !== undefined && value > query.maxRate) return false;
      return true;
    });
  }

  return result.slice(0, clampLimit(query.limit));
}

export function searchServers(servers: PublicServer[], query: string): PublicServer[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return servers.filter((server) => {
    const haystack = [
      server.name,
      server.website_url,
      server.rate,
      server.chronicle?.name ?? '',
      server.chronicle?.slug ?? '',
      server.description ?? '',
      ...server.labels.map((label) => `${label.name} ${label.slug}`),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function findServerByName(servers: PublicServer[], name: string): PublicServer | undefined {
  const needle = name.trim().toLowerCase();
  return servers.find((server) => server.name.trim().toLowerCase() === needle);
}

export function collectLabels(servers: PublicServer[]): ServerLabel[] {
  const bySlug = new Map<string, ServerLabel>();
  for (const server of servers) {
    for (const label of server.labels) {
      if (!bySlug.has(label.slug)) bySlug.set(label.slug, label);
    }
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}
