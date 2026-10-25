# Plugin template

Copy this folder to `dsh-service/plugins/<your-name>/`.

1. Change `name` in `index.js` and `package.json`.
2. Register tools, an adapter, or hooks inside `apply`.
3. Add the folder to `src/profile-patch.js` so the gateway mounts it.
4. Add a small node:test file under `dsh-service/test/` for the logic that does not need the DSH process.

Do not commit API keys. Read them from the environment inside `apply`.

See `CONTRIBUTING.md` in the service root.
