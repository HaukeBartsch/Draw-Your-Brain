#!/usr/bin/env python3
"""Generate the FLUX.2 image for every saved drawing that doesn't have one yet.

The web app (`share.php`) only ever writes the drawing (`data/<id>.code`).
This worker is the *only* thing that produces the finished image, and it is a
**completely independent process** — it knows nothing about the web server or
any job queue.  It finds its work by *polling the data directory*:

    for each  data/<id>.code
        if  data/<id>.png  does not exist:
            rasterize the .code -> sketch -> FLUX.2 image-to-image -> data/<id>.png

So "a `.code` without a `.png`" **is** the queue.  There is no inbox/processing/
done/failed state to keep in sync: the pair of files on disk is the whole
protocol, a finished drawing is idempotent (its `.png` already exists -> skip),
and a failed one simply has no `.png` yet, so the next run retries it for free.

That means **starting this program once is sufficient to generate every missing
`.png`** in `data/` — which is exactly what the cron job relies on:

    * * * * *   cd /path/to/repo && ./ai2/venv/bin/python ai2/worker.py \
                  >> ai2/worker.log 2>&1

The default run is a **single sweep**: it processes every currently-missing
`.png` and exits.  Fire it on a schedule (cron) and each firing picks up
whatever is new since the last.  A lock file (`ai2/worker.lock`) keeps two
concurrent runs from double-processing, so an hourly cron and a run that takes
longer than an hour can't collide.  (`--watch` instead keeps polling forever.)

Each `.code` drawing is rasterized to a white-background sketch (Pillow-only,
`rasterize.py`) and turned into the finished image with FLUX.2 (the "runs on a
CPU" fast path by default: the 9B `klein-kv` model, 4 steps, 512px — roughly
6 min/image on a modern CPU).  Results are written to a temp file and atomically
renamed into place, so a crash mid-save can never leave a truncated `.png` that
the next sweep would mistake for "done".

Usage:
    worker.py                     # one sweep: every data/*.code missing its .png, then exit (cron)
    worker.py --watch             # keep polling data/ forever (daemon)
    worker.py --watch --poll 5    # daemon, 5s between scans
    worker.py --max-jobs 3        # at most 3 images this sweep (0 = all missing)
    worker.py --dry-run           # list what would be generated, generate nothing
    worker.py --data-dir DIR      # a different data directory
    worker.py --model ... --steps N --max-side N --prompt "..."
    worker.py --dtype bfloat16 --offline --token hf_...
"""

from __future__ import annotations

import argparse
import gc
import os
import signal
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

REPO_ROOT = HERE.parent
DEFAULT_DATA_DIR = REPO_ROOT / "data"
LOCK_FILE = HERE / "worker.lock"   # one worker at a time, regardless of mode

# Fast path — the "runs on a CPU" default (was shared with share.php; the worker
# now owns it).  Change here, or override per run with the --* flags.
FAST_MODEL = "black-forest-labs/FLUX.2-klein-9b-kv"
FAST_STEPS = 4
FAST_MAX_SIDE = 512
DEFAULT_PROMPT = "Convert to a pencil drawing, add water colors."

_STOP = {"flag": False}


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def _signal_handler(signum, _frame) -> None:
    # Stop after the current image finishes (clean shutdown).
    _STOP["flag"] = True


class PipelineHolder:
    """Load a FLUX.2 pipeline once and reuse it across a whole sweep.

    Reloading the ~9B model per drawing would cost ~40s each; holding it for
    the run amortizes that.  `unload()` frees it (RAM) when we're done or idle.
    """

    def __init__(self, device, dtype, token=None, offline: bool = False):
        import pipeline as fx

        self._fx = fx
        self.device = device
        self.dtype = dtype
        self.token = token
        self.offline = offline
        self.pipe = None
        self.model = None

    def for_model(self, model: str):
        if self.pipe is None or self.model != model:
            self.unload()
            log(f"loading {model} ...")
            self.pipe = self._fx.load_pipeline(
                model, self.device, self.dtype,
                local_files_only=self.offline, token=self.token,
            )
            self.model = model
            log("model loaded")
        return self.pipe

    def unload(self) -> None:
        self.pipe = None
        self.model = None
        gc.collect()


