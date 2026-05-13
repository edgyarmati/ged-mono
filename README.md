# ged-mono

Monorepo for the **Ged workflow layer** — interview, plan, build, and verify code in bounded slices.

Continues and merges:
- **[omnicode](https://github.com/edgyarmati/omnicode)** — OpenCode plugin + launcher (archived)
- **[Omni-Pi](https://github.com/edgyarmati/Omni-Pi)** — Pi plugin + brain + extensions (archived)

## Packages

| Package | Description |
|---------|-------------|
| [`packages/gedoc/`](packages/gedoc/) | GedOC: OpenCode plugin + launcher |
| [`packages/gedpi/`](packages/gedpi/) | GedPi: Pi plugin + brain + extensions |

## Setup

```bash
npm install
npm run check
npm test
```

## License

MIT — see [LICENSE](LICENSE).
