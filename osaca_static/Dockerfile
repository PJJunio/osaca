# syntax=docker/dockerfile:1.7
# SPDX-License-Identifier: AGPL-3.0-or-later

FROM alpine:3.24 AS spellcheck-dictionaries
RUN apk add --no-cache curl
COPY osaca_static/fetch-spellcheck-dictionaries.sh osaca_static/spellcheck-dictionaries.sha256 /src/
RUN sh /src/fetch-spellcheck-dictionaries.sh /dictionaries

FROM caddy:2.11-alpine AS caddy
RUN setcap -r /usr/bin/caddy

FROM alpine:3.24

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="osaca-static"
LABEL org.opencontainers.image.description="Self-hostable static asset bundle for OSACA"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later AND CC-BY-SA-4.0 AND CC-BY-4.0"
LABEL org.opencontainers.image.vendor="OSACA"
LABEL org.opencontainers.image.url="https://osaca.example"
LABEL org.opencontainers.image.documentation="https://docs.osaca.example"
LABEL org.opencontainers.image.source="https://github.com/PJJunio/osaca"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.osaca.build-version="${BUILD_VERSION}"

RUN apk add --no-cache ca-certificates mailcap

COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY osaca_static/Caddyfile /etc/caddy/Caddyfile
COPY --chown=65532:65532 osaca_static/LICENSE osaca_static/THIRD_PARTY_LICENSES.md /srv/osaca-static/
COPY --chown=65532:65532 osaca_static/avatars /srv/osaca-static/avatars
COPY --chown=65532:65532 osaca_static/badges /srv/osaca-static/badges
COPY --chown=65532:65532 osaca_static/desktop /srv/osaca-static/desktop
COPY --chown=65532:65532 --from=spellcheck-dictionaries /dictionaries /srv/osaca-static/desktop/spellcheck/dictionaries
COPY --chown=65532:65532 osaca_static/email /srv/osaca-static/email
COPY --chown=65532:65532 osaca_static/emoji /srv/osaca-static/emoji
COPY --chown=65532:65532 osaca_static/web /srv/osaca-static/web

RUN mkdir -p /config/caddy /data/caddy \
	&& chown -R 65532:65532 /config /data /srv/osaca-static

ENV XDG_CONFIG_HOME=/config
ENV XDG_DATA_HOME=/data

USER 65532:65532
WORKDIR /srv

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD wget -q -O - http://127.0.0.1:8080/_health | grep -q OK

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
