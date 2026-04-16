---
name: backend-schedule-system
description: Guides building or refactoring a backend scheduling system for automatic recurring tasks, with clear separation between time-based triggers, business services, and BullMQ queue execution in Node.js Express apps.
---

# Purpose

Dung skill nay khi task lien quan den tac vu tu dong chay theo lich trong backend.
Use this skill when the task involves:

- scheduled jobs
- recurring tasks
- cron-like backend automation
- automatic daily, hourly, or monthly tasks
- time-based triggers that should run without user action

# Rules

Skill nay chuan hoa lop schedule cua backend.
- Use scheduling only for time-based triggers.
- Keep scheduled handlers thin and intention-revealing.
- Let schedules call services or enqueue BullMQ jobs instead of holding large business workflows inline.
- Keep recurring job definitions explicit and stable.
- Use scheduling for automation, not as a substitute for request-time business logic.
- Keep failure handling, retries, and idempotency visible for recurring tasks.

# Workflow

Doc reference theo dung loai automation.
1. Read [references/when-to-schedule.md](references/when-to-schedule.md) to decide whether work should be scheduled, queued, or handled synchronously.
2. Read [references/schedule-boundary.md](references/schedule-boundary.md) when deciding what code belongs in the scheduler versus service or queue worker.
3. Read [references/idempotency-and-retries.md](references/idempotency-and-retries.md) when recurring jobs may run more than once or fail mid-flow.
4. Read [references/schedule-observability.md](references/schedule-observability.md) when handling logs, audit, or monitoring for automatic tasks.
5. Reuse [templates/scheduler.js](templates/scheduler.js), [templates/scheduled-job.js](templates/scheduled-job.js), and [templates/schedule-to-queue.js](templates/schedule-to-queue.js) as the baseline.
6. Use [examples/monthly-payroll-schedule.js](examples/monthly-payroll-schedule.js) as a reference.

# Related Skills

Skill nay thuong di cung:
- `backend-queue-system` because scheduled tasks often enqueue background work
- `backend-service-layer` because recurring business actions still belong in services
- `backend-audit-log` when scheduled actions must be recorded
- `backend-db-layer` when recurring tasks read or write MariaDB through Prisma
- `backend-error-handling` for safe failure handling around automatic tasks

# Adaptation Notes

Phan nay giup schedule system de van hanh trong team.
- Prefer one clear scheduler entry point instead of many scattered timers.
- Keep schedule names descriptive and tied to business purpose.
- If a scheduled task becomes heavy, let the schedule enqueue a BullMQ job rather than doing all work inline.
