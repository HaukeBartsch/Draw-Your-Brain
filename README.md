# Draw Your Brain

In the past this project has been used to get young students engadged in arts and sciences. The task is simple, draw your brain and share your drawing with your mates.

![example](https://github.com/HaukeBartsch/Draw-Your-Brain/raw/main/images/playback.gif)

### MRI

Example images used in this web application have been obtained from the ISLES-2022 dataset (stroke cases).

Citation: Hernandez Petzsche, M.R., de la Rosa, E., Hanning, U. et al. ISLES 2022: A multi-center magnetic resonance imaging stroke lesion segmentation dataset. Sci Data 9, 762 (2022). [https://doi.org/10.1038/s41597-022-01875-5](https://doi.org/10.1038/s41597-022-01875-5).

### Story

We used this application during the Research Days in Bergen, Norway in September of 2024/2025.

![example](https://github.com/HaukeBartsch/Draw-Your-Brain/raw/main/images/AfterDay2.gif)

![example](https://github.com/HaukeBartsch/Draw-Your-Brain/raw/main/images/Day1.gif)

### Data format

All drawings are stored as JSON encoded texts that include the position and color of all drawn lines. Here an example.

```json
[
  {
    "color": "orange",
    "lineWidth": 6,
    "pos": [
      [
        0.8205128205128205,
        0.2807944679991924,
        0
      ],
      [
        0.7999999999999999,
        0.2743943064809206,
        22
      ],
...
```

The third element in the position array of arrays encodes for the timing of a stroke up to this position. In the example above 22 milliseconds after the first coordinate a second coordinate was saved. All positions are encoded as values between 0 and 1.

### AI co-drawing

[ai/](ai/README.md) contains a small transformer that predicts the next stroke of a drawing. This feature is **not integrated into the app** — `predict.php` (which calls `ai/predict.py`) remains as a manual endpoint, but the drawing page no longer sends strokes to it. Older drawings may still contain the pencil-style continuation strokes it produced (thin, gray, semi-transparent — an optional `opacity` value per stroke), and the gallery replays those as part of the drawing.

### AI image generation (FLUX.2)

[ai2/](ai2/README.md) is a separate, second model based on **FLUX.2**. When the user finishes a drawing and presses **"Share"**, the app **only saves the drawing** (`.code`).  The image generation is a completely independent process: a worker (`ai2/worker.py`) driven by **cron** polls `data/` for any `.code` that has no matching `.png`, and for each one runs FLUX.2 on the **CPU** — reading the drawing as a sketch (image-to-image) and re-rendering it with the fixed prompt *"Convert to a pencil drawing, add water colors."* — then saves the result **next to the `.code` original** (`data/<id>.png`).  Because "a `.code` without a `.png`" is the only notion of pending work, a single run generates every missing image and re-runs are safe.

By default it uses the **fast path** (the 9B `FLUX.2-klein-9b-kv` model, 4 steps, 512px, bfloat16) — roughly 6 minutes per image on a modern CPU.  The higher-quality 32B `FLUX.2-dev` and the standard `FLUX.2-klein-base-9B` are available by changing one setting.  The UI for *displaying* the finished images (in the gallery) is a follow-up; for now the images simply appear beside their `.code` files. See [ai2/](ai2/README.md) for setup, running the worker, the model options, and the CPU time/memory trade-offs.

### System setup

We use a virtual machine provided by the University of Bergen to host the application. The system in 2025 was a minimum sized debian 13 system with apache2 and php8.4 installed. We used fail2ban to secure the remote access (ssh with private/public keys). 