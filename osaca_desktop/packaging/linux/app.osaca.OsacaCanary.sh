#!/bin/sh

export TMPDIR="${XDG_RUNTIME_DIR}/app/${FLATPAK_ID}"
export OSACA_FLATPAK_COMMAND="${FLATPAK_ID}"

exec zypak-wrapper "/app/osaca/osaca-canary" "$@"
