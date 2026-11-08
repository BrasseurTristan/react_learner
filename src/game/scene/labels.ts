import * as THREE from 'three'

/**
 * Étiquettes dessinées dans un canvas puis affichées en sprite Three.js.
 * Remplace les <Html> de drei : aucun root React supplémentaire, aucun DOM par étiquette.
 */

export interface LabelTexture {
  texture: THREE.CanvasTexture
  /** Largeur / hauteur de l'étiquette, pour dimensionner le sprite. */
  aspect: number
  redraw: () => void
}

const SCALE = 4 // résolution du canvas par rapport à la taille logique
const cache = new Map<string, LabelTexture>()

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const FONT = (px: number) => `700 ${px}px Fredoka, Inter, system-ui, sans-serif`

/** Pastille de slot : lettre en cyan, atténuée si le slot est occupé, ▲ pour une hauteur. */
export function slotLabel(id: string, occupied: boolean, high: boolean): LabelTexture {
  const key = `slot|${id}|${occupied}|${high}`
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const pad = 14 // marge pour la lueur
  const h = 30
  const entry: LabelTexture = { texture, aspect: 1, redraw: () => {} }
  entry.redraw = () => {
    const ctx = canvas.getContext('2d')!
    ctx.font = FONT(20)
    const textW = ctx.measureText(id).width
    const markW = high ? 16 : 0
    const w = Math.max(h, textW + markW + 18)
    canvas.width = (w + pad * 2) * SCALE
    canvas.height = (h + pad * 2) * SCALE
    ctx.scale(SCALE, SCALE)
    ctx.clearRect(0, 0, w + pad * 2, h + pad * 2)
    // Pastille
    ctx.save()
    if (!occupied) {
      ctx.shadowColor = 'rgba(97, 218, 251, 0.9)'
      ctx.shadowBlur = 12
    }
    roundRect(ctx, pad, pad, w, h, h / 2)
    const grad = ctx.createLinearGradient(0, pad, 0, pad + h)
    if (occupied) {
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.82)')
      grad.addColorStop(1, 'rgba(7, 11, 24, 0.82)')
    } else {
      grad.addColorStop(0, '#8be9ff')
      grad.addColorStop(1, '#3cc4ec')
    }
    ctx.fillStyle = grad
    ctx.fill()
    ctx.restore()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = occupied ? 'rgba(148, 163, 255, 0.35)' : 'rgba(255, 255, 255, 0.75)'
    roundRect(ctx, pad + 0.75, pad + 0.75, w - 1.5, h - 1.5, h / 2 - 0.75)
    ctx.stroke()
    // Texte
    ctx.font = FONT(20)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillStyle = occupied ? '#8b97bd' : '#061024'
    const startX = pad + (w - textW - markW) / 2
    ctx.fillText(id, startX, pad + h / 2 + 1)
    if (high) {
      ctx.font = FONT(12)
      ctx.fillStyle = occupied ? '#64748b' : '#0b3a52'
      ctx.fillText('▲', startX + textW + 4, pad + h / 2)
    }
    entry.aspect = (w + pad * 2) / (h + pad * 2)
    texture.needsUpdate = true
  }
  entry.redraw()
  cache.set(key, entry)
  return entry
}

/** Texte flottant (nombres de dégâts, or gagné). */
export function floatingText(text: string, color: string): LabelTexture {
  const key = `float|${text}|${color}`
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const entry: LabelTexture = { texture, aspect: 1, redraw: () => {} }
  entry.redraw = () => {
    const ctx = canvas.getContext('2d')!
    ctx.font = FONT(26)
    const w = ctx.measureText(text).width + 16
    const h = 36
    canvas.width = w * 3
    canvas.height = h * 3
    ctx.scale(3, 3)
    ctx.font = FONT(26)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 5
    ctx.strokeStyle = 'rgba(7, 11, 24, 0.9)'
    ctx.strokeText(text, w / 2, h / 2 + 1)
    ctx.fillStyle = color
    ctx.fillText(text, w / 2, h / 2 + 1)
    entry.aspect = w / h
    texture.needsUpdate = true
  }
  entry.redraw()
  // Évite une croissance illimitée du cache.
  if (cache.size > 400) {
    for (const [k, v] of cache) {
      if (k.startsWith('float|')) {
        v.texture.dispose()
        cache.delete(k)
        break
      }
    }
  }
  cache.set(key, entry)
  return entry
}

// Redessine quand les polices web sont prêtes (sinon la police de secours resterait).
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => {
    for (const l of cache.values()) l.redraw()
  })
}
