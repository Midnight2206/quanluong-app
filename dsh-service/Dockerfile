FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY plugins ./plugins
COPY profiles ./profiles
COPY src ./src

ENV NODE_ENV=production \
    PORT=3090 \
    DSH_HOME=/var/lib/dsh \
    DSH_RUNTIME=sdk \
    DSH_PROFILE=sdk-minimal \
    PATH="/app/node_modules/.bin:${PATH}"

RUN mkdir -p /var/lib/dsh
EXPOSE 3090

CMD ["node", "src/index.js"]
