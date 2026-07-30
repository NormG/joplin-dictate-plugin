#!/usr/bin/env bash
# Quiet build wrapper for push-gate's GATE_MUST_PASS.
#
# Runs the Joplin plugin build (npm run dist). The gate's must-pass rule
# requires the command to produce NO output and exit 0. npm prints "notice"
# lines to stderr and webpack prints progress to stdout, so we suppress all
# output on success. If the build fails, we re-run verbosely so the failure
# is visible, and propagate the non-zero exit code so the gate blocks.
set -uo pipefail

tmp="$(mktemp)"
if npm run dist >"$tmp" 2>&1; then
    rm -f "$tmp"
    exit 0
else
    rc=$?
    echo "Build failed (exit $rc). Output:" >&2
    cat "$tmp" >&2
    rm -f "$tmp"
    exit $rc
fi
