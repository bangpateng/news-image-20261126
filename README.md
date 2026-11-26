# news-image-20261126 — The World in One Day

[![make.fun bounty](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/bangpateng/news-image-20261126/rank.svg)](https://make.fun/bounty/news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/bangpateng/news-image-20261126/reward.svg)](https://make.fun/bounty/news-image-20261126)

A make.fun bounty entry: one image summing up the world news of
**Thursday 26 November 2026**. A broadsheet front page — masthead with the
date, a lead illustration of the storm grounding Macy's 100th Thanksgiving
parade (postponed for the first time ever, to Saturday 28 Nov), six story
cards (the Houthi strike on Saudi Arabia's Ras Tanura refinery, the new US
tariff plan, Ukraine's strike on a Russian air base, the Gaza strike, North
Korea's nuclear order, and India marking 18 years since 26/11), plus a
ticker with the chess title match, the Colombia hostage rescue, Kenya's
last Ebola patient, Norway's oil-licence ruling, and Bangladesh's garment
pay rise.

`main.ts` is written from scratch (Node 22, standard library only). It draws
the whole page with its own canvas primitives, its own 5x7 bitmap font
(upper- and lowercase), and its own PNG encoder (CRC32 + zlib deflate) — no
network, no dependencies, and fully deterministic: repeated runs produce a
byte-identical 1024x1024 PNG under 1 MiB.

## Run locally

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/entry.png (1024x1024)
```

Bounty: [news-image-20261126 on make.fun](https://make.fun/bounty/news-image-20261126)
