# Draw Your Brain

In the past this project has been used to get young students engadged in arts and sciences. The task is simple, draw your brain and share your drawing with your mates.

![example](https://github.com/HaukeBartsch/Draw-Your-Brain/raw/main/images/playback.gif)

### MRI

Example images used in this web application have been obtained from the ISLES-2022 dataset (stroke cases).

Citation: Hernandez Petzsche, M.R., de la Rosa, E., Hanning, U. et al. ISLES 2022: A multi-center magnetic resonance imaging stroke lesion segmentation dataset. Sci Data 9, 762 (2022). [https://doi.org/10.1038/s41597-022-01875-5](https://doi.org/10.1038/s41597-022-01875-5).

### Story

We used this application during the Research Days in Bergen, Norway in September of 2024.

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

The third element in the position array of arrays encodes for the timing of a stroke up to this position. In the example above 22 milliseconds after the first coordinate a second coordinate was safed. All positions are encoded as values between 0 and 1 to abstract from the size of the drawing canvas (on phone or screen device).
