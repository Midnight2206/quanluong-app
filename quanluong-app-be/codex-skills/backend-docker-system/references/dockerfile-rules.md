# Dockerfile Rules

Dockerfile can nho gon, de predict, va phuc vu runtime on dinh.

## Preferred Practices

- use an official Node image
- set a clear `WORKDIR`
- copy dependency manifests before app source when possible
- install dependencies predictably
- copy only the files needed for runtime
- expose the app port explicitly
- use `CMD` for the default process

## Guardrails

- Do not bake `.env` files into the image.
- Do not put secrets in `ARG` or image layers.
- Do not copy `node_modules` from the host.
- Keep build steps reviewable and deterministic.
