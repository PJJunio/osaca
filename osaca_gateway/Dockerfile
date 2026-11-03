# SPDX-License-Identifier: AGPL-3.0-or-later
FROM erlang:28.5.0.8-slim AS build

ARG RUST_TOOLCHAIN=1.98.1

ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
	git \
	curl \
	make \
	gcc \
	g++ \
	libc6-dev \
	ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

RUN curl --retry 5 --retry-delay 2 --retry-all-errors -fsSL https://github.com/erlang/rebar3/releases/download/3.27.3/rebar3 -o /usr/local/bin/rebar3 && \
	chmod +x /usr/local/bin/rebar3

RUN curl --retry 5 --retry-delay 2 --retry-all-errors --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | \
	sh -s -- -y --profile minimal --default-toolchain "${RUST_TOOLCHAIN}"

COPY . .
WORKDIR /usr/src/app/osaca_gateway
RUN rebar3 compile --deps_only

RUN cp config/sys.config.template config/sys.config && \
	rebar3 as prod release

FROM erlang:28.5.0.8-slim

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="osaca-gateway"
LABEL org.opencontainers.image.description="OSACA realtime gateway"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.vendor="OSACA"
LABEL org.opencontainers.image.url="https://osaca.example"
LABEL org.opencontainers.image.documentation="https://docs.osaca.example"
LABEL org.opencontainers.image.source="https://github.com/PJJunio/osaca"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.osaca.build-version="${BUILD_VERSION}"

WORKDIR /opt/osaca_gateway

RUN apt-get update && apt-get install -y --no-install-recommends \
	ca-certificates \
	curl \
	libstdc++6 \
	&& rm -rf /var/lib/apt/lists/* && \
	groupadd -r -g 65532 osaca && \
	useradd -r -u 65532 -g 65532 -s /sbin/nologin -d /opt/osaca_gateway osaca && \
	chown 65532:65532 /opt/osaca_gateway

COPY --from=build --chown=65532:65532 /usr/src/app/osaca_gateway/_build/prod/rel/osaca_gateway .
COPY --chown=65532:65532 osaca_gateway/scripts/docker_entrypoint.sh /opt/osaca_gateway/bin/docker_entrypoint.sh
COPY --chown=65532:65532 osaca_gateway/scripts/osaca_gateway_release_wrapper.sh /opt/osaca_gateway/bin/osaca_gateway.wrapper

RUN mv /opt/osaca_gateway/bin/osaca_gateway /opt/osaca_gateway/bin/osaca_gateway.real && \
	mv /opt/osaca_gateway/bin/osaca_gateway.wrapper /opt/osaca_gateway/bin/osaca_gateway

USER 65532:65532

ENV BUILD_VERSION="${BUILD_VERSION}"

EXPOSE 8080 8081 4369

ENTRYPOINT ["/opt/osaca_gateway/bin/docker_entrypoint.sh"]
