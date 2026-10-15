import { useEffect, useState } from 'react'
import { DEFAULT_CONFIG, SpeedBackground, type BgConfig } from './SpeedBackground'

type NumKey = { [K in keyof BgConfig]: BgConfig[K] extends number ? K : never }[keyof BgConfig]

const SLIDERS: [NumKey, number, number, number][] = [
  ['speed', 0, 0.3, 0.005],
  ['scale', 0.5, 6, 0.05],
  ['stretch', 1, 16, 0.1],
  ['warp', 0, 4, 0.05],
  ['contrast', 0, 1, 0.01],
  ['ragged', 0, 1, 0.01],
  ['streaks', 0, 0.4, 0.01],
  ['brightness', -0.4, 0.4, 0.01],
  ['shade', 0.05, 1, 0.01],
  ['grain', 0, 0.15, 0.005],
  ['seed', 0, 100, 0.1],
  ['resolution', 0.25, 1, 0.05],
]

const C: BgConfig['colors'] = ['#2f0100', '#6a0605', '#930f0f', '#b11515', '#e22020']

const TEMPLATES: BgConfig[] = [
  { colors: C, speed: 0.08, direction: 1, scale: 0.8, stretch: 2.4, warp: 1.4, contrast: 0.42, ragged: 0.08, streaks: 0.16, brightness: 0.02, shade: 0.31, grain: 0.13, seed: 15.2, resolution: 0.5 },
  { colors: C, speed: 0.08, direction: 1, scale: 0.5, stretch: 1.6, warp: 3.25, contrast: 0.34, ragged: 0.08, streaks: 0.24, brightness: 0.2, shade: 0.56, grain: 0.15, seed: 84.4, resolution: 0.75 },
  { colors: C, speed: 0.2, direction: 1, scale: 2.55, stretch: 2.7, warp: 2.25, contrast: 0.16, ragged: 0.12, streaks: 0.19, brightness: 0.09, shade: 0.5, grain: 0.15, seed: 87.9, resolution: 0.45 },
]

export default function App() {
  const [config, setConfig] = useState<BgConfig>(DEFAULT_CONFIG)
  const [panel, setPanel] = useState(true)
  const [copied, setCopied] = useState(false)
  const set = <K extends keyof BgConfig>(k: K, v: BgConfig[K]) => setConfig((c) => ({ ...c, [k]: v }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'h' && !(e.target instanceof HTMLInputElement) && setPanel((p) => !p)
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <>
      <main className="stage">
        <SpeedBackground config={config} />
      </main>
      <nav className="templates">
        {TEMPLATES.map((t, i) => (
          <button key={i} onClick={() => setConfig(t)}>Template #{i + 1}</button>
        ))}
      </nav>
      {panel && (
        <aside className="panel">
          <header>
            <strong>Speed background</strong>
            <span>press H to hide</span>
          </header>

          {SLIDERS.map(([k, min, max, step]) => (
            <label key={k}>
              <span>{k}</span>
              <input type="range" min={min} max={max} step={step} value={config[k]}
                onChange={(e) => set(k, +e.target.value)} />
              <output>{config[k].toFixed(step < 0.01 ? 3 : 2)}</output>
            </label>
          ))}

          <label>
            <span>direction</span>
            <button onClick={() => set('direction', config.direction === 1 ? -1 : 1)}>
              {config.direction === 1 ? 'left → right' : 'right → left'}
            </button>
          </label>

          <div className="swatches">
            {config.colors.map((c, i) => (
              <input key={i} type="color" value={c} title={c} aria-label={`palette stop ${i + 1}`}
                onChange={(e) => set('colors', config.colors.map((x, j) => (j === i ? e.target.value : x)) as BgConfig['colors'])} />
            ))}
          </div>

          <div className="actions">
            <button onClick={() => set('seed', Math.round(Math.random() * 1000) / 10)}>New seed</button>
            <button onClick={() => setConfig(DEFAULT_CONFIG)}>Reset</button>
            <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy config'}</button>
          </div>
        </aside>
      )}
    </>
  )
}
