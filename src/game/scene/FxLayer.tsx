import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ELEMENTS, ENEMIES, TOWERS } from '../../engine/balance'
import type { GameEngine } from '../../engine/engine'
import type { EnemyState, Projectile, TowerKind } from '../../engine/types'
import { toWorld } from './coords'
import { floatingText } from './labels'
import type { FxBus } from './particles'

const PROJECTILE_POOL = 96
const RING_POOL = 24
const METEOR_POOL = 24
const TEXT_POOL = 48

/** Hauteur de départ des projectiles selon le type de tour (au-dessus du slot). */
const MUZZLE_Y: Record<TowerKind, number> = { archer: 1.15, cannon: 0.92, mage: 1.75, frost: 1.25 }
const PROJECTILE_COLOR: Record<TowerKind, string> = { archer: '#fef3c7', cannon: '#fb923c', mage: '#c4b5fd', frost: '#7dd3fc' }

interface Ring {
  mesh: THREE.Mesh | null
  born: number
  dur: number
  from: number
  to: number
  opacity: number
}

interface FloatText {
  sprite: THREE.Sprite | null
  born: number
  dur: number
  x: number
  y: number
  z: number
  size: number
  aspect: number
  drift: number
}

/**
 * Projectiles et effets visuels. Rendu impératif par pools d'objets :
 * aucun re-rendu React, tout est dérivé de l'état du moteur dans useFrame.
 * Les événements absents du moteur (dégâts, morts) sont déduits en comparant
 * l'état d'une frame à l'autre.
 */
