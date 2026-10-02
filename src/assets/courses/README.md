# Course videos

Monklogy finds lesson videos automatically. Put each video in the folder of the
course **section** (module) it belongs to:

```
src/assets/courses/
└── <course-id>/
    └── <NN-section-name>/
        ├── 01 - first lesson of the section.mp4
        ├── 02 - second lesson.mp4
        └── …
```

- `<course-id>` is the course's `id` in `src/data/courses/*.js`
  (e.g. `fullstack-web-development`, `java-development`).
- `<NN-section-name>` starts with the section's position (`01`, `02`, …).
  The name after the number is for humans; only the number is used for matching.
- Inside a section, files play in natural filename order (`2` before `10`)
  and are matched to that section's lessons in order.
- Supported formats: `.mp4`, `.webm`, `.m4v`, `.mov` (Safari only), `.ogv`.
- More videos than lessons? The extras appear as additional lessons.
- A lesson can name its file explicitly with `videoFile: '03 - intro.mp4'`.

Videos are only downloaded when a learner opens the lesson.
