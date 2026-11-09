#!/usr/bin/env sh

# SPDX-License-Identifier: AGPL-3.0-or-later

set -eu

command="${1:-}"
case "$command" in
eval | console | remote_console | remote | remsh | console_clean | console_boot | daemon | daemon_boot | daemon_attach | escript)
	echo "osaca_gateway: '$command' is disabled in production; use bounded rpc/runtime tools instead." >&2
	exit 64
	;;
esac

script_dir="$(CDPATH='' cd "$(dirname "$0")" && pwd -P)"
node_name_file="$script_dir/../node_name"
if [ -r "$node_name_file" ]; then
	OSACA_ERLANG_NODE_NAME="$(cat "$node_name_file")"
	export OSACA_ERLANG_NODE_NAME
fi
if [ -r "${OSACA_ERLANG_COOKIE_FILE:-}" ] && [ -z "$(printf '%s' "${OSACA_ERLANG_COOKIE:-}" | tr -d '[:space:]')" ]; then
	OSACA_ERLANG_COOKIE="$(cat "$OSACA_ERLANG_COOKIE_FILE")"
	export OSACA_ERLANG_COOKIE
fi
exec "$script_dir/osaca_gateway.real" "$@"
