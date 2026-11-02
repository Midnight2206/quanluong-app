# DeepSeek Harness service

This process is the AI gateway for Quan Luong. The Express API does not import DSH. It calls this service over HTTP. DSH 0.2.1-rc.2 has no HTTP API of its own. It has a stdio JSON-RPC SDK (`dsh --profile sdk-minimal`). This service wraps that SDK.

```
web / superadmin / supplier
        |
        v
quanluong-app-be
        |  AI_ENGINE=dsh   (fallback: direct OpenRouter call)
        v
dsh-service  POST /v1/sessions, POST /v1/sessions/:id/messages
        |
        |  JSON-RPC stdio
        v
dsh --profile sdk-minimal
        |
        +-- plugins/llm-openrouter     OpenRouter adapter (LlmAdapter.stream)
        +-- plugins/quanluong-tools    read ledger/menu, propose drafts
        +-- plugins/quanluong-skills   business rules
        +-- plugins/quanluong-audit    llm/stream and tools/result hooks
        +-- plugins/quanluong-policy   block shell, filesystem, and commits
        +-- plugins/quanluong-skill-loop   draft skills from finished tasks
        +-- plugins/quanluong-memory       unit- and user-scoped notes
        +-- plugins/quanluong-subagents    role-limited child reports
        +-- plugins/quanluong-schedule     cron reports, no business writes
        +-- plugins/quanluong-sandbox      tool permissions and code review
```

The tools call back to `http://app:3000/api/internal/dsh/...` with the same `DSH_SERVICE_TOKEN`. A tool grant lasts 10 minutes. Grants are created by the API for one user and one unit. Tools never save the ledger, the menu, or an issue slip.

## What DSH is doing

