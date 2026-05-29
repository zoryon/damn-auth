import type { CacheAdapter } from "@damn-auth/core";

export interface RedisLikeClient {
  get(key: string): Promise<string | null> | string | null;
  set?(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown> | unknown;
  setEx?(key: string, ttlSeconds: number, value: string): Promise<unknown> | unknown;
  del(key: string): Promise<unknown> | unknown;
}

export function RedisCache(client: RedisLikeClient): CacheAdapter {
  return {
    async get(key: string) {
      return client.get(key);
    },
    async set(key: string, value: string, ttlSeconds: number) {
      // Prefer setEx when the client exposes it; node-redis and ioredis shape this call differently.
      if (client.setEx) {
        await client.setEx(key, ttlSeconds, value);
        return;
      }

      if (!client.set) {
        throw new Error("Redis client must expose setEx() or set().");
      }

      await client.set(key, value, "EX", ttlSeconds);
    },
    async delete(key: string) {
      await client.del(key);
    }
  };
}
