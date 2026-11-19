export type Mode = 'test' | 'live';
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type VerifiedPlayer = { valid: true; playerId: string; mode: Mode; exp: number };
export type SessionResult = VerifiedPlayer | { valid: false };
export interface Charge { id: string; playerId: string; productId: string; amount: number; status: 'paid' | 'delivered' | 'refunded'; mode: Mode; createdAt: number; deliveredAt: number | null; refundedAt: number | null }
export interface Product { id: string; name: string; price: number; active: boolean; [key: string]: unknown }
export interface RequestOptions { idempotencyKey?: string; signal?: AbortSignal }
export interface ClientOptions { baseUrl?: string; timeoutMs?: number; maxRetries?: number; fetch?: typeof fetch }
export interface OperationParams {
 verifySession: {session: string}; listProducts: {}; getCharge: {id: string}; deliverCharge: {id: string}; refundCharge: {id: string};
 payReward: {playerId: string; amount: number; key: string; reason?: string}; getPool: {}; sendNotification: {playerId: string; text: string; startParam?: string}; verifyAd: {adId: string};
 listTables: {}; saveTable: {tableId: string; hostPlayerId: string; seats?: number; taken?: number; title?: string; stake?: number; pot?: number; expiresIn?: number}; sitAtTable: {id: string; playerId: string}; removeTable: {id: string};
 listPendingCharges: {cursor?: string; limit?: number}; listLeaderboards: {};
 saveLeaderboard: {board: string; season: string; name: string; order: 'asc' | 'desc'; startsAt?: number; endsAt?: number};
 getLeaderboard: {board: string; season: string; playerId?: string; limit?: number};
 submitScore: {board: string; season: string; playerId: string; score: number}; moderateScore: {board: string; season: string; playerId: string; hidden: boolean; reason: string};
 getPlayerStorage: {playerId: string; key: string}; setPlayerStorage: {playerId: string; key: string; value: Json; expectedVersion: number};
 listWebhookEvents: {cursor?: string}; replayWebhookEvent: {id: string}; createAdChallenge: {playerId: string; context: Json; expiresIn?: number}; claimAdChallenge: {id: string; adId: string};
 getAnalytics: {days?: number}; exportAnalytics: {days?: number};
}
export interface OperationResults {
 verifySession: SessionResult; listProducts: {products: Product[]}; getCharge: {charge: Charge}; deliverCharge: {charge: Charge}; refundCharge: {charge: Charge};
 payReward: Record<string, unknown>; getPool: {balance: number; dailyCapPerPlayer: number; mode: Mode}; sendNotification: {sent: true; pushed: boolean}; verifyAd: Record<string, unknown>;
 listTables: {tables: Record<string, unknown>[]}; saveTable: Record<string, unknown>; sitAtTable: Record<string, unknown>; removeTable: {removed: boolean};
 listPendingCharges: {charges: Charge[]; next: string | null}; listLeaderboards: {boards: Record<string, unknown>[]}; saveLeaderboard: Record<string, unknown>; getLeaderboard: Record<string, unknown>; submitScore: Record<string, unknown>; moderateScore: Record<string, unknown>;
 getPlayerStorage: {value: Json; version: number; updatedAt: number | null}; setPlayerStorage: {value: Json; version: number; updatedAt: number}; listWebhookEvents: {events: Record<string, unknown>[]; next: string | null}; replayWebhookEvent: {queued: true; eventId: string};
 createAdChallenge: {challengeId: string; expiresAt: number; context: Json}; claimAdChallenge: {playerId: string; adId: string; context: Json; providerVerified?: boolean; [key: string]: unknown};
 getAnalytics: Record<string, unknown>; exportAnalytics: string;
}
