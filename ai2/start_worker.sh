#!/usr/bin/env bash
# Launch the FLUX.2 worker as a *background daemon* that keeps polling data/
# for .code drawings missing their .png.  This is the optional always-on mode.
#
#   The primary way to run it is from **cron**, which does a single sweep and
#   exits (see the crontab line in README.md).  This script is for when you'd
#   rather keep a worker resident.  Only one worker runs at a time (it
#   self-locks on ai2/worker.lock); a second invocation exits immediately.
#
#   ./ai2/start_worker.sh                  # daemon, fast path, default settings
#   ./ai2/start_worker.sh --unload-idle 600   # free the model after 10 min idle (RAM)
#
# Logs go to ai2/worker.log.
set -euo pipefail
cd "$(dirname "$0")/.."            # repo root
PY=./ai2/venv/bin/python
nohup "$PY" ai2/worker.py --watch "$@" >> ai2/worker.log 2>&1 &
echo "worker started (pid $!) — logs: ai2/worker.log"
echo "  stop with:  kill \$(cat ai2/worker.lock)   (if it holds the lock)"
