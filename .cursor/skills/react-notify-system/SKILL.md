---
name: react-notify-system
description: Guides building or refactoring a React notification system with toast feedback, in-app notification center, unread badge state, severity levels, and clear separation between transient action messages and persistent system notifications.
---

# Purpose

Dung skill nay khi task lien quan den notification system trong React app.
Use this skill when the task involves:

- notification center
- unread badge
- bell menu or notification drawer
- toast versus persistent notifications
- notification severity and action links

# Rules

Skill nay tach ro giua transient feedback va persistent notifications.
- Use toast for short-lived action feedback.
- Use the notification system for persistent, reviewable, or system-level messages.
- Keep unread count and read status in a shared state layer.
- Normalize notification shape before rendering UI.
- Keep notification UI separate from the event source that generates it.
- Do not duplicate the same message as both a persistent notification and a toast unless the UX requires both.

# Workflow

Doc reference truoc khi thiet ke notification flow.
1. Read [references/notification-types.md](references/notification-types.md) to decide whether a message should be toast, persistent notification, or both.
2. Read [references/data-shape.md](references/data-shape.md) when defining notification payloads and severity levels.
3. Read [references/read-state.md](references/read-state.md) when implementing unread count, mark-as-read, and clear behavior.
4. Read [references/ui-patterns.md](references/ui-patterns.md) when building bell menus, drawers, or notification lists.
5. Reuse [templates/notification-store.js](templates/notification-store.js), [templates/notification-bell.jsx](templates/notification-bell.jsx), and [templates/notification-item.jsx](templates/notification-item.jsx) as the baseline.
6. Use [examples/notification-center.jsx](examples/notification-center.jsx) and [examples/notify-action.js](examples/notify-action.js) as integration references.

# Adaptation Notes

Phan nay giup notification system khop voi architecture cua du an.
- If the backend already stores notifications, keep the UI state as a projection of that source rather than inventing a parallel client-only model.
- If the app only needs action feedback, use `react-error-handling` toast patterns and skip a full notification center.
- Keep notification generation in services, event handlers, or feature orchestration layers instead of deep presentational components.
