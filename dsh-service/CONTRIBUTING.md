# Add a DSH plugin

DSH is in developer preview (`@deepseek-ai/dsh` 0.2.1-rc.2). A plugin is a small Node module. DSH calls `apply(ctx)` when it loads the module. You register tools, a model adapter, or event hooks on `ctx`. You do not edit the agent loop.

Words used below:

- **Plugin**: a module with `apply(ctx)`.
- **Tool**: a function the model may call. Our tools only draft. They do not save.
- **Skill**: a markdown file of business rules. The model loads it by name.
- **Hook**: a listener on an event such as `llm/stream` or `tools/pre-execute`.
- **Profile**: the set of plugins started together. This service writes a profile patch at boot.
- **Surface**: `web`, `superadmin`, or `supplier`.

## Copy the template

```sh
cp -R dsh-service/plugins/_template dsh-service/plugins/quanluong-example
```

1. Set `name` in `index.js` and `package.json`. Use a unique name.
2. Put the work in `apply`.
3. Mount the plugin in `dsh-service/src/profile-patch.js`. Add a line next to the other `plugin(...)` calls.
4. Add a test under `dsh-service/test/` for the logic that does not need a running DSH process.
5. Restart the `dsh` container. The SDK process loads plugins at startup, not on each HTTP call.

The gateway loads a plugin by its absolute file path. You do not publish it to npm to use it here.

## Register a tool

Follow `plugins/quanluong-tools/index.js`.

- Import `defineTool` from `@deepseek-ai/dsh-tools`.
- `export const inject = ["tools"]` so `ctx.tools` exists.
- Return JSON text from `execute`. Do not write to the database inside the plugin.
- Call the backend with `DSH_SERVICE_TOKEN`. Add a route under `/api/internal/dsh/tools/` if the tool needs server data.
- Create the tool grant in the API call site with `dshCallFields`. The grant carries the user, the unit, and the scope.
- Refuse the tool when the grant feature does not match. See `tools.service.js`.

A tool that saves data does not belong here. The user confirms in the app. The server computes numbers.

## Add a skill

Create `plugins/quanluong-skills/skills/<kebab-name>/SKILL.md`:

```markdown
---
name: example-rules
description: One sentence the model sees in the catalog.
---

Write the rules in short sentences.
```

`name` must be kebab-case and must match the folder name. The model reads the file with `load_quanluong_skill`. On startup the service also copies these files to `$DSH_HOME/skills`.

## Add a hook

Follow `plugins/quanluong-audit/index.js` and `plugins/quanluong-policy/index.js`.

- `ctx.on("llm/stream", (options, next) => iterable)` wraps a model call.
- `ctx.on("tools/pre-execute", async (exec, next) => decision)` can deny a call.
- `ctx.on("tools/result", (outcome) => {})` sees a finished tool call.
- If the event name changes in a future DSH build, `apply` logs the error and the process still starts. The HTTP gateway audit log is the record that does not depend on those names.

Do not swallow a model error inside the hook. Log the audit failure, then rethrow the model error.

## Add an LLM adapter

Follow `plugins/llm-openrouter/`. Extend `LlmAdapter` from `@deepseek-ai/dsh-llm` and implement `stream()`. Emit `usage` before `finish`. Emit nothing after `finish`. Read secrets from the environment (`OPENROUTER_API_KEY` or `MENU_AI_API_KEY`). Do not put a key in a YAML file.

Register one route:

```js
ctx.llm.registerAdapter(["openrouter"], new OpenRouterAdapter());
```

## Choose a surface

`profiles/surfaces.js` lists which tools each surface may mount when `DSH_SPLIT_PROFILES=1`.

- `web`: ledger, menu, issue slip
- `supplier`: issue slip
- `superadmin`: no unit tools

With the default single process, every tool is mounted and the grant decides. Superadmin users are still blocked by the API before a ledger prompt is sent.

## Secrets and logs

- No API keys in source, logs, or skill files.
- The gateway log line is `ai.call`. It has the feature, the model, and the transport. It does not include the prompt.
- Plugin audit posts to `POST /api/internal/dsh/audit`.

## Test

```sh
cd dsh-service && node --test test/*.js
```

A mocked LLM is the `scripted` runtime. Do not call OpenRouter from unit tests.

## After you change plugins

Rebuild or restart:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file quanluong-app-be/.env.docker up --build dsh
```

Dev compose mounts `plugins/` into the container and runs `node --watch`. A change to a plugin file restarts the gateway. The DSH child process starts again on the next message.
