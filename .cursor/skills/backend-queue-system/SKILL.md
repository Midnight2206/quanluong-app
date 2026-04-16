---
name: backend-queue-system
description: Guides building or refactoring a Node.js Express queue system using Redis and BullMQ so long-running or non-immediate tasks are processed asynchronously without blocking user requests, with clear service-to-queue boundaries and worker handling.
---

# Purpose

Dung skill nay khi task lien quan den queue, background jobs, hoac async processing o backend.
Use this skill when the task involves:

- Redis
- BullMQ
- background jobs
- async task processing
- non-blocking user actions
- retryable long-running work

# Rules

Skill nay chuan hoa viec day tac vu nen vao queue.
- Use `Redis + BullMQ` as the default queue stack.
- Any long-running task that does not need an immediate result should be pushed to a queue.
- User-facing HTTP requests should return quickly once the background job is accepted.
- Services decide whether work is synchronous or asynchronous.
- Workers process queued jobs; they do not participate in HTTP response flow.
- Keep job payloads minimal, serializable, and safe.
- Keep retry and failure handling explicit for background jobs.

# Workflow

Doc reference theo dung bai toan async processing.
1. Read [references/when-to-queue.md](references/when-to-queue.md) to decide whether work should be queued.
2. Read [references/job-boundary.md](references/job-boundary.md) when deciding what data belongs in a job payload.
3. Read [references/worker-responsibility.md](references/worker-responsibility.md) when implementing BullMQ workers.
4. Read [references/retry-and-failure.md](references/retry-and-failure.md) when designing retries, dead-letter behavior, or failure logging.
5. Reuse [templates/queue-client.js](templates/queue-client.js), [templates/job-producer.js](templates/job-producer.js), and [templates/job-worker.js](templates/job-worker.js) as the baseline.
6. Use [examples/email-job-flow.js](examples/email-job-flow.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-service-layer` because services decide when to enqueue work
- `backend-response-system` because accepted jobs should return quick, consistent responses
- `backend-audit-log` when queued actions need traceable events
- `backend-db-layer` when jobs read or write MariaDB through Prisma
- `backend-error-handling` for worker and enqueue failure mapping

# Adaptation Notes

Phan nay giup queue system khop voi backend team workflow.
- Prefer queueing for email sending, report generation, file processing, notification fan-out, and similar background work.
- If a job must observe DB consistency, enqueue at the correct point in the service flow and consider transaction boundaries carefully.
- Keep queue names, job names, and payload schemas stable and intention-revealing.
