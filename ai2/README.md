# ai2/ — FLUX.2 image model (sketch → finished image)

A second AI model, separate from the stroke-prediction model in [`../ai/`](../ai/README.md).
Where `ai/` *predicts the next stroke*, `ai2/` uses a **FLUX.2** image model to
turn the whole finished drawing into an image.

The web app only ever **saves the drawing** (`.code`) when the user presses
"Share".  Everything after that is an **independent process driven by cron**:
`ai2/worker.py` polls `data/` for a `.code` that has no matching `.png`, and
for each one it renders the drawing to a sketch, runs FLUX.2 (image-to-image,
off the CPU) with the fixed prompt

> **"Convert to a pencil drawing, add water colors."**

— and saves the result **next to the `.code` original** (`data/<id>.png`).
The browser returns immediately (no multi-minute wait); the finished image
simply appears in `data/` once the worker gets to it.

## How it fits together

| piece                | role                                                            |
|----------------------|-----------------------------------------------------------------|
| `ai2/pipeline.py`    | FLUX.2 pipeline loading + image-to-image (CPU-friendly)         |
| `ai2/predict.py`     | one-shot CLI — sketch image in, finished PNG out (for testing)  |
| `ai2/rasterize.py`   | render a `.code` drawing to a white-background sketch (Pillow)  |
| `ai2/worker.py`      | **the generator** — scans `data/` for `.code` without a `.png`, runs FLUX.2, writes `data/<id>.png` |
| `ai2/start_worker.sh`| (optional) launch the worker as a `--watch` daemon              |
| `share.php`          | "Share" endpoint: **saves the `.code` and nothing else**        |
| `predict2.php`       | (kept) synchronous one-shot endpoint for testing                |
| `js/all.js`          | "Share" handler → `shareDrawing()` (busy overlay + confirm modal)  |
| `drawBrain.html`     | the `#flux2-busy` overlay and `#flux2-result` confirmation modal |

The pipeline class is chosen automatically from the model id, so every FLUX.2
variant works through the same call (all take `image=` + `prompt=` for
image-to-image).

## How work is found (there is no queue to manage)

The `.code`/`.png` pair **is** the queue.  A drawing that has a `.png` is done;
one without is pending.  No inbox/processing/done/failed state to keep in sync:

```
Share ─▶ share.php ─▶ data/<id>.code               (saved immediately)
                          │
   cron ─▶ worker.py ─────┤  scans data/*.code, keeps the ones without a .png
                          │  (oldest first)
                          ▼
                    data/<id>.png                  (the result, written atomically)
```

* **Idempotent** — a `.code` whose `.png` already exists is skipped, so re-running
  is always safe.
* **Self-healing** — if a generation fails (or the box reboots mid-image), the
  `.png` simply isn't there yet, so the next run retries it.  A run also writes
  to a temp file and renames into place, so a crash can't leave a truncated
  `.png` that looks "done".
* **Self-locks** (`ai2/worker.lock`) — a second worker exits immediately, so an
  hourly cron and a run that outlives it can't double-process.
* **One model at a time** — the FLUX.2 model is loaded once per run and held
  across that run's drawings (so it isn't reloaded per image).
* **Fast path** (the default, the "runs on CPU" config): the 9B
  `FLUX.2-klein-9b-kv` model, **4 steps, 512px** — roughly **6 min/image** on a
  modern CPU.  Change the defaults at the top of `ai2/worker.py` (or per run
  with `--model/--steps/--max-side/--prompt`).

### Running the worker (cron is the driver)

The default run is a **single sweep** — generate every currently-missing
`.png`, then exit.  Fire it on a schedule and each firing picks up whatever is
new since the last:

```cron
# every 5 minutes: sweep data/ for .code files missing their .png, generate them
*/5 * * * *  cd /path/to/repo && ./ai2/venv/bin/python ai2/worker.py --max-jobs 20 >> ai2/worker.log 2>&1
```

`--max-jobs` caps how many images a single sweep produces (so a big backlog drains
over successive firings instead of one very long run); omit it to do *all*
missing in one go.  Other useful flags:

```sh
./ai2/venv/bin/python ai2/worker.py --dry-run        # list what would be generated, generate nothing
./ai2/venv/bin/python ai2/worker.py --max-jobs 1     # just the oldest missing one
./ai2/venv/bin/python ai2/worker.py --offline        # use the cached model, no Hugging Face

# optional: keep a worker resident instead of cron (logs to ai2/worker.log):
./ai2/start_worker.sh                 # daemon (--watch), default settings
./ai2/start_worker.sh --unload-idle 600   # free the model after 10 min idle (RAM)

# watch progress:
tail -f ai2/worker.log
```

> Because the work is defined purely by the files in `data/`, **starting the
> worker once is enough to generate every missing `.png`** — the cron schedule
> just keeps it up to date as new drawings arrive.

## Setup

Python 3.10+.  Install the **CPU** build of PyTorch first (so you don't
accidentally pull a CUDA wheel), then the rest:

```sh
cd ai2
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
./venv/bin/pip install -r requirements.txt
```

`diffusers>=0.40.0` is required (that is where the `Flux2*` pipelines live).

> **Device:** the worker auto-picks the compute device — the Apple GPU (`mps`)
> when it is available, else the CPU. On Apple Silicon the PyTorch build above
> already includes the MPS backend, so no extra install is needed. Force a
> device with `--device mps|cpu|cuda` (default `auto`).

## Authentication (gated models)

