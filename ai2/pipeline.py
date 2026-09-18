"""FLUX.2 image-to-image pipeline.

Thin wrapper around a diffusers FLUX.2 pipeline.  It takes a *sketch* (the
user's drawing, rendered to a white background) and turns it into a finished
image guided by a fixed text prompt:

    "Convert to a pencil drawing, add water colors."

The input image is used as FLUX.2's *image conditioning* (reference tokens
appended to the denoising sequence), so the sketch supplies the composition
and the prompt supplies the style.

It runs on whatever compute is available, in this order:

* the device defaults to the Apple GPU (``mps``) when it is available, else
  the CPU — so a plain CPU box just works and an Apple Silicon Mac uses the
  GPU; ``pick_device`` (and each CLI's ``--device``) can force one;
* the dtype defaults to ``bfloat16`` when the device supports it (halving the
  memory footprint vs. ``float32``) and falls back to ``float32`` otherwise;
* the pipeline class is picked automatically from the model repo id, so the
  9B "klein" models (realistic on CPU) and the 32B "dev" model (quality
  ceiling) all work through the same call.

The heavy imports (torch, diffusers) happen inside the functions, so callers
can import this module for the small helpers without paying the cost until
they actually load a model.
"""

from __future__ import annotations

from pathlib import Path


def pipeline_class_for(repo_id: str):
    """Return the right diffusers FLUX.2 pipeline class for a model repo id.

    All three FLUX.2 variants accept ``image=`` + ``prompt=`` for
    image-to-image, so the call site is uniform; only the class differs.
    """
    from diffusers import (
        Flux2KleinKVPipeline,
        Flux2KleinPipeline,
        Flux2Pipeline,
    )

    r = repo_id.lower()
    if "klein" in r and "kv" in r:
        return Flux2KleinKVPipeline
    if "klein" in r:
        return Flux2KleinPipeline
    return Flux2Pipeline


def pick_dtype(device, requested: str = "auto"):
    """Choose a compute dtype for the target device.

    ``requested`` may be ``"auto"`` or one of ``"float32" | "bfloat16" |
    "float16"``.

    On CPU the default is ``bfloat16``: it halves the model's memory footprint
    (a 32 GB model becomes ~16 GB) — which is what actually fits on a
    memory-limited CPU — and is supported by modern x86 and Apple Silicon.
    Use ``--dtype float32`` if a particular CPU lacks bf16 (it costs 2× RAM).
    On accelerators we also default to bf16.
    """
    import torch

    if requested and requested.lower() != "auto":
        return getattr(torch, requested)

    return torch.bfloat16


def pick_device(requested: str = "auto"):
    """Choose a compute device.

    ``requested`` may be ``"auto"`` (the default) or one of ``"mps" | "cpu" |
    "cuda"``.

    With ``auto`` the device is chosen for the machine: the Apple GPU
    (``mps``) when it is available — Apple Silicon on macOS with an MPS-capable
    PyTorch build — and the CPU otherwise.  So the same code runs unchanged on
    a plain CPU box and on a Mac, and the Mac gets the GPU for free.  Pass a
    specific device (via ``--device``) to force one.
    """
    import torch

    if requested and requested.lower() != "auto":
        return torch.device(requested)

    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def load_pipeline(repo_id: str, device, dtype, local_files_only: bool = False, token=None):
    """Load a FLUX.2 pipeline onto ``device`` in ``dtype`` and return it.

    ``token`` is passed straight through to diffusers.  Leave it ``None`` (the
    default) and the usual Hugging Face credential lookup applies (``HF_TOKEN``
    env var or the token stored by ``hf auth login``) — that is what gated
    FLUX.2 models need.  Pass an explicit token (or ``False`` for anonymous) to
    override.
    """
    import gc
    import warnings

    cls = pipeline_class_for(repo_id)

    # diffusers 0.40 uses ``torch_dtype``; it is renamed to ``dtype`` in 1.0.0.
    # Pass the kwarg the installed version prefers and keep the logs clean.
    def _load(lfo: bool):
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="torch_dtype")
            try:
                return cls.from_pretrained(
                    repo_id, torch_dtype=dtype, local_files_only=lfo, token=token
                )
            except TypeError:  # a future version that only knows ``dtype``
                return cls.from_pretrained(
                    repo_id, dtype=dtype, local_files_only=lfo, token=token
                )

    # Prefer the **local cache**: it avoids a Hub round-trip (which a stored
    # expired token can break with a 401) and — importantly — avoids loading the
    # model twice into RAM.  Only when the model isn't cached do we go to the Hub.
    # (A failed local attempt raises before allocating the weights, so this
    # order doesn't risk a double-resident model.)
    try:
        pipe = _load(True)
    except Exception:
        if local_files_only:
            raise  # offline was forced and there's nothing cached
        gc.collect()
        pipe = _load(False)
    pipe = pipe.to(device)
    pipe.set_progress_bar_config(disable=True)
    return pipe


