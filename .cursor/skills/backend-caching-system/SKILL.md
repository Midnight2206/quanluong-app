---
name: backend-caching-system
description: Guides building or refactoring backend caching in a Node.js Express JavaScript app using Redis, cache-aside patterns, explicit invalidation, safe TTL policies, and performance-oriented read optimization without compromising data correctness.
---

# Purpose

Dung skill nay khi task lien quan den cache de tang performance cho backend.
Use this skill when the task involves:

- Redis caching
- cache-aside reads
- response or query caching
- cache invalidation
- reducing repeated database reads
- improving backend performance on hot paths

# Rules

Skill nay chuan hoa caching de tang toc nhung van giu data dung.
- Use `Redis` as the default cache store.
- Database remains the source of truth; cache is only a performance layer.
- Prefer cache-aside for read-heavy data.
- Keep cache keys explicit, stable, and namespaced by resource.
- Define TTL intentionally instead of caching forever by default.
- Invalidate or refresh cache explicitly after writes that change cached data.
- Do not cache highly sensitive, per-user secret, or correctness-critical data unless the policy is very clear.

# Workflow

Doc reference theo dung bai toan performance.
1. Read [references/cache-boundary.md](references/cache-boundary.md) when deciding what should and should not be cached.
2. Read [references/cache-patterns.md](references/cache-patterns.md) when choosing cache-aside, write-through, or refresh strategies.
3. Read [references/cache-keys-and-ttl.md](references/cache-keys-and-ttl.md) when designing key names and expiration policy.
4. Read [references/cache-invalidation.md](references/cache-invalidation.md) when handling updates, deletes, or soft deletes.
5. Read [references/cache-safety.md](references/cache-safety.md) when data sensitivity, stale reads, or consistency concerns matter.
6. Reuse [templates/redis-cache.js](templates/redis-cache.js), [templates/cache-aside.js](templates/cache-aside.js), and [templates/cache-keys.js](templates/cache-keys.js) as the baseline.
7. Use [examples/users-list-cache.js](examples/users-list-cache.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-db-layer` because cached data often originates from Prisma queries
- `backend-crud-system` because writes must invalidate or refresh cached reads
- `backend-queue-system` when cache warming or background refresh is useful
- `backend-schedule-system` when periodic refresh jobs are needed
- `backend-error-handling` for safe cache failure fallback

# Adaptation Notes

Phan nay giup caching system khop voi backend hien tai.
- Prefer graceful fallback to DB when cache is unavailable.
- Cache hot list endpoints, lookup tables, and expensive derived reads before caching everything.
- Keep cache usage explicit in services instead of scattering it through controllers.
- If a cached path becomes complex, isolate cache helpers so invalidation stays reviewable.
