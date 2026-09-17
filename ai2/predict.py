#!/usr/bin/env python3
"""Run FLUX.2 image-to-image on a sketch and save the result.

Takes an input image (the user's drawing, a PNG/JPEG) and a prompt, and uses
FLUX.2 with the image as *sketch/conditioning* to produce a finished image.
The prompt is fixed for the app by default:

    "Convert to a pencil drawing, add water colors."

Everything runs on the CPU by design.

Contract (so the PHP endpoint can rely on it):
  * all log / progress lines go to **stderr**;
  * exactly **one JSON object** is written to **stdout** when it finishes:
      { "ok": true,  "out": "/abs/path.png", "width": W, "height": H, "seconds": S }
    or, on failure,
      { "ok": false, "error": "..." }
  * the exit code is 0 on success and non-zero on failure.

Examples:
    ./venv/bin/python predict.py --sketch sketch.png --out out.png
    ./venv/bin/python predict.py --sketch sketch.png --out out.png --steps 30
    # the higher-quality 32B model (needs a lot of RAM):
    ./venv/bin/python predict.py --sketch sketch.png --out out.png \
        --model black-forest-labs/FLUX.2-dev --steps 30
    # fastest: the 4-step distilled klein model
    ./venv/bin/python predict.py --sketch sketch.png --out out.png \
        --model black-forest-labs/FLUX.2-klein-9b-kv --steps 4
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

# Fixed prompt for the Draw-Your-Brain app.
DEFAULT_PROMPT = "Convert to a pencil drawing, add water colors."

# Fast path — the "runs on a CPU" default (matches share.php / worker.py):
# the distilled 9B klein-kv model, 4 steps, 512px.  Swap to the higher-quality
# models (see README) when you have the RAM / a GPU.
DEFAULT_MODEL = "black-forest-labs/FLUX.2-klein-9b-kv"
DEFAULT_STEPS = 4
DEFAULT_MAX_SIDE = 512


def _log(msg: str) -> None:
    print(json.dumps({"log": msg}), file=sys.stderr, flush=True)


def _progress(step: int, total: int) -> None:
    print(json.dumps({"progress": step, "total": max(total, 1)}), file=sys.stderr, flush=True)


def _ok(out: str, w: int, h: int, seconds: float) -> None:
    print(json.dumps({"ok": True, "out": out, "width": w, "height": h,
                      "seconds": round(seconds, 2)}))


def _fail(msg: str) -> None:
    print(json.dumps({"ok": False, "error": msg}))


def _friendly_error(exc: Exception) -> str:
    """Augment auth/gated failures with something the user can actually act on.

    diffusers wraps the real cause in a generic ``OSError`` ("...fetch metadata
    from the Hub"), so the 401/gated text lives further down the exception
    chain — walk the whole chain when looking for auth keywords.
    """
    base = f"{type(exc).__name__}: {exc}"

    def _chain_text(e: BaseException) -> str:
        parts = [type(e).__name__]
        try:
            parts.append(str(e))
        except Exception:
            pass
        seen = {id(e)}
        nxt = e.__cause__ or e.__context__
        while nxt is not None and id(nxt) not in seen:
            seen.add(id(nxt))
            parts.append(type(nxt).__name__)
            try:
                parts.append(str(nxt))
            except Exception:
                pass
            nxt = nxt.__cause__ or nxt.__context__
        return " ".join(parts).lower()

    blob = _chain_text(exc)
    if any(k in blob for k in ("gatedrepoerror", "gated repo", "repositorynotfounderror",
                               "401", "unauthorized", "oauth token has expired",
                               "access to model", "restricted", "please log in")):
        base += (
            "\n\nThis FLUX.2 model is gated and needs a valid Hugging Face credential.\n"
            "Fix:\n"
            "  1. Accept the model's terms on its repo page on huggingface.co\n"
            "     (e.g. black-forest-labs/FLUX.2-klein-base-9B), if you haven't.\n"
            "  2. Get a fresh token — a static API token does NOT expire:\n"
            "       huggingface.co -> Settings -> Access tokens -> New token\n"
            "  3. Then either:\n"
            "       export HF_TOKEN=hf_...\n"
            "       ./venv/bin/hf auth login            # refresh the stored OAuth token\n"
            "       ... --token hf_...                   # or pass it explicitly\n"
            "  (OAuth tokens like `hf_oauth_...` expire; static `hf_...` tokens don't.)"
        )
    return base


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--sketch", required=True, type=Path,
                    help="input image (the drawing to use as a sketch)")
    ap.add_argument("--out", required=True, type=Path,
                    help="where to write the resulting PNG")
    ap.add_argument("--model", default=DEFAULT_MODEL,
                    help="FLUX.2 model repo id (default: %(default)s)")
    ap.add_argument("--prompt", default=DEFAULT_PROMPT,
                    help="text prompt (default: the app's fixed prompt)")
    ap.add_argument("--steps", type=int, default=DEFAULT_STEPS,
                    help="denoising steps (default: %(default)s)")
    ap.add_argument("--guidance", type=float, default=None,
                    help="guidance scale; omit to let the model use its own default")
    ap.add_argument("--width", type=int, default=None, help="output width (multiple of 32)")
    ap.add_argument("--height", type=int, default=None, help="output height (multiple of 32)")
    ap.add_argument("--max-side", type=int, default=DEFAULT_MAX_SIDE,
                    help="longest output side when --width/--height are not set (default: %(default)s)")
    ap.add_argument("--seed", type=int, default=None, help="random seed for reproducibility")
    ap.add_argument("--dtype", default="auto",
                    choices=["auto", "float32", "bfloat16", "float16"],
                    help="compute dtype (default: auto = bfloat16 on supported CPUs, else float32)")
    ap.add_argument("--offline", action="store_true",
                    help="do not contact Hugging Face; use locally cached weights only")
    ap.add_argument("--token", default=None,
                    help="Hugging Face token for gated models.  Defaults to the usual "
                         "lookup (HF_TOKEN env var, then the token stored by `hf auth login`).")
    return ap


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)

    if not args.sketch.exists():
        _fail(f"sketch not found: {args.sketch}")
        return 2

    # Import the heavy deps only now, so `--help` stays instant and dependency-free.
    import torch
    from PIL import Image

    import pipeline as fx

    t0 = time.time()
    try:
        sketch = Image.open(args.sketch)
        sketch.load()

        device = torch.device("cpu")
        dtype = fx.pick_dtype(device, args.dtype)
        _log(f"loading {args.model} on CPU (dtype={dtype}) ...")
        pipe = fx.load_pipeline(args.model, device, dtype,
                                local_files_only=args.offline, token=args.token)

        w, h = fx.target_size(sketch, args.max_side, args.width, args.height)
        _log(f"generating {w}x{h} in {args.steps} steps ...")

        img = fx.generate(
            pipe, sketch, args.prompt, w, h,
            steps=args.steps, guidance=args.guidance,
            seed=args.seed, progress_cb=_progress,
        )

        args.out.parent.mkdir(parents=True, exist_ok=True)
        img.save(args.out)
        _ok(str(args.out), w, h, time.time() - t0)
        return 0

    except KeyboardInterrupt:
        _fail("interrupted")
        return 130
    except Exception as e:  # noqa: BLE001 - report any failure as structured JSON
        _fail(_friendly_error(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())