def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def acquire_lock() -> bool:
    """Atomically take the worker lock.  Steals a stale lock (dead holder)."""

    def _take() -> bool:
        try:
            fd = os.open(LOCK_FILE, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            return False
        with os.fdopen(fd, "w") as f:
            f.write(str(os.getpid()))
        return True

    if _take():
        return True
    try:
        pid = int(LOCK_FILE.read_text().strip() or 0)
    except (OSError, ValueError):
        pid = 0
    if _pid_alive(pid):
        return False  # a live worker holds it
    LOCK_FILE.unlink(missing_ok=True)  # stale
    return _take()


def release_lock() -> None:
    LOCK_FILE.unlink(missing_ok=True)


def find_work(data_dir: Path) -> list[Path]:
    """Every `data/*.code` that has no `.png` yet, oldest first.

    This *is* the queue.  `.code` and `.png` share the stem, so the pairing is
    unambiguous and needs no bookkeeping.  (Filenames may contain spaces — e.g.
    a copy like `... 2.code` — so we match on the exact stem, not a glob.)
    """
    codes = sorted(
        data_dir.glob("*.code"),
        key=lambda p: (p.stat().st_mtime, p.name),
    )
    return [c for c in codes if not c.with_suffix(".png").exists()]


def render_one(code_path: Path, holder: PipelineHolder, args) -> tuple[bool, str]:
    """Generate `code_path.with_suffix('.png')`.  Returns (ok, error_message).

    Written to a temp file then atomically renamed, so a crash mid-save can't
    leave a half-written `.png` that the next sweep would skip.
    """
    import rasterize

    fx = holder._fx
    png_path = code_path.with_suffix(".png")
    model = args.model
    steps = int(args.steps)
    max_side = int(args.max_side)
    prompt = args.prompt
    seed = args.seed

    log(f"generating {png_path.name}  ({model} steps={steps} max_side={max_side})")
    t0 = time.time()
    sketch = rasterize.rasterize_code(code_path, max_side)
    pipe = holder.for_model(model)
    w, h = fx.target_size(sketch, max_side, None, None)

    img = fx.generate(
        pipe, sketch, prompt, w, h,
        steps=steps, guidance=None, seed=seed,
        progress_cb=lambda s, t: log(f"  step {s}/{t}"),
    )
    # The temp file must end in ".png" so Pillow picks the PNG format (a bare
    # ".tmp" makes save() raise "unknown file extension"); the rename into the
    # final name is atomic, so a crash can't leave a truncated .png.
    tmp = png_path.parent / (png_path.name + ".tmp.png")
    try:
        img.save(tmp)
        os.replace(tmp, png_path)  # atomic: the .png appears fully-formed
    finally:
        tmp.unlink(missing_ok=True)
    log(f"done in {time.time() - t0:.1f}s -> {png_path}")
    return True, ""


def sweep(holder, args) -> int:
    """One pass over `data/`: render every `.code` missing its `.png`.

    Returns the number of images generated (0 = nothing to do).  A per-file
    failure is logged and skipped so it can be retried next run; it never stops
    the sweep.
    """
    data_dir = Path(args.data_dir)
    if not data_dir.is_dir():
        log(f"error: data directory not found: {data_dir}")
        return 0

    work = find_work(data_dir)

    if args.dry_run:
        log(f"dry run: {len(work)} .code file(s) missing their .png:")
        for c in work:
            log(f"  {c.name}")
        return len(work)

    if not work:
        log("nothing to do: every .code already has a .png")
        return 0

    to_do = work if args.max_jobs <= 0 else work[: args.max_jobs]
    log(f"{len(work)} missing .png, processing {len(to_do)} "
        + (f"(capped by --max-jobs {args.max_jobs})" if len(to_do) < len(work) else ""))

    done = 0
    for c in to_do:
        if _STOP["flag"]:
            log("stop requested; finishing before exit")
            break
        try:
            ok, err = render_one(c, holder, args)
        except Exception as e:  # noqa: BLE001 - one bad drawing must not kill the sweep
            ok, err = False, f"{type(e).__name__}: {e}"
        if ok:
            done += 1
        else:
            log(f"  FAILED {c.name}: {err}  (no .png written — will retry next run)")
    return done


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--watch", action="store_true",
                    help="keep polling the data dir forever (daemon); default is one sweep then exit")
    ap.add_argument("--poll", type=float, default=3.0,
                    help="--watch: seconds between scans (default: %(default)s)")
    ap.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR,
                    help="directory of .code drawings (default: %(default)s)")
    ap.add_argument("--max-jobs", type=int, default=0,
                    help="max images to generate per sweep (0 = all missing; default: %(default)s)")
    ap.add_argument("--dry-run", action="store_true",
                    help="list the .code files missing their .png, generate nothing")

    # model knobs (defaults = the "runs on a CPU" fast path)
    ap.add_argument("--model", default=FAST_MODEL,
                    help="FLUX.2 model repo id (default: %(default)s)")
    ap.add_argument("--steps", type=int, default=FAST_STEPS,
                    help="denoising steps (default: %(default)s)")
    ap.add_argument("--max-side", type=int, default=FAST_MAX_SIDE,
                    help="longest output side in px (default: %(default)s)")
    ap.add_argument("--prompt", default=DEFAULT_PROMPT,
                    help="text prompt (default: the app's fixed prompt)")
    ap.add_argument("--seed", type=int, default=None, help="random seed for reproducibility")
    ap.add_argument("--dtype", default="auto",
                    choices=["auto", "float32", "bfloat16"])
    ap.add_argument("--token", default=None,
                    help="Hugging Face token for gated models (default: env/stored)")
    ap.add_argument("--offline", action="store_true",
                    help="do not contact Hugging Face; use locally cached weights only")
    ap.add_argument("--unload-idle", type=float, default=0.0,
                    help="--watch: free the model after this many idle seconds (0 = never)")
    args = ap.parse_args(argv)

    # Dry run touches neither the lock nor the model — it just lists the work.
    if args.dry_run:
        sweep(None, args)
        return 0

    # Take the lock BEFORE importing torch: a run that loses to a live worker
    # should exit in milliseconds, not after loading torch and allocating RAM.
    if not acquire_lock():
        log(f"another worker holds the lock ({LOCK_FILE}); exiting.")
        return 0

    import torch

    import pipeline as fx

    signal.signal(signal.SIGTERM, _signal_handler)
    signal.signal(signal.SIGINT, _signal_handler)

    device = torch.device("cpu")
    dtype = fx.pick_dtype(device, args.dtype)
    holder = PipelineHolder(device, dtype, token=args.token, offline=args.offline)
    log(f"worker started (pid {os.getpid()}), data_dir={args.data_dir}, "
        f"watch={args.watch}, max_jobs={args.max_jobs or 'unlimited'}")

    try:
        if not args.watch:
            sweep(holder, args)
        else:
            last_active = time.time()
            while not _STOP["flag"]:
                if sweep(holder, args) == 0:
                    if args.unload_idle > 0 and (time.time() - last_active) > args.unload_idle:
                        holder.unload()
                        log("idle: model unloaded (RAM freed)")
                    last_active = time.time()
                    time.sleep(max(0.2, args.poll))
                else:
                    last_active = time.time()
    finally:
        holder.unload()
        release_lock()
        log("worker stopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
