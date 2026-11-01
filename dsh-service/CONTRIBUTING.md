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

## Add an Anthropic-style skill

DSH runs the markdown only. Do not copy helper scripts, Python, or tools that exist only in Claude.

1. Read the source skill. Keep the job (what the user is asking). Drop anything that runs code or needs a tool this app does not have.
2. Point every number at a Quan Luong tool. For the ledger, that is `read_ledger_day` and its `checks` object. The server already ran `computeLedger`. The skill tells the model to quote `checks`, not to add the numbers again.
3. Say the model does not write. Draft tools return `committed: false`. The user confirms in the app.
4. If the source is Apache-2.0, add a line at the top of `SKILL.md` naming the source file, and add the file to `plugins/quanluong-skills/NOTICE`. The license text is `Apache-2.0-LICENSE` in that folder.
5. Do not copy Anthropic skills whose license is not Apache-2.0. The docx, pdf, pptx, and xlsx skills are not Apache-2.0. Leave them out.
6. Add the skill name to the test in `dsh-service/test/api.test.js` so a missing file fails `node --test`.

`explore-data` and `validate-data` are the examples. `data-visualization` and `statistical-analysis` were skipped because they are Python chart and statistics steps, and this assistant answers in text.

## MCP tools

`src/mcp-server.js` exposes the same read and draft tools over stdio. The profile patch starts `@deepseek-ai/dsh-mcp-client` against that file. The native tools stay in place. If the MCP process fails, the model can still call `read_ledger_day`.

When you add a tool:

1. Add it in `plugins/quanluong-tools` and in `src/mcp-server.js`.
2. Mark it read-only. Do not accept `commit`, `save`, or `apply`. Use a strict object schema.
3. Add `mcp__quanluong__<tool name>` to the allow list in `plugins/quanluong-policy/index.js`. Any other `mcp__` name is denied.
4. The backend still checks the grant. A new tool needs a route under `/api/internal/dsh/tools/` and a feature prefix.

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