def prepare_sketch(img):
    """Normalise a sketch image for FLUX.2: RGB, white background, bounded size.

    Browser canvases come through as PNGs with a transparent background; we
    composite them onto white so the model sees clean line art rather than
    alpha.  Very large inputs are downscaled to keep the CPU cost bounded.
    """
    from PIL import Image

    if img.mode != "RGB":
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            rgba = img.convert("RGBA")
            bg = Image.new("RGB", rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.split()[-1])
            img = bg
        else:
            img = img.convert("RGB")

    if max(img.size) > 2048:
        scale = 2048 / max(img.size)
        img = img.resize(
            (max(1, round(img.width * scale)), max(1, round(img.height * scale))),
            Image.LANCZOS,
        )
    return img


def _round32(value: float) -> int:
    """Round up to a multiple of 32 (VAE scale 8 x patch 2 => 16; 32 is safe)."""
    return max(32, int(round(value / 32.0)) * 32)


def target_size(sketch, max_side: int = 1024, width: int | None = None,
                height: int | None = None) -> tuple[int, int]:
    """Output (width, height): explicit if given, else the sketch's aspect
    ratio with its long side capped at ``max_side``.  Always multiples of 32.
    """
    if width and height and width > 0 and height > 0:
        return _round32(width), _round32(height)
    sw, sh = sketch.size
    scale = max_side / max(sw, sh)
    return _round32(sw * scale), _round32(sh * scale)


def _supported_kwargs(pipe, **candidates) -> dict:
    """Keep only the candidate kwargs that ``pipe.__call__`` accepts.

    ``None`` values are dropped (used for optional knobs like ``guidance_scale``
    that the distilled klein-kv pipeline does not take).  This lets one call
    site drive every FLUX.2 variant regardless of its exact signature.
    """
    import inspect

    try:
        params = inspect.signature(pipe.__call__).parameters
    except (TypeError, ValueError):  # pragma: no cover - defensive
        return {k: v for k, v in candidates.items() if v is not None}

    has_varkw = any(p.kind is inspect.Parameter.VAR_KEYWORD for p in params.values())
    return {
        k: v
        for k, v in candidates.items()
        if v is not None and (has_varkw or k in params)
    }


def generate(
    pipe,
    sketch,
    prompt: str,
    width: int,
    height: int,
    steps: int = 20,
    guidance: float | None = None,
    seed: int | None = None,
    progress_cb=None,
):
    """Run image-to-image: ``sketch`` (PIL) + ``prompt`` -> finished PIL image.

    ``guidance`` may be ``None`` to let each pipeline use its own distilled
    default (the klein-kv pipeline, for example, ignores guidance).  ``steps``
    is the number of denoising steps (the klein-kv model uses its own small
    default if you pass a large value it will still honour, but 4 is typical).
    ``progress_cb(step, total)`` is invoked after each denoising step.
    """
    import torch
    from PIL import Image

    if not isinstance(sketch, Image.Image):
        raise ValueError("sketch must be a PIL.Image.Image")
    if sketch.width < 4 or sketch.height < 4:
        raise ValueError("sketch image is too small to use as a reference")

    sketch = prepare_sketch(sketch)

    gen = None
    if seed is not None:
        gen = torch.Generator(device="cpu").manual_seed(seed)

    callback = None
    if progress_cb is not None:
        def callback(_pipe, step, _timestep, _cb_kwargs):
            progress_cb(int(step) + 1, int(steps))
            # FLUX.2 pipelines do `callback_outputs.pop("latents", ...)` on the
            # return value, so the callback MUST return a dict ({} = no changes).
            return {}

    kwargs = _supported_kwargs(
        pipe,
        image=sketch,
        prompt=prompt,
        width=int(width),
        height=int(height),
        num_inference_steps=int(steps),
        guidance_scale=guidance,
        generator=gen,
        output_type="pil",
        callback_on_step_end=callback,
    )

    with torch.inference_mode():
        out = pipe(**kwargs)

    image = out.images[0] if hasattr(out, "images") else out[0]
    return image
