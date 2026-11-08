import * as THREE from 'three'

/**
 * Système de particules à pool fixe (un seul draw call), mis à jour sur le CPU.
 * Aucune allocation pendant le jeu : les particules mortes sont recyclées.
 */

export interface EmitOptions {
  x: number
  y: number
  z: number
  count: number
  color: THREE.ColorRepresentation
  /** Couleur de fin (interpolée sur la durée de vie). */
  colorEnd?: THREE.ColorRepresentation
  /** Vitesse initiale moyenne (unités/s). */
  speed?: number
  /** Dispersion de la vitesse (0 = uniforme). */
  speedJitter?: number
  /** Biais vertical ajouté à la vitesse. */
  up?: number
  /** Rayon de dispersion de la position de départ. */
  spread?: number
  life?: number
  size?: number
  /** Taille de fin, en multiple de la taille de départ. */
  grow?: number
  gravity?: number
  drag?: number
  /** Direction privilégiée (normalisée) : sinon sphère complète. */
  dir?: THREE.Vector3
  /** Ouverture du cône autour de dir (0..1). */
  cone?: number
  /** Si vrai, les particules restent dans le plan horizontal. */
  flat?: boolean
}

const vertex = /* glsl */ `
attribute float aAlpha;
attribute float aSize;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`

const fragment = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
uniform float uSoft;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, uSoft, d);
  gl_FragColor = vec4(vColor, a * vAlpha);
}`

export class ParticleSystem {
  readonly points: THREE.Points
  private readonly max: number
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly alpha: Float32Array
  private readonly size: Float32Array
  private readonly vel: Float32Array
  private readonly life: Float32Array
  private readonly maxLife: Float32Array
  private readonly size0: Float32Array
  private readonly grow: Float32Array
  private readonly grav: Float32Array
  private readonly drag: Float32Array
  private readonly c0: Float32Array
  private readonly c1: Float32Array
  private cursor = 0
  private alive = 0
  private readonly tmp = new THREE.Color()
  private readonly tmp2 = new THREE.Color()
  private readonly v = new THREE.Vector3()

  constructor(max: number, additive: boolean) {
    this.max = max
    this.pos = new Float32Array(max * 3)
    this.col = new Float32Array(max * 3)
    this.alpha = new Float32Array(max)
    this.size = new Float32Array(max)
    this.vel = new Float32Array(max * 3)
    this.life = new Float32Array(max)
    this.maxLife = new Float32Array(max)
    this.size0 = new Float32Array(max)
    this.grow = new Float32Array(max)
    this.grav = new Float32Array(max)
    this.drag = new Float32Array(max)
    this.c0 = new Float32Array(max * 3)
    this.c1 = new Float32Array(max * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000)
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uScale: { value: 300 }, uSoft: { value: additive ? 0.0 : 0.25 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    this.points.renderOrder = additive ? 6 : 5
  }

  /** Ajuste la taille des points à la hauteur du canvas (en pixels). */
  setViewportHeight(h: number) {
    ;(this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = h * 1.3
  }

  emit(o: EmitOptions) {
    this.tmp.set(o.color)
    this.tmp2.set(o.colorEnd ?? o.color)
    const speed = o.speed ?? 1
    const jitter = o.speedJitter ?? 0.5
    const spread = o.spread ?? 0
    for (let n = 0; n < o.count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.max
      const i3 = i * 3
      // Direction aléatoire
      const v = this.v
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
      if (o.flat) v.y = 0
      if (v.lengthSq() < 1e-4) v.set(1, 0, 0)
      v.normalize()
      if (o.dir) v.lerp(o.dir, 1 - (o.cone ?? 0.5)).normalize()
      const s = speed * (1 - jitter + Math.random() * jitter * 2)
      this.vel[i3] = v.x * s
      this.vel[i3 + 1] = v.y * s + (o.up ?? 0)
      this.vel[i3 + 2] = v.z * s
      this.pos[i3] = o.x + (Math.random() * 2 - 1) * spread
      this.pos[i3 + 1] = o.y + (o.flat ? 0 : (Math.random() * 2 - 1) * spread * 0.5)
      this.pos[i3 + 2] = o.z + (Math.random() * 2 - 1) * spread
      const life = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6)
      this.life[i] = life
      this.maxLife[i] = life
      this.size0[i] = (o.size ?? 0.1) * (0.7 + Math.random() * 0.6)
      this.grow[i] = o.grow ?? 0.2
      this.grav[i] = o.gravity ?? 0
      this.drag[i] = o.drag ?? 1.5
      this.c0[i3] = this.tmp.r
      this.c0[i3 + 1] = this.tmp.g
      this.c0[i3 + 2] = this.tmp.b
      this.c1[i3] = this.tmp2.r
      this.c1[i3 + 1] = this.tmp2.g
      this.c1[i3 + 2] = this.tmp2.b
    }
    this.alive = this.max
  }

  update(dt: number) {
    if (this.alive === 0) return
    let any = 0
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0
          this.size[i] = 0
        }
        continue
      }
      any++
      const i3 = i * 3
      this.life[i] -= dt
      const k = Math.max(0, this.life[i] / this.maxLife[i]) // 1 → 0
      const t = 1 - k
      const damp = Math.max(0, 1 - this.drag[i] * dt)
      this.vel[i3] *= damp
      this.vel[i3 + 1] = this.vel[i3 + 1] * damp - this.grav[i] * dt
      this.vel[i3 + 2] *= damp
      this.pos[i3] += this.vel[i3] * dt
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt
      this.col[i3] = this.c0[i3] + (this.c1[i3] - this.c0[i3]) * t
      this.col[i3 + 1] = this.c0[i3 + 1] + (this.c1[i3 + 1] - this.c0[i3 + 1]) * t
      this.col[i3 + 2] = this.c0[i3 + 2] + (this.c1[i3 + 2] - this.c0[i3 + 2]) * t
      // Apparition rapide puis extinction douce
      this.alpha[i] = Math.min(1, t * 8) * k
      this.size[i] = this.size0[i] * (1 + (this.grow[i] - 1) * t)
    }
    if (any === 0) this.alive = 0
    const g = this.points.geometry
    g.attributes.position.needsUpdate = true
    g.attributes.aColor.needsUpdate = true
    g.attributes.aAlpha.needsUpdate = true
    g.attributes.aSize.needsUpdate = true
  }

  clear() {
    this.life.fill(0)
    this.alpha.fill(0)
    this.size.fill(0)
    this.alive = this.max
  }

  dispose() {
    this.points.geometry.dispose()
    ;(this.points.material as THREE.Material).dispose()
  }
}

/** Bus d'effets partagé entre les composants de la scène (sans React). */
export interface FxBus {
  sparks: ParticleSystem
  smoke: ParticleSystem
  /** Intensité courante du tremblement de caméra (décroît toute seule). */
  shake: number
}

export function createFxBus(): FxBus {
  return { sparks: new ParticleSystem(1600, true), smoke: new ParticleSystem(900, false), shake: 0 }
}