| Piece | Used here |
| --- | --- |
| SDK profile `sdk-minimal` | Yes. One long-lived process per model, cap 4. |
| `LlmAdapter.stream()` | Yes. Our OpenRouter adapter. |
| Plugins | Yes. First-party plugins under `plugins/`. |
| Skills | Yes. `SKILL.md` files plus the `load_quanluong_skill` tool. Copies also go to `$DSH_HOME/skills`. Ledger figure skills are `explore-data` and `validate-data` (adapted from Anthropic's Apache-2.0 data plugin; see `plugins/quanluong-skills/NOTICE`). `ledger-extract` is the record JSON schema. |
| Hooks | Yes. `llm/stream`, `tools/result`, `tools/pre-execute`. |
| Sessions | Yes. One session id per account, unit, and surface (`web`, `superadmin`, `supplier`). |
| MCP client | Yes. `@deepseek-ai/dsh-mcp-client` 0.2.1-rc.2 talks stdio to `src/mcp-server.js`. The server exposes the same read and draft tools, with the same token and grant. `failOnStartupError` is false, so a dead MCP process does not stop the native tools. Other MCP tool names are denied. |
| `dsh web` | Optional. Compose profile `dsh-web`. Off by default. |
| `@openma/dsh-agents-plugins-bridge` | Not used. Still a developer preview. |
| `dsh-cordis-universal-adapter` | Not used. Same reason. |
| `@deepseek-ai/dsh-llm-pi-ai` | Not mounted. It can also call OpenRouter. We ship our own adapter so the stream contract is tested without the pi-ai catalog. You can add the pi-ai plugin later with `dsh plugin`. |

`sdk-minimal` is the default profile so the model does not get a shell. `DSH_PROFILE=sdk` is the full profile. The policy plugin still denies host tools.

Separate OS processes per surface are off by default (`DSH_SPLIT_PROFILES=0`). Session ids already isolate accounts. Set `DSH_SPLIT_PROFILES=1` when you want one DSH process per surface. Each process is a full runtime.

The SDK fixes the model at startup. A different model starts another process, up to 4. This is a limit of the current SDK, not of OpenRouter.

## HTTP API

All routes except `GET /health` need `Authorization: Bearer $DSH_SERVICE_TOKEN`.

- `GET /health` → `{ status, dsh, runtime }`
- `POST /v1/sessions` `{ accountId, unitId, surface }` → `{ id, accountId, unitId, surface }`
- `POST /v1/sessions/:id/messages` `{ accountId, unitId, text, system, image, grantId, feature, model, temperature }`
- The same message route with `Accept: text/event-stream` sends one `message` event and one `done` event. The SDK run finishes before the event is sent. Token-by-token streaming is not exposed.
- `GET /v1/profiles` lists surfaces.

`accountId` and `unitId` on a message must match the session. A session id is `session-acct-<account>-unit-<unit>-<surface>`.

## Environment

| Name | Purpose |
| --- | --- |
| `DSH_SERVICE_TOKEN` | Shared secret. Required. |
| `DSH_RUNTIME` | `sdk` (default) or `scripted` (tests). |
| `DSH_PROFILE` | Default `sdk-minimal`. |
| `DSH_HOME` | Session and skill files. Docker uses `/var/lib/dsh`. |
| `DSH_MODEL` | Default model when a request omits one. |
| `DSH_SPLIT_PROFILES` | `1` boots one process per surface. |
| `OPENROUTER_API_KEY` or `MENU_AI_API_KEY` | OpenRouter key. The adapter reads it per request. |
| `MENU_AI_BASE_URL` | Default `https://openrouter.ai/api/v1`. |
| `LEDGER_TOOL_BACKEND_URL` | Backend base URL. Docker: `http://app:3000`. |
| `QUANLUONG_TOOL_FEATURES` | `ledger,menu,issue-slip`. The split-profile mode sets this per surface. |
| `PORT` | Default `3090`. |

The API reads these:

| Name | Purpose |
| --- | --- |
| `AI_ENGINE` | `dsh` or `direct`. Code default is `direct`. Compose sets `dsh`. |
| `LEDGER_AI_ENGINE` | Used only when `AI_ENGINE` is empty. |
| `DSH_SERVICE_URL` | Compose: `http://dsh:3090`. |
| `DSH_SERVICE_TOKEN` | Same value as the service. |
| `DSH_TIMEOUT_MS` | Default 60000. |
| `MENU_AI_API_KEY` | Still required. Empty means AI is off, for both engines. |
| `LEDGER_AI_EXTRACT_MODEL` | Ledger record extraction. |
| `LEDGER_AI_QUESTION_MODEL` | Ledger questions. Also the default `DSH_MODEL`. |

## Run on a Mac with Docker Compose

From the repo root:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file quanluong-app-be/.env.docker up --build dsh app
```

The service has no published port. From the host, use another container on the same network, or:

```sh
docker compose exec app node -e "fetch('http://dsh:3090/health').then(r=>r.json()).then(console.log)"
```

The admin UI is off unless you ask for it:

```sh
docker compose --profile dsh-web -f docker-compose.yml --env-file quanluong-app-be/.env.docker up dsh-web
```

Then open the URL printed in the logs. The host port is `127.0.0.1:3080` only. DSH will not bind `0.0.0.0`. The command uses the container's own address.

Set `AI_ENGINE=direct` in `.env.docker` to keep the old model calls. If `AI_ENGINE=dsh` and the service is down, not configured, or returns HTTP 502/503/504, the API logs `status: fallback` and calls OpenRouter itself. A 401, a 400, or a model error (HTTP 500) is not a fallback. The SDK finishes a failed model turn instead of throwing. This service reads that turn and returns HTTP 500, so a missing OpenRouter key or a bad model reply is not sent to OpenRouter a second time. Fix the token or the model. If the service restarts and forgets a session, the client opens that session once more and sends the message again.

## Run tests on the host

Node 22.19 or newer. The service tests do not download DSH and do not call OpenRouter.

```sh
cd dsh-service && node --test test/*.js
cd quanluong-app-be && node --test src/modules/ai-gateway/tools.service.test.js src/modules/kitchen-books/kitchen-books-menu-ai-llm.test.js src/modules/kitchen-books/kitchen-ledger-assistant.service.test.js
```

## Optional plugins

Each plugin is on unless its env var is `0`, `false`, `off`, or `no`. `GET /health` lists them. A turned-off plugin is omitted from the DSH profile and its HTTP routes return `PLUGIN_DISABLED`.

| Plugin | Env | What it does |
| --- | --- | --- |
| `quanluong-skill-loop` | `DSH_PLUGIN_SKILL_LOOP` | Draft a skill from a finished task. A later use can file an improvement draft. A person accepts it with `POST /v1/plugins/skill-loop/skills/:id/accept`. |
| `quanluong-memory` | `DSH_PLUGIN_MEMORY` | Bounded notes. `unit` is shared inside one unit. `user` is only that account. Another unit's file partition is never returned. |
| `quanluong-subagents` | `DSH_PLUGIN_SUBAGENTS` | `delegate_task` runs one role with its own tool list. `DSH_SUBAGENT_MAX` defaults to 3. The child report is not saved to the app database. |
| `quanluong-schedule` | `DSH_PLUGIN_SCHEDULE` | 5-field UTC cron. Ticks every `DSH_SCHEDULE_INTERVAL_MS` (default 60000). Logs a report. Scheduled turns cannot draft or write. |
| `quanluong-sandbox` | `DSH_PLUGIN_SANDBOX` | Allow-list of read and draft tools. Blocks dangerous command text. `review_code` does not execute. `DSH_SANDBOX_STRICT=0` allows unknown tool names that are not on the deny list. |

These ideas follow Hermes Agent (MIT, Nous Research): skill drafts, bounded memory, delegated roles, cron ticks, and command blocks. No Hermes source is copied.

Learned state is JSON under `$DSH_HOME/plugins/`. It is not a business table, so there is no database migration. The model cannot pass another unit id: tools use the session unit. Accept, tick, and subagent HTTP routes are for the API, which already holds `DSH_SERVICE_TOKEN`.

## Add a plugin

See `CONTRIBUTING.md`.

## Remove the direct fallback later

1. Run with `AI_ENGINE=dsh` until the `ai.call` log shows no `status: fallback` for a full working period.
2. Change the code default of `AI_ENGINE` from `direct` to `dsh`.
3. Delete `completeDirect` in `kitchen-books-menu-ai-llm.js` and the `DshUnavailable` branch.
4. Keep `MENU_AI_API_KEY` only as the OpenRouter key for this service (`OPENROUTER_API_KEY`).

Do not delete the fallback while DSH is still a release candidate.
