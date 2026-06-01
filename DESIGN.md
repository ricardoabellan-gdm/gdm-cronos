# DESIGN.md — Cronos GDM · Fonte da Verdade Visual

Este arquivo documenta todos os design tokens do sistema. Qualquer decisão visual futura deve ser consistente com estes valores. **Nunca desvie sem atualizar este arquivo.**

---

## Tipografia

| Token | Valor |
|---|---|
| Fonte sans-serif | `Manrope` (fallback: `ui-sans-serif, system-ui, sans-serif`) |
| Fonte monospace | `JetBrains Mono` (fallback: `ui-monospace, monospace`) |
| Font smoothing | `-webkit-font-smoothing: antialiased` |
| Features OpenType | `"ss01"`, `"cv11"` |

### Pesos utilizados
- **Manrope:** 400, 500, 600, 700, 800, 900 (extrabold)
- **JetBrains Mono:** 400, 500 (para números e código)

### Escalas de tamanho (em uso)
| Papel | Tamanho |
|---|---|
| Label uppercase micro | `10px–11px` |
| Corpo / input | `13px–14px` |
| Título de card | `17px` |
| Título de página | `24px–34px` |
| Display hero | `34px`, `font-extrabold` |

---

## Paleta de Cores

### Brand (vinho escuro GDM)
| Token | Hex |
|---|---|
| `--color-brand` | `#3D0F26` |
| `--color-brand-50` | `#FBF5F7` |
| `--color-brand-100` | `#F4E6EC` |
| `--color-brand-200` | `#E5C5D2` |
| `--color-brand-300` | `#C99AB0` |
| `--color-brand-400` | `#9F5F7E` |
| `--color-brand-500` | `#7A3658` |
| `--color-brand-600` | `#5C1F3F` |
| `--color-brand-700` | `#42112D` |
| `--color-brand-800` | `#2E0A1F` |
| `--color-brand-900` | `#1C0513` |

### Ink (neutros quentes)
| Token | Hex |
|---|---|
| `--color-ink-50` | `#F7F7F6` |
| `--color-ink-100` | `#EDECEA` |
| `--color-ink-200` | `#D9D7D3` |
| `--color-ink-300` | `#B6B2AC` |
| `--color-ink-400` | `#8A857D` |
| `--color-ink-500` | `#5E5A53` |
| `--color-ink-600` | `#403D38` |
| `--color-ink-700` | `#2A2825` |
| `--color-ink-800` | `#1A1917` |
| `--color-ink-900` | `#0F0E0D` |

### Status
| Token | Hex | Uso |
|---|---|---|
| `--color-status-progress` | `#2563EB` | Em andamento |
| `--color-status-done` | `#16A34A` | Concluída |
| `--color-status-late` | `#DC2626` | Atrasada |
| `--color-status-pending` | `#9CA39C` | Não iniciada |

### Canvas
| Token | Hex | Uso |
|---|---|---|
| `--color-canvas` | `#F7F5F2` | Fundo da página (off-white quente) |

---

## Sombras

| Token | Valor |
|---|---|
| `--shadow-card` | `0 1px 2px rgba(15,14,13,0.04), 0 1px 0 rgba(15,14,13,0.03)` |
| `--shadow-card-hover` | `0 6px 24px -8px rgba(61,15,38,0.18), 0 2px 4px rgba(15,14,13,0.06)` |
| `--shadow-panel` | `0 1px 0 rgba(15,14,13,0.04)` |
| `--shadow-pop` | `0 12px 32px -8px rgba(15,14,13,0.18)` |

---

## Border Radius

| Token | Valor | Uso |
|---|---|---|
| `rounded-lg` | `8px` | Botões, inputs, tags |
| `rounded-xl` | `12px` | — |
| `rounded-xl2` | `14px` (custom) | Cards, modais, painéis principais |
| `rounded-full` | `9999px` | Pills de status, dots |

---

## Espaçamento e Layout

- **Container máximo:** `1440px` (lista) / `1600px` (gantt) / `1100px` (form)
- **Padding horizontal:** `24px` (px-6)
- **Grid de cards:** 1 col (mobile) → 2 col (md) → 3 col (xl)
- **Gap entre cards:** `16px` (gap-4)
- **Altura do Topbar:** `64px` (h-16)

---

## Barras de Status no Gantt

| Status | Cor da track (fundo) | Cor do fill (progresso) | Cor do texto |
|---|---|---|---|
| `not_started` | `#EDECEA` | `#9CA39C` | `#5E5A53` |
| `in_progress` | `#E8EFFB` | `#2563EB` | `#1B4FB6` |
| `done` | `#E6F4EA` | `#16A34A` | `#0E6B30` |
| `late` | `#FCE8E8` | `#DC2626` | `#9F1818` |

---

## Linha "Hoje" no Gantt

- Cor: `#3D0F26` (brand)
- Espessura: `1.5px` (SVG) / `0.8pt` (PDF)
- Estilo: `stroke-dasharray="4 3"` (tracejada)
- Marcador: círculo sólido `r=4` no topo

---

## Estados de Interação

| Estado | Comportamento visual |
|---|---|
| Hover em card | `shadow-card-hover` + `border-ink-200` |
| Focus em input | `border-brand` + `ring-2 ring-brand/15` |
| Focus em botão | `outline: 2px solid #3D0F26; outline-offset: 1px` |
| Disabled | `opacity-50 cursor-not-allowed` |
| Drag (task row) | `opacity-50 border-brand shadow-pop` |
| Drag-over target | `ring-2 ring-brand/30` |

---

## Componentes de Status

### StatusPill
```
background: STATUS[key].bg
color: STATUS[key].color
dot: STATUS[key].dot (círculo 6×6px)
border-radius: rounded-full
padding sm: px-2 py-0.5 text-[11px]
padding md: px-2.5 py-1 text-[12px]
```

### ProgressBar
```
height: 6px (h-1.5)
track: bg-ink-100
fill: bg-brand (default) | bg-status-done | bg-status-late | bg-status-progress | bg-ink-300
border-radius: rounded-full
```

---

## Gantt — Dimensões (SVG/HTML)

| Constante | Valor |
|---|---|
| `ROW_HEIGHT` | `48px` |
| `HEADER_HEIGHT` | `56px` |
| `SIDEBAR_WIDTH` | `280px` |
| `COL_W.day` | `32px/dia` |
| `COL_W.week` | `28px/dia` |
| `COL_W.month` | `4px/dia` |

---

## PDF Export — Dimensões

| Constante | Valor |
|---|---|
| Orientação | Landscape A4 |
| Margem | `32pt` |
| Sidebar | `188pt` |
| Linha de cabeçalho | `76pt` |
| Linha por tarefa | `28pt` |
| Linha de timeline | `42pt` |
