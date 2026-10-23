#!/usr/bin/env bash
# Usage: install-check.sh INDEX_URL VERSION
#
# Installs workclock VERSION from the index with `uv pip install` and with
# `uv add`, and checks that each import reports that version.
set -euo pipefail
index="$1"
version="$2"
check='import workclock; print(workclock.__version__)'
cd "$(mktemp -d)"

uv venv --python 3.9 venv
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate
# A new upload can take a few minutes to show up in the index.
for attempt in $(seq 10); do
  uv pip install --no-cache --index-url "$index" "workclock==$version" && break
  [ "$attempt" -lt 10 ] || exit 1
  sleep 30
done
test "$(python -c "$check")" = "$version"
deactivate

uv init --bare --python 3.13 project
cd project
uv add --no-cache --default-index "$index" "workclock==$version"
test "$(uv run python -c "$check")" = "$version"
