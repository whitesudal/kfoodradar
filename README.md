# kfoodradar

`kfoodradar` tracks K-food trend signals across Reddit, YouTube, Naver Blog, and AI channels.

It is a K-food trend intelligence project built around:

- `Reddit` for demand cause
- `YouTube` for spread
- `Naver Blog` for visit conversion
- `foodbus AI DB` for AI-channel visibility and recommendation signals

The goal is not to build a simple dashboard, but a `K-food trend signal system` that tells operators and researchers what menu trends are forming across Reddit, YouTube, Naver, and AI channels.

## Current Scope

This repository currently contains:

- product and architecture documentation
- `franchise-lens` app slices for trend collection and scoring
- menu trend scoring logic
- Reddit / YouTube / Naver collection clients
- foodbus AI DB adapter for AI trend signals

## Repository Layout

```text
.
├── README.md
├── kfoodradar_harness_architecture.md
└── franchise-lens/
    ├── docs/
    ├── prisma/
    └── src/
```

## Implemented So Far

- menu normalization dictionary
- trend score calculator
- `GET /api/trends/top`
- `GET /api/trends/collect?menu=...`
- Reddit app-only OAuth collection skeleton
- YouTube Data API collection skeleton
- Naver Blog Search API collection
- foodbus AI DB menu-level AI trend signal
- combined public + AI channel decision signal

## Planned Next Steps

1. Add `TrendSnapshot` persistence jobs
2. Add daily `TrendScore` and `TrendInterpretation` generation
3. Connect `MerchantTrendFit` with `AXSIGN / AXSPACE`
4. Add GitHub remote, CI, and deployment workflow

## Notes

- Current code was assembled from active work on `germany-dev`.
- Secrets are intentionally excluded from this repo.
- Before production use, add actual API credentials and data retention rules.
- Domain copy, privacy draft, and GitHub messaging live in `kfoodradar_launch_copy.md`.