export function FxLayer({ engine, fx }: { engine: GameEngine; fx: FxBus }) {
  const map = engine.config.map
  const { gl } = useThree()
  const projectiles = useRef<(THREE.Group | null)[]>([])
  const rings = useRef<Ring[]>(Array.from({ length: RING_POOL }, () => ({ mesh: null, born: -1, dur: 1, from: 0, to: 1, opacity: 1 })))
  const meteors = useRef<(THREE.Mesh | null)[]>([])
  const texts = useRef<FloatText[]>(Array.from({ length: TEXT_POOL }, () => ({ sprite: null, born: -1, dur: 1, x: 0, y: 0, z: 0, size: 0.3, aspect: 1, drift: 0 })))
  const iceSheet = useRef<THREE.Mesh>(null)
  const flash = useRef<THREE.PointLight>(null)
  const state = useRef({
    seenEffects: new Set<number>(),
    impacted: new Set<number>(),
    liveProjectiles: new Map<number, Projectile>(),
    enemies: new Map<number, EnemyState>(),
    hp: new Map<number, number>(),
    textCursor: 0,
    clock: 0,
    flash: 0,
    ice: 0,
    lastTime: 0,
  })
  const slotHeight = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of map.slots) m.set(`${s.x},${s.z}`, s.high ? 0.42 : 0.14)
    return m
  }, [map])
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Color() }), [])

  useEffect(() => () => fx.sparks.clear(), [fx])

  const ring = (x: number, y: number, z: number, color: string, from: number, to: number, dur: number, opacity = 0.9) => {
    const r = rings.current.reduce((best, cur) => (cur.born < 0 ? cur : best.born < 0 ? best : cur.born < best.born ? cur : best))
    if (!r.mesh) return
    r.born = state.current.clock
    r.dur = dur
    r.from = from
    r.to = to
    r.opacity = opacity
    r.mesh.position.set(x, y, z)
    ;(r.mesh.material as THREE.MeshBasicMaterial).color.set(color)
    r.mesh.visible = true
  }

  const text = (label: string, color: string, x: number, y: number, z: number, size: number, dur = 0.9) => {
    const s = state.current
    const slot = texts.current[s.textCursor]
    s.textCursor = (s.textCursor + 1) % TEXT_POOL
    if (!slot.sprite) return
    const tex = floatingText(label, color)
    const mat = slot.sprite.material as THREE.SpriteMaterial
    mat.map = tex.texture
    mat.needsUpdate = true
    Object.assign(slot, { born: s.clock, dur, x: x + (Math.random() - 0.5) * 0.2, y, z: z + (Math.random() - 0.5) * 0.2, size, aspect: tex.aspect, drift: (Math.random() - 0.5) * 0.4 })
    slot.sprite.visible = true
  }

  const lightFlash = (x: number, y: number, z: number, color: string, power: number) => {
    const l = flash.current
    if (!l) return
    l.position.set(x, y, z)
    l.color.set(color)
    state.current.flash = Math.max(state.current.flash, power)
  }

  useFrame((_, delta) => {
    const s = state.current
    const dt = Math.min(delta, 0.05)
    s.clock += dt
    const now = engine.time
    // Réinitialisation de la partie : on oublie l'historique
    if (now < s.lastTime - 0.001) {
      s.seenEffects.clear()
      s.impacted.clear()
      s.liveProjectiles.clear()
      s.enemies.clear()
      s.hp.clear()
    }
    s.lastTime = now
    fx.sparks.setViewportHeight(gl.domElement.height)
    fx.smoke.setViewportHeight(gl.domElement.height)

    // ── Ennemis : dégâts infligés et morts (déduits frame à frame) ──
    const seen = new Set<number>()
    for (const e of engine.enemies) {
      seen.add(e.id)
      const prev = s.hp.get(e.id)
      if (prev !== undefined && e.hp < prev - 0.5) showDamage(prev - e.hp, e)
      s.hp.set(e.id, e.hp)
      s.enemies.set(e.id, e)
    }
    for (const [id, e] of s.enemies) {
      if (seen.has(id)) continue
      s.enemies.delete(id)
      const prev = s.hp.get(id) ?? 0
      s.hp.delete(id)
      if (e.hp <= 0) {
        if (prev > 0.5) showDamage(prev, e)
        onDeath(e)
      }
    }

    // ── Projectiles ──
    const ps = engine.projectiles
    const nowIds = new Set<number>()
    for (let i = 0; i < PROJECTILE_POOL; i++) {
      const g = projectiles.current[i]
      if (!g) continue
      const p = ps[i]
      if (!p) {
        g.visible = false
        continue
      }
      nowIds.add(p.id)
      s.liveProjectiles.set(p.id, p)
      const t = Math.min(1, (now - p.born) / p.ttl)
      projectilePos(p, t, tmp.a)
      projectilePos(p, Math.min(1, t + 0.04), tmp.b)
      g.visible = true
      g.position.copy(tmp.a)
      if (tmp.b.distanceToSquared(tmp.a) > 1e-8) g.lookAt(tmp.b)
      for (let k = 0; k < g.children.length; k++) g.children[k].visible = g.children[k].name === p.kind
      const color = p.element !== 'neutral' ? ELEMENTS[p.element].color : PROJECTILE_COLOR[p.kind]
      const child = g.getObjectByName(p.kind) as THREE.Mesh | undefined
      const glow = child?.getObjectByName('glow') as THREE.Mesh | undefined
      if (glow) (glow.material as THREE.MeshBasicMaterial).color.set(color)
      // Traînées
      const { x, y, z } = tmp.a
      if (p.kind === 'cannon') {
        fx.smoke.emit({ x, y, z, count: 1, color: '#9ca3af', colorEnd: '#475569', speed: 0.05, life: 0.45, size: 0.16, grow: 2.2, drag: 2 })
        fx.sparks.emit({ x, y, z, count: 1, color: '#fdba74', colorEnd: '#ef4444', speed: 0.2, life: 0.25, size: 0.09 })
      } else if (p.kind === 'mage') {
        fx.sparks.emit({ x, y, z, count: 2, color, speed: 0.25, life: 0.35, size: 0.12, spread: 0.03 })
      } else if (p.kind === 'frost') {
        fx.sparks.emit({ x, y, z, count: 1, color: '#e0f2fe', colorEnd: color, speed: 0.2, life: 0.35, size: 0.08, gravity: 0.6 })
      } else {
        fx.sparks.emit({ x, y, z, count: 1, color: p.element !== 'neutral' ? color : '#fff7d6', speed: 0.02, life: 0.14, size: 0.06 })
      }
    }
    // Impacts : projectiles qui viennent de disparaître
    for (const [id, p] of s.liveProjectiles) {
      if (nowIds.has(id)) continue
      s.liveProjectiles.delete(id)
      if (now - p.born < p.ttl * 0.8) continue // remis à zéro, pas un impact
      onImpact(p)
    }

    // ── Effets du moteur ──
    let freezing = false
    let freezeLeft = 0
    for (const e of engine.effects) {
      const [x, z] = toWorld(map, e.x, e.z)
      const t = Math.min(1, (now - e.born) / e.ttl)
      const fresh = !s.seenEffects.has(e.id)
      if (fresh) s.seenEffects.add(e.id)
      switch (e.type) {
        case 'explosion':
          if (fresh) {
            ring(x, 0.08, z, '#fb923c', 0.15, (TOWERS.cannon.splash ?? 1) * 1.05, 0.45)
            fx.sparks.emit({ x, y: 0.3, z, count: 26, color: '#fde68a', colorEnd: '#ea580c', speed: 2.6, up: 1.2, life: 0.5, size: 0.11, gravity: 5, drag: 2 })
            fx.smoke.emit({ x, y: 0.3, z, count: 10, color: '#a8a29e', colorEnd: '#44403c', speed: 0.7, up: 0.5, life: 0.9, size: 0.38, grow: 2.2, spread: 0.2, drag: 2.5 })
            lightFlash(x, 0.8, z, '#fb923c', 2.5)
            fx.shake = Math.max(fx.shake, 0.06)
          }
          break
        case 'spawn':
          if (fresh) {
            fx.sparks.emit({ x, y: 0.55, z, count: 18, color: '#e9d5ff', colorEnd: '#a855f7', speed: 1.3, life: 0.6, size: 0.1, drag: 3, spread: 0.15 })
            ring(x, 0.06, z, '#c084fc', 0.2, 0.9, 0.5, 0.7)
          }
          break
        case 'leak':
          if (fresh) {
            ring(x, 0.1, z, '#ef4444', 0.3, 1.8, 0.7)
            fx.sparks.emit({ x, y: 0.7, z, count: 34, color: '#fecaca', colorEnd: '#dc2626', speed: 2.4, up: 1, life: 0.7, size: 0.12, gravity: 3, drag: 2 })
            lightFlash(x, 1.2, z, '#ef4444', 3)
            fx.shake = Math.max(fx.shake, 0.22)
          }
          break
        case 'meteor':
          if (fresh) s.impacted.delete(e.id)
          if (t >= 0.5 && !s.impacted.has(e.id)) {
            s.impacted.add(e.id)
            ring(x, 0.08, z, '#fdba74', 0.2, 1.6, 0.6)
            fx.sparks.emit({ x, y: 0.3, z, count: 40, color: '#fef08a', colorEnd: '#dc2626', speed: 3.4, up: 1.8, life: 0.7, size: 0.13, gravity: 5, drag: 1.8 })
            fx.smoke.emit({ x, y: 0.4, z, count: 14, color: '#78716c', colorEnd: '#1c1917', speed: 0.9, up: 0.8, life: 1.2, size: 0.45, grow: 2.4, spread: 0.25, drag: 2 })
            lightFlash(x, 1, z, '#f97316', 5)
            fx.shake = Math.max(fx.shake, 0.3)
          }
          break
        case 'freeze':
          freezing = true
          freezeLeft = (1 - t) * e.ttl
          if (fresh) {
            ring(0, 0.12, 0, '#bae6fd', 0.5, Math.max(map.width, map.depth) * 0.75, 0.9, 0.8)
            for (let k = 0; k < 4; k++)
              fx.sparks.emit({ x: 0, y: 0.4, z: 0, count: 30, color: '#f0f9ff', colorEnd: '#38bdf8', speed: 4 + k, flat: true, life: 0.9, size: 0.12, drag: 1.5 })
            lightFlash(0, 3, 0, '#7dd3fc', 4)
            fx.shake = Math.max(fx.shake, 0.12)
          }
          // Neige pendant le gel
          if (Math.random() < 0.9)
            fx.sparks.emit({
              x: (Math.random() - 0.5) * map.width,
              y: 3 + Math.random(),
              z: (Math.random() - 0.5) * map.depth,
              count: 1,
              color: '#ffffff',
              colorEnd: '#bae6fd',
              speed: 0.1,
              up: -1.4,
              life: 2.2,
              size: 0.09,
              drag: 0,
            })
          break
      }
    }
    // Nettoyage de l'historique des effets
    if (s.seenEffects.size > 300) {
      const alive = new Set(engine.effects.map((e) => e.id))
      for (const id of s.seenEffects) if (!alive.has(id)) s.seenEffects.delete(id)
    }

    // ── Météores en chute ──
    let mi = 0
    for (const e of engine.effects) {
      if (e.type !== 'meteor' || mi >= METEOR_POOL) continue
      const mesh = meteors.current[mi++]
      if (!mesh) continue
      const t = Math.min(1, (now - e.born) / e.ttl)
      const fall = Math.min(1, t * 2)
      if (fall >= 1) {
        mesh.visible = false
        continue
      }
      const [x, z] = toWorld(map, e.x, e.z)
      const k = fall * fall
      mesh.visible = true
      mesh.position.set(x - 3 * (1 - k), 0.3 + 7 * (1 - k), z - 2 * (1 - k))
      mesh.rotation.x += dt * 8
      mesh.rotation.y += dt * 5
      fx.sparks.emit({ x: mesh.position.x, y: mesh.position.y, z: mesh.position.z, count: 3, color: '#fef08a', colorEnd: '#dc2626', speed: 0.4, life: 0.4, size: 0.22, spread: 0.08 })
      fx.smoke.emit({ x: mesh.position.x, y: mesh.position.y, z: mesh.position.z, count: 1, color: '#57534e', colorEnd: '#1c1917', speed: 0.1, life: 0.7, size: 0.3, grow: 2 })
    }
    for (; mi < METEOR_POOL; mi++) {
      const mesh = meteors.current[mi]
      if (mesh) mesh.visible = false
    }

    // ── Anneaux ──
    for (const r of rings.current) {
      if (!r.mesh || r.born < 0) continue
      const t = (s.clock - r.born) / r.dur
      if (t >= 1) {
        r.born = -1
        r.mesh.visible = false
        continue
      }
      const e = 1 - Math.pow(1 - t, 3)
      r.mesh.scale.setScalar(r.from + (r.to - r.from) * e)
      ;(r.mesh.material as THREE.MeshBasicMaterial).opacity = r.opacity * (1 - t)
    }

    // ── Textes flottants ──
    for (const f of texts.current) {
      if (!f.sprite || f.born < 0) continue
      const t = (s.clock - f.born) / f.dur
      if (t >= 1) {
        f.born = -1
        f.sprite.visible = false
        continue
      }
      const popIn = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (t - 0.15) * 0.6)
      f.sprite.position.set(f.x + f.drift * t, f.y + t * 0.7, f.z)
      f.sprite.scale.set(f.size * f.aspect * popIn, f.size * popIn, 1)
      ;(f.sprite.material as THREE.SpriteMaterial).opacity = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1
    }

    // ── Gel : nappe de givre sur le plateau ──
    const targetIce = freezing ? (freezeLeft < 0.4 ? freezeLeft / 0.4 : 1) : 0
    if (!freezing && s.ice > 0.3) {
      // Fin du gel : la glace se brise
      for (let k = 0; k < 3; k++)
        fx.sparks.emit({ x: (Math.random() - 0.5) * map.width, y: 0.3, z: (Math.random() - 0.5) * map.depth, count: 12, color: '#f0f9ff', colorEnd: '#7dd3fc', speed: 1.5, up: 1.5, life: 0.6, size: 0.08, gravity: 4, spread: map.width * 0.15 })
    }
    s.ice = freezing ? THREE.MathUtils.lerp(s.ice, targetIce, Math.min(1, dt * 10)) : 0
    if (iceSheet.current) {
      iceSheet.current.visible = s.ice > 0.01
      ;(iceSheet.current.material as THREE.MeshStandardMaterial).opacity = s.ice * 0.42
    }

    // ── Lumière d'impact ──
    s.flash = Math.max(0, s.flash - dt * 12)
    if (flash.current) flash.current.intensity = s.flash

    fx.sparks.update(dt)
    fx.smoke.update(dt)
  })

  function projectilePos(p: Projectile, t: number, out: THREE.Vector3) {
    const [fx0, fz0] = toWorld(map, p.fromX, p.fromZ)
    const [tx, tz] = toWorld(map, p.toX, p.toZ)
    const y0 = (slotHeight.get(`${p.fromX},${p.fromZ}`) ?? 0.14) + MUZZLE_Y[p.kind]
    const y1 = 0.38
    const arc = p.kind === 'cannon' ? Math.sin(Math.PI * t) * 1.1 : p.kind === 'archer' ? Math.sin(Math.PI * t) * 0.25 : 0
    out.set(fx0 + (tx - fx0) * t, y0 + (y1 - y0) * t + arc, fz0 + (tz - fz0) * t)
    return out
  }

  function onImpact(p: Projectile) {
    const [x, z] = toWorld(map, p.toX, p.toZ)
    const color = p.element !== 'neutral' ? ELEMENTS[p.element].color : PROJECTILE_COLOR[p.kind]
    if (p.kind === 'mage') {
      fx.sparks.emit({ x, y: 0.4, z, count: 14, color: '#ffffff', colorEnd: color, speed: 1.8, life: 0.4, size: 0.1, drag: 3 })
      ring(x, 0.1, z, color, 0.1, 0.55, 0.35, 0.8)
    } else if (p.kind === 'frost') {
      fx.sparks.emit({ x, y: 0.4, z, count: 10, color: '#f0f9ff', colorEnd: '#38bdf8', speed: 1.3, life: 0.5, size: 0.08, gravity: 2 })
      ring(x, 0.1, z, '#bae6fd', 0.1, 0.45, 0.4, 0.7)
    } else if (p.kind === 'archer') {
      fx.sparks.emit({ x, y: 0.4, z, count: 5, color: p.element !== 'neutral' ? color : '#fef9c3', speed: 1.2, life: 0.25, size: 0.06, gravity: 3 })
    }
  }

  function showDamage(amount: number, e: EnemyState) {
    const [x, z] = toWorld(map, e.x, e.z)
    const v = Math.round(amount)
    if (v < 1) return
    const big = v >= 40
    const color = big ? '#fb923c' : v >= 15 ? '#fde047' : e.armored && v < 5 ? '#94a3b8' : '#ffffff'
    const y = (e.flying ? 1.6 : e.kind === 'boss' ? 1.6 : e.kind === 'tank' ? 1.1 : 0.75) + 0.1
    text(String(v), color, x, y, z, big ? 0.42 : v >= 15 ? 0.32 : 0.26, 0.8)
  }

  function onDeath(e: EnemyState) {
    const [x, z] = toWorld(map, e.x, e.z)
    const y = e.flying ? 1.1 : 0.35
    const color = ENEMIES[e.kind].color
    const boss = e.kind === 'boss'
    fx.sparks.emit({ x, y, z, count: boss ? 90 : 26, color: '#ffffff', colorEnd: color, speed: boss ? 3.5 : 2.2, up: 1.2, life: boss ? 1.1 : 0.6, size: boss ? 0.16 : 0.11, gravity: 3.5, drag: 1.8 })
    fx.smoke.emit({ x, y, z, count: boss ? 24 : 8, color, colorEnd: '#334155', speed: 0.7, up: 0.6, life: 0.8, size: boss ? 0.6 : 0.3, grow: 2, spread: 0.15, drag: 2.5 })
    ring(x, 0.07, z, color, 0.1, boss ? 2.4 : 0.8, boss ? 0.8 : 0.45, 0.8)
    text(`+${e.reward}`, '#fde68a', x, y + 0.7, z, boss ? 0.5 : 0.3, 1.1)
    if (boss) {
      lightFlash(x, 1.5, z, '#f87171', 6)
      fx.shake = Math.max(fx.shake, 0.45)
    }
  }

  return (
    <group>
      <primitive object={fx.smoke.points} />
      <primitive object={fx.sparks.points} />
      <pointLight ref={flash} intensity={0} distance={7} decay={1.6} />
      {Array.from({ length: PROJECTILE_POOL }, (_, i) => (
        <group key={`p${i}`} ref={(g) => void (projectiles.current[i] = g)} visible={false}>
          <group name="archer">
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.34, 4]} />
              <meshStandardMaterial color="#e7cfa1" />
            </mesh>
            <mesh position={[0, 0, 0.19]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.03, 0.07, 4]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh name="glow" position={[0, 0, -0.15]}>
              <boxGeometry args={[0.06, 0.005, 0.06]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
          </group>
          <group name="cannon">
            <mesh>
              <sphereGeometry args={[0.1, 12, 10]} />
              <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.4} emissive="#7c2d12" emissiveIntensity={0.6} />
            </mesh>
          </group>
          <group name="mage">
            <mesh name="glow">
              <sphereGeometry args={[0.1, 12, 10]} />
              <meshBasicMaterial color="#c4b5fd" toneMapped={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.055, 10, 8]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
          </group>
          <group name="frost">
            <mesh name="glow" scale={[0.7, 0.7, 2]}>
              <octahedronGeometry args={[0.07, 0]} />
              <meshBasicMaterial color="#7dd3fc" toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}
      {rings.current.map((r, i) => (
        <mesh key={`r${i}`} ref={(m) => void (r.mesh = m)} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={4}>
          <ringGeometry args={[0.82, 1, 48]} />
          <meshBasicMaterial transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {Array.from({ length: METEOR_POOL }, (_, i) => (
        <mesh key={`m${i}`} ref={(m) => void (meteors.current[i] = m)} visible={false}>
          <dodecahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial color="#451a03" emissive="#f97316" emissiveIntensity={2.5} flatShading />
        </mesh>
      ))}
      {texts.current.map((f, i) => (
        <sprite key={`t${i}`} ref={(sp) => void (f.sprite = sp)} visible={false} renderOrder={22}>
          <spriteMaterial depthTest={false} depthWrite={false} transparent toneMapped={false} />
        </sprite>
      ))}
      <mesh ref={iceSheet} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} visible={false} renderOrder={3}>
        <planeGeometry args={[map.width + 0.2, map.depth + 0.2]} />
        <meshStandardMaterial color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={0.4} roughness={0.05} metalness={0.3} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
