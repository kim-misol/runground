import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma as db } from '@runground/db';

/**
 * Zepp Open Platform API endpoints
 * https://developer.zepp.com/os/home
 */
const ZEPP_AUTH_URL = 'https://account.zepp.com/oauth2/authorize';
const ZEPP_TOKEN_URL = 'https://account.zepp.com/oauth2/token';
const ZEPP_API_BASE = 'https://open-fitnesstracker.zepp.com';

interface ZeppTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
  uid?: string; // Zepp user ID
}

interface ZeppSportRecord {
  sportType: number;
  startTime: number;      // unix ms
  endTime: number;        // unix ms
  totalDistance: number;  // meters
  totalTime: number;      // seconds
  avgHeartRate: number;
  maxHeartRate: number;
  calories: number;
  avgPace: number;        // seconds per km
  trackPoints?: Array<{ lat: number; lon: number; ele: number; ts: number }>;
  rawData?: Record<string, unknown>;
}

@Injectable()
export class ZeppService {
  constructor(private config: ConfigService) {}

  private get clientId(): string {
    return this.config.getOrThrow<string>('ZEPP_CLIENT_ID');
  }

  private get clientSecret(): string {
    return this.config.getOrThrow<string>('ZEPP_CLIENT_SECRET');
  }

  private get redirectUri(): string {
    return this.config.getOrThrow<string>('ZEPP_REDIRECT_URI');
  }

  // ── OAuth 2.0 ──────────────────────────────────────────────────────────────

  /** Step 1: Build authorization URL to redirect the user */
  buildAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'sport_record',
      state: userId, // carry userId through the OAuth flow
    });
    return `${ZEPP_AUTH_URL}?${params.toString()}`;
  }

  /** Step 2: Exchange authorization code for tokens, persist them */
  async handleCallback(code: string, userId: string): Promise<void> {
    const tokens = await this.fetchTokens('authorization_code', { code });

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db.zeppCredential.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        zeppUserId: tokens.uid ?? null,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        zeppUserId: tokens.uid ?? null,
      },
    });
  }

  // ── Token management ────────────────────────────────────────────────────────

  /** Returns a valid access token, refreshing it if expired */
  private async getValidAccessToken(userId: string): Promise<string> {
    const cred = await db.zeppCredential.findUnique({ where: { userId } });
    if (!cred) throw new NotFoundException('Zepp 계정이 연결되지 않았습니다. /zepp/connect 로 연결하세요.');

    if (cred.expiresAt > new Date()) return cred.accessToken;

    // Refresh
    const tokens = await this.fetchTokens('refresh_token', { refresh_token: cred.refreshToken });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db.zeppCredential.update({
      where: { userId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      },
    });

    return tokens.access_token;
  }

  private async fetchTokens(
    grantType: 'authorization_code' | 'refresh_token',
    extra: Record<string, string>,
  ): Promise<ZeppTokenResponse> {
    const body = new URLSearchParams({
      grant_type: grantType,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      ...extra,
    });

    const res = await fetch(ZEPP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new UnauthorizedException(`Zepp 토큰 발급 실패: ${err}`);
    }

    return res.json() as Promise<ZeppTokenResponse>;
  }

  // ── Activity Sync ───────────────────────────────────────────────────────────

  /**
   * Fetches sport records from Zepp and upserts them as ActivityRecord rows.
   * @param userId  Our internal user ID
   * @param fromMs  Unix ms — fetch records after this timestamp (default: 7 days ago)
   */
  async syncActivities(userId: string, fromMs?: number): Promise<{ synced: number }> {
    const accessToken = await this.getValidAccessToken(userId);
    const since = fromMs ?? Date.now() - 7 * 24 * 60 * 60 * 1000;

    const records = await this.fetchSportRecords(accessToken, since);
    if (!records.length) return { synced: 0 };

    // Upsert each record keyed by externalId (Zepp's record identifier)
    await Promise.all(
      records.map((r) =>
        db.activityRecord.upsert({
          where: {
            // We need a unique constraint on (userId, provider, externalId).
            // Using findFirst + create/update pattern as fallback:
            userId_provider_externalId: {
              userId,
              provider: 'AMAZFIT',
              externalId: String(r.startTime),
            },
          },
          create: this.mapToActivityRecord(userId, r),
          update: this.mapToActivityRecord(userId, r),
        }),
      ),
    );

    return { synced: records.length };
  }

  private async fetchSportRecords(accessToken: string, fromMs: number): Promise<ZeppSportRecord[]> {
    const params = new URLSearchParams({
      from_date: String(Math.floor(fromMs / 1000)),
      to_date: String(Math.floor(Date.now() / 1000)),
      sport_type: '1', // 1 = running; omit to fetch all types
      page_size: '50',
      page: '1',
    });

    const res = await fetch(
      `${ZEPP_API_BASE}/v2/sport/sportRecord/list?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new BadRequestException(`Zepp 활동 조회 실패: ${err}`);
    }

    const json = (await res.json()) as { data?: { list?: ZeppSportRecord[] } };
    return json.data?.list ?? [];
  }

  private mapToActivityRecord(
    userId: string,
    r: ZeppSportRecord,
  ): Parameters<typeof db.activityRecord.create>[0]['data'] {
    return {
      userId,
      provider: 'AMAZFIT',
      externalId: String(r.startTime),
      startedAt: new Date(r.startTime),
      durationSec: r.totalTime ?? null,
      distanceM: r.totalDistance ? Math.round(r.totalDistance) : null,
      avgPaceSecPerKm: r.avgPace ?? null,
      avgHr: r.avgHeartRate ?? null,
      calories: r.calories ?? null,
      rawJson: r.rawData ?? (r as unknown as Record<string, unknown>),
    };
  }

  // ── Status ──────────────────────────────────────────────────────────────────

  async getConnectionStatus(userId: string) {
    const cred = await db.zeppCredential.findUnique({
      where: { userId },
      select: { expiresAt: true, zeppUserId: true, updatedAt: true },
    });

    return {
      connected: !!cred,
      expiresAt: cred?.expiresAt ?? null,
      zeppUserId: cred?.zeppUserId ?? null,
      lastSynced: cred?.updatedAt ?? null,
    };
  }

  async disconnect(userId: string): Promise<void> {
    await db.zeppCredential.deleteMany({ where: { userId } });
  }
}