The FLUX.2 weights are **gated** on Hugging Face — a valid credential and
accepted terms are required to *download the files* (metadata is public).  If
you get a `401` / `GatedRepoError` / `RepositoryNotFoundError`, that is why.

A token **stored by `hf auth login` that is an OAuth JWT (`hf_oauth_…`)
expires** — a static API token (`hf_…`) does not.  To fix:

```sh
# 1. On huggingface.co, open the repo and accept its terms (if prompted).
# 2. Make a static token:  huggingface.co -> Settings -> Access tokens -> New token
# 3. Use it (pick one):
export HF_TOKEN=hf_...                                  # for this shell
./venv/bin/hf auth login                                  # refresh the stored token
./venv/bin/python predict.py --sketch sketch.png --out out.png --token hf_...
```

`predict.py` and `worker.py` both pick the token up from `--token`, then
`HF_TOKEN`, then the token stored by `hf auth login`.  The worker runs as
**whatever user cron runs as**, so make sure that user can see the token
(`export HF_TOKEN=hf_...` in the crontab, or a token stored by `hf auth login`
in that user's home).  The web endpoint no longer runs the model — `share.php`
only saves the `.code`, so it needs no credential at all.

## Run from the command line

```sh
# default: fast path — 9B klein-kv, 4 steps, 512px, bfloat16 (CPU)
./venv/bin/python predict.py --sketch sketch.png --out out.png

# more detail (slower): a bigger model, more steps, larger output
./venv/bin/python predict.py --sketch sketch.png --out out.png \
    --model black-forest-labs/FLUX.2-klein-base-9B --steps 30 --max-side 1024

# reproducible
./venv/bin/python predict.py --sketch sketch.png --out out.png --seed 42

# pick the compute device (default auto = MPS if available, else CPU)
./venv/bin/python predict.py --sketch sketch.png --out out.png --device mps
./venv/bin/python predict.py --sketch sketch.png --out out.png --device cpu
```

The CLI prints **one JSON object to stdout** when it finishes
(`{"ok": true, "out": ..., "width": ..., "height": ..., "seconds": ...}`, or
`{"ok": false, "error": ...}` on failure) and sends all log/progress lines to
stderr — that is the contract `predict2.php` relies on.

## Which FLUX.2 model to use (CPU is the constraint)

FLUX.2 is a large diffusion model.  "Runs on a CPU" is true of every variant,
but the **time and RAM differ a lot**, so pick the model to match the machine:

| model (`--model`)                              | params | steps | notes |
|------------------------------------------------|--------|-------|-------|
| `black-forest-labs/FLUX.2-klein-9b-kv` *(default — fast path)* | 9B | ~4 | **fastest** — distilled, 4-step. The app/worker default; best for a slow CPU |
| `black-forest-labs/FLUX.2-klein-base-9B` | 9B | 20–50 | standard 9B image-to-image, better detail |
| `black-forest-labs/FLUX.2-dev` | 32B | 30–50 | highest quality; needs a lot of RAM (a GPU is much kinder) |

Memory is the binding constraint on a CPU.  Rough weights-only footprint:
9B ≈ 18 GB in `bfloat16` / 36 GB in `float32`; 32B ≈ 64 GB / 128 GB.  Add headroom
for the VAE and activations.

- **device**: the default is **`auto`** — the Apple GPU (`mps`) when available,
  else the CPU.  On an Apple Silicon Mac this uses the GPU for free (much faster
  than CPU); a plain CPU box is unaffected.  Force one with `--device mps|cpu|cuda`.
- **dtype**: the default is **`bfloat16`** — it halves the memory
  footprint (a 32 GB model becomes ~16 GB), which is what actually fits, and is
  supported by modern x86 and Apple Silicon.  Use `--dtype float32` only if a
  CPU lacks bf16 (it costs 2× RAM).
- **resolution**: the fast path uses a **512px** long side.  Raise it with
  `--max-side 1024` for more detail (or lower it, e.g. `--max-side 256`, to go
  faster) — CPU time scales roughly with the pixel count.
- **steps**: the fast path uses **4** steps (the `-kv` model is built for it).
  More steps = more detail but slower.

> Be realistic about wall-clock time: a 9B image at ~512px takes **roughly 6
> minutes** on a modern CPU *when memory isn't thrashing* (it can be much
> slower if the box is memory-starved and swapping).  The 32B model on CPU is
> best avoided.  Because it runs as a **background job**, the browser is never
> blocked — it just appears in `data/` when done.

## Files

| file            | purpose                                                    |
|-----------------|------------------------------------------------------------|
| `pipeline.py`   | FLUX.2 pipeline selection, CPU dtype, sketch prep, img2img |
| `rasterize.py`  | render a `.code` drawing to a white-background sketch (Pillow) |
| `worker.py`     | **the entry point** — scan `data/`, generate missing `.png`, write next to `.code` |
| `predict.py`    | CLI entry point (sketch → PNG, JSON contract)              |
| `start_worker.sh` | launch `worker.py --watch` as a background daemon        |
| `requirements.txt` | Python dependencies (CPU torch installed separately)     |


### Setup on a new machine

Make sure the users .cache directory has sufficient space (500gb).

```bash
export HF_TOKEN=XXXXXTOKENXXXXXXX
cd ai2
apt install python3-pip
apt install python3-venv
python3 -m venv .venv
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -r requirements.txt
./ai2/venv/bin/python ai2/worker.py --max-jobs 2
```

