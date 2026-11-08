import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ELEMENTS, ENEMIES, TOWERS } from '../../engine/balance'
import type { GameEngine } from '../../engine/engine'
import type { EnemyKind, EnemyState, TowerKind, TowerState } from '../../engine/types'
import { toWorld } from './coords'
import { floatingText } from './labels'
import type { FxBus } from './particles'

// ───────────────────────── Matériaux ─────────────────────────

/** Vrai quand la tour est inactive (impayée, invalide…) : rendu « hologramme » rouge. */
const GhostContext = createContext(false)

interface MatProps {
  c: string
  emissive?: string
  ei?: number
  metal?: number
  rough?: number
  opacity?: number
  flat?: boolean
}

function Mat({ c, emissive, ei = 0, metal = 0, rough = 0.75, opacity = 1, flat = true }: MatProps) {
  const ghost = useContext(GhostContext)
  if (ghost)
    return <meshStandardMaterial color="#f87171" emissive="#ef4444" emissiveIntensity={0.5} transparent opacity={0.32} depthWrite={false} flatShading />
  return (
    <meshStandardMaterial
      color={c}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={ei}
      metalness={metal}
      roughness={rough}
      transparent={opacity < 1}
      opacity={opacity}
      flatShading={flat}
    />
  )
}

const STONE = '#8f8a9c'
const STONE_DARK = '#6b6578'
const WOOD = '#9a6a3c'
const WOOD_DARK = '#6e4625'
const GOLD = '#facc15'

// ───────────────────────── Tours ─────────────────────────

/** Gemmes d'or sur le socle : une par niveau (1 à 3). */
function LevelPips({ level }: { level: number }) {
  const n = Math.max(1, Math.min(3, level))
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const a = (i - (n - 1) / 2) * 0.42
        return (
          <mesh key={i} position={[Math.sin(a) * 0.45, 0.09, Math.cos(a) * 0.45]} rotation={[0, a, Math.PI / 4]}>
            <boxGeometry args={[0.075, 0.075, 0.04]} />
            <Mat c={GOLD} emissive="#f59e0b" ei={level >= 3 ? 2.4 : 1.4} metal={0.6} rough={0.3} />
          </mesh>
        )
      })}
    </group>
  )
}

function Plinth({ level }: { level: number }) {
  return (
    <group>
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.44, 0.48, 0.16, 8]} />
        <Mat c={STONE_DARK} />
      </mesh>
      <LevelPips level={level} />
    </group>
  )
}

function Crenellations({ y, r, count = 8, size = 0.1, color = STONE }: { y: number; r: number; count?: number; size?: number; color?: string }) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * r, y, Math.sin(a) * r]} rotation={[0, -a, 0]} castShadow>
            <boxGeometry args={[size, size * 1.2, size]} />
            <Mat c={color} />
          </mesh>
        )
      })}
    </group>
  )
}

function Archer({ color, level }: { color: string; level: number }) {
  return (
    <group>
      <mesh position={[0, 0.54, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.32, 0.76, 8]} />
        <Mat c={WOOD} />
      </mesh>
      {[0.24, 0.62].slice(0, level >= 2 ? 2 : 1).map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <cylinderGeometry args={[0.33, 0.33, 0.06, 8]} />
          <Mat c={STONE} />
        </mesh>
      ))}
      <mesh position={[0, 0.96, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.34, 0.1, 8]} />
        <Mat c={WOOD_DARK} />
      </mesh>
      <Crenellations y={1.07} r={0.36} color={WOOD} />
      {[0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.3, 1.22, Math.sin(a) * 0.3]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.44, 5]} />
            <Mat c={WOOD_DARK} />
          </mesh>
        )
      })}
      <mesh position={[0, 1.62, 0]} castShadow>
        <coneGeometry args={[0.5, 0.42, 8]} />
        <Mat c={color} />
      </mesh>
      <mesh position={[0, 1.86, 0]}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <Mat c={GOLD} emissive="#f59e0b" ei={0.8} metal={0.6} rough={0.3} />
      </mesh>
      {level >= 2 &&
        [0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.31, 0.45, Math.sin(a) * 0.31]} rotation={[0, -a + Math.PI / 2, 0]} castShadow>
              <boxGeometry args={[0.16, 0.2, 0.03]} />
              <Mat c={color} />
            </mesh>
          )
        })}
      {level >= 3 && (
        <group position={[0, 1.9, 0]}>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.36, 4]} />
            <Mat c={WOOD_DARK} />
          </mesh>
          <mesh name="flag" position={[0.1, 0.29, 0]}>
            <boxGeometry args={[0.2, 0.12, 0.01]} />
            <Mat c={color} emissive={color} ei={0.6} />
          </mesh>
        </group>
      )}
      {/* Arbalète orientée vers la cible */}
      <group name="head" position={[0, 1.13, 0]}>
        <mesh position={[0, 0, 0.04]} castShadow>
          <boxGeometry args={[0.06, 0.06, 0.36]} />
          <Mat c={WOOD_DARK} />
        </mesh>
        <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.018, 5, 12, Math.PI]} />
          <Mat c={STONE_DARK} metal={0.4} />
        </mesh>
        <mesh position={[0, 0.03, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.3, 4]} />
          <Mat c="#e2e8f0" emissive={color} ei={0.6} />
        </mesh>
      </group>
    </group>
  )
}

function Cannon({ color, level }: { color: string; level: number }) {
  const barrelR = level >= 3 ? 0.13 : 0.11
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.45, 0.52, 8]} />
        <Mat c="#9aa0ab" />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.415, 0.415, 0.06, 8]} />
        <Mat c={color} emissive={color} ei={0.35} />
      </mesh>
      {level >= 2 && (
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.44, 0.44, 0.05, 8]} />
          <Mat c="#3b3f4a" metal={0.6} rough={0.4} />
        </mesh>
      )}
      <Crenellations y={0.74} r={0.37} size={0.12} color="#b3b8c2" />
      <group name="head" position={[0, 0.76, 0]}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <boxGeometry args={[0.3, 0.14, 0.34]} />
          <Mat c={WOOD_DARK} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.16, 0, 0.02]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.03, 10]} />
            <Mat c="#3b3f4a" metal={0.5} />
          </mesh>
        ))}
        <group rotation={[-0.22, 0, 0]} position={[0, 0.12, 0]}>
          <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[barrelR * 0.85, barrelR, 0.56, 12]} />
            <Mat c="#2b2f38" metal={0.7} rough={0.35} />
          </mesh>
          <mesh position={[0, 0, -0.1]}>
            <sphereGeometry args={[barrelR * 1.05, 12, 10]} />
            <Mat c="#2b2f38" metal={0.7} rough={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.45]}>
            <torusGeometry args={[barrelR * 0.9, 0.025, 6, 14]} />
            <Mat c={level >= 3 ? GOLD : color} emissive={level >= 3 ? '#f59e0b' : color} ei={0.9} metal={0.5} />
          </mesh>
          {level >= 2 && (
            <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[barrelR * 1.02, 0.02, 6, 14]} />
              <Mat c={GOLD} metal={0.7} rough={0.3} />
            </mesh>
          )}
          {/* Éclair de bouche, visible juste après un tir */}
          <mesh name="muzzle" position={[0, 0, 0.56]} visible={false}>
            <sphereGeometry args={[0.13, 10, 8]} />
            <meshBasicMaterial color="#fde68a" toneMapped={false} transparent opacity={0.95} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function Mage({ color, level }: { color: string; level: number }) {
  const runes = level >= 2 ? 5 : 3
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.4, 0.3, 6]} />
        <Mat c="#3b2a6b" />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.25, 0.9, 6]} />
        <Mat c="#5b3fa0" />
      </mesh>
      <mesh name="spiral" position={[0, 0.8, 0]} rotation={[Math.PI / 2 - 0.25, 0, 0]}>
        <torusGeometry args={[0.24, 0.02, 6, 24]} />
        <Mat c={color} emissive={color} ei={1.6} />
      </mesh>
      <mesh position={[0, 1.38, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.1, 0.14, 6]} />
        <Mat c="#3b2a6b" />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.17, 1.5, Math.sin(a) * 0.17]} rotation={[0, -a, 0.25]}>
            <coneGeometry args={[0.03, 0.2, 4]} />
            <Mat c={GOLD} metal={0.6} rough={0.3} />
          </mesh>
        )
      })}
      <group name="head" position={[0, 1.7, 0]}>
        <mesh name="crystal">
          <octahedronGeometry args={[0.18, 0]} />
          <Mat c={color} emissive={color} ei={2.4} rough={0.2} />
        </mesh>
        {Array.from({ length: runes }, (_, i) => {
          const a = (i / runes) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.32, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.32]} rotation={[0.6, a, 0.6]}>
              <boxGeometry args={[0.06, 0.06, 0.06]} />
              <Mat c={color} emissive={color} ei={1.8} />
            </mesh>
          )
        })}
        {level >= 3 && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.42, 0.015, 6, 32]} />
            <Mat c={GOLD} emissive="#f59e0b" ei={1.5} />
          </mesh>
        )}
      </group>
    </group>
  )
}

function Frost({ color, level }: { color: string; level: number }) {
  const shards = 4 + level
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.44, 0.28, 6]} />
        <Mat c="#d6e4f2" />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.3, 0.36, 0.06, 6]} />
        <Mat c="#eef6ff" />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 0.5
        return (
          <mesh key={i} position={[Math.cos(a) * 0.28, 0.66, Math.sin(a) * 0.28]} rotation={[Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]} castShadow>
            <coneGeometry args={[0.07, 0.48, 5]} />
            <Mat c={color} emissive={color} ei={0.6} opacity={0.85} rough={0.15} />
          </mesh>
        )
      })}
      <group name="head" position={[0, 0.5, 0]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <coneGeometry args={[0.15, 0.95, 6]} />
          <Mat c={color} emissive={color} ei={1.2} opacity={0.9} rough={0.1} />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.1, 0.3, 6]} />
          <Mat c={color} emissive={color} ei={1.2} opacity={0.9} rough={0.1} />
        </mesh>
        <group name="ring">
          {Array.from({ length: shards }, (_, i) => {
            const a = (i / shards) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 0.3, 0.45, Math.sin(a) * 0.3]} rotation={[0, -a, Math.PI / 2]}>
                <octahedronGeometry args={[0.06, 0]} />
                <Mat c="#f0f9ff" emissive={color} ei={1.4} />
              </mesh>
            )
          })}
        </group>
        {level >= 3 && (
          <mesh position={[0, 1.15, 0]}>
            <octahedronGeometry args={[0.08, 0]} />
            <Mat c="#ffffff" emissive={color} ei={3} />
          </mesh>
        )}
      </group>
    </group>
  )
}

function TowerBody({ kind, color, level }: { kind: TowerKind; color: string; level: number }) {
  switch (kind) {
    case 'archer':
      return <Archer color={color} level={level} />
    case 'cannon':
      return <Cannon color={color} level={level} />
    case 'mage':
      return <Mage color={color} level={level} />
    case 'frost':
      return <Frost color={color} level={level} />
  }
}

export function towerColor(t: Pick<TowerState, 'kind' | 'element'>): string {
  return t.element !== 'neutral' && t.element in ELEMENTS ? ELEMENTS[t.element].color : TOWERS[t.kind].color
}

export function TowerModel({ engine, fx, tower, leaving }: { engine: GameEngine; fx: FxBus; tower: TowerState; leaving: boolean }) {
  const root = useRef<THREE.Group>(null)
  const range = useRef<THREE.Mesh>(null)
  const warn = useRef<THREE.Sprite>(null)
  const anim = useRef({ s: 0, v: 0, level: tower.level, born: false, gone: false, ember: 0 })
  const map = engine.config.map
  const slot = map.slots.find((s) => s.id === tower.slot)
  const ghost = tower.status !== 'active'
  const kindOk = tower.kind in TOWERS
  const color = kindOk ? towerColor(tower) : '#ffffff'
  const level = Math.max(1, Math.min(3, Math.floor(tower.level) || 1))
  const warnTex = useMemo(() => floatingText('!', '#fca5a5'), [])
  const [wx, wz] = slot ? toWorld(map, slot.x, slot.z) : [0, 0]
  const baseY = slot?.high ? 0.42 : 0.14

  useFrame(({ clock }, delta) => {
    const g = root.current
    if (!g) return
    const a = anim.current
    const dt = Math.min(delta, 0.05)
    // Apparition (une seule fois) : petit nuage de poussière et étincelles
    if (!a.born) {
      a.born = true
      fx.smoke.emit({ x: wx, y: baseY + 0.1, z: wz, count: 14, color: '#d6c7a8', colorEnd: '#8a7d66', speed: 1.4, flat: true, life: 0.7, size: 0.32, grow: 1.8, drag: 4, up: 0.3 })
      if (!ghost) fx.sparks.emit({ x: wx, y: baseY + 0.5, z: wz, count: 18, color, speed: 1.6, up: 1.2, life: 0.7, size: 0.1, gravity: 2.5, spread: 0.2 })
    }
    // Montée de niveau : rebond + étincelles dorées
    if (level !== a.level) {
      if (level > a.level) {
        a.v += 5
        fx.sparks.emit({ x: wx, y: baseY + 0.8, z: wz, count: 26, color: '#fde68a', colorEnd: GOLD, speed: 1.2, up: 1.6, life: 0.9, size: 0.09, gravity: 1.5, spread: 0.3 })
      }
      a.level = level
    }
    if (leaving && !a.gone) {
      a.gone = true
      fx.smoke.emit({ x: wx, y: baseY + 0.5, z: wz, count: 18, color: '#cbd5e1', colorEnd: '#64748b', speed: 0.9, up: 0.6, life: 0.8, size: 0.35, grow: 2, spread: 0.25, drag: 3 })
    }
    // Ressort amorti : effet « pop » avec dépassement
    const target = leaving ? 0 : ghost ? 0.92 : 1
    const k = leaving ? 260 : 170
    a.v += (target - a.s) * k * dt
    a.v *= Math.exp(-dt * (leaving ? 22 : 11))
    a.s = Math.max(0, a.s + a.v * dt)
    g.scale.set(a.s, a.s * (1 + (level - 1) * 0.07), a.s)
    if (leaving) g.rotation.y += dt * 8

    const live = engine.towers.get(tower.id)
    const head = g.getObjectByName('head')
    const t = clock.elapsedTime
    if (head && live && !ghost) {
      const since = engine.time - live.lastShot
      const recoil = since >= 0 && since < 0.15 ? 1 - since / 0.15 : 0
      if (tower.kind === 'mage') {
        head.rotation.y = t * 1.6
        head.position.y = 1.7 + Math.sin(t * 2.5) * 0.06
        const crystal = head.getObjectByName('crystal')
        if (crystal) crystal.scale.setScalar(1 + recoil * 0.5)
        const spiral = g.getObjectByName('spiral')
        if (spiral) spiral.rotation.z = t * 2
      } else if (tower.kind === 'frost') {
        const ring = head.getObjectByName('ring')
        if (ring) ring.rotation.y = t * 1.2 + recoil * 2
        head.scale.setScalar(1 + recoil * 0.12)
      } else {
        let diff = live.aim - head.rotation.y
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        head.rotation.y += diff * Math.min(1, dt * 12)
        // Recul vers l'arrière, dans l'axe du tir
        head.position.x = -Math.sin(head.rotation.y) * recoil * 0.07
        head.position.z = -Math.cos(head.rotation.y) * recoil * 0.07
        const muzzle = head.getObjectByName('muzzle')
        if (muzzle) {
          muzzle.visible = recoil > 0.35
          muzzle.scale.setScalar(0.4 + recoil)
        }
      }
      const flag = g.getObjectByName('flag')
      if (flag) flag.rotation.y = Math.sin(t * 5) * 0.4
      // Aura élémentaire
      a.ember -= dt
      if (a.ember <= 0 && live.element !== 'neutral') {
        a.ember = 0.18 + Math.random() * 0.2
        const top = baseY + 1.2
        if (live.element === 'fire')
          fx.sparks.emit({ x: wx, y: top, z: wz, count: 1, color: '#fdba74', colorEnd: '#ef4444', speed: 0.15, up: 0.7, spread: 0.25, life: 1.1, size: 0.08, drag: 0.5 })
        else if (live.element === 'ice')
          fx.sparks.emit({ x: wx, y: top + 0.3, z: wz, count: 1, color: '#e0f2fe', colorEnd: '#7dd3fc', speed: 0.1, up: -0.25, spread: 0.35, life: 1.4, size: 0.07, drag: 0.5 })
        else if (live.element === 'storm')
          fx.sparks.emit({ x: wx, y: top, z: wz, count: 2, color: '#fef08a', colorEnd: '#facc15', speed: 1.4, spread: 0.2, life: 0.18, size: 0.06, drag: 0 })
      }
    }
    if (range.current) {
      const mat = range.current.material as THREE.MeshBasicMaterial
      mat.opacity = (0.1 + Math.sin(t * 2) * 0.03) * Math.min(1, a.s)
    }
    if (warn.current) {
      warn.current.visible = ghost && !leaving
      warn.current.position.y = 1.6 + Math.sin(t * 4) * 0.06
      warn.current.scale.set(0.3 * warnTex.aspect, 0.3, 1)
    }
  })
  if (!slot || !kindOk) return null
  return (
    <group position={[wx, baseY, wz]}>
      <group ref={root} scale={0.001}>
        <GhostContext.Provider value={ghost}>
          <Plinth level={level} />
          <TowerBody kind={tower.kind} color={color} level={level} />
        </GhostContext.Provider>
      </group>
      {!ghost && (
        <mesh ref={range} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03 - baseY, 0]} renderOrder={2}>
          <ringGeometry args={[Math.max(0.1, tower.range - 0.04), tower.range, 72]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <sprite ref={warn} visible={false} renderOrder={21}>
        <spriteMaterial map={warnTex.texture} depthTest={false} transparent toneMapped={false} />
      </sprite>
    </group>
  )
}

// ───────────────────────── Ennemis ─────────────────────────

let wingGeometry: THREE.ShapeGeometry | null = null
function getWingGeometry() {
  if (wingGeometry) return wingGeometry
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.quadraticCurveTo(0.12, 0.14, 0.34, 0.1)
  s.lineTo(0.3, 0.0)
  s.quadraticCurveTo(0.26, -0.06, 0.22, -0.02)
  s.quadraticCurveTo(0.18, -0.1, 0.12, -0.04)
  s.quadraticCurveTo(0.06, -0.1, 0, -0.04)
  s.closePath()
  wingGeometry = new THREE.ShapeGeometry(s, 6)
  wingGeometry.rotateX(-Math.PI / 2)
  return wingGeometry
}

function Eyes({ y, z, spread = 0.075, size = 0.055, pupil = '#0b1020', glow }: { y: number; z: number; spread?: number; size?: number; pupil?: string; glow?: string }) {
  return (
    <group name="eyes" position={[0, y, z]}>
      {[-spread, spread].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh>
            <sphereGeometry args={[size, 10, 8]} />
            {glow ? (
              <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.2} />
            ) : (
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            )}
          </mesh>
          {!glow && (
            <mesh position={[0, -size * 0.1, size * 0.72]}>
              <sphereGeometry args={[size * 0.5, 8, 6]} />
              <meshStandardMaterial color={pupil} roughness={0.2} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

function EnemyBody({ kind }: { kind: EnemyKind }) {
  const color = ENEMIES[kind].color
  switch (kind) {
    case 'grunt':
      return (
        <group>
          <mesh position={[0, 0.25, 0]} scale={[1, 0.92, 1]} castShadow>
            <sphereGeometry args={[0.22, 14, 10]} />
            <meshStandardMaterial color={color} flatShading roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.2, 0.12]} scale={[1, 0.8, 0.6]}>
            <sphereGeometry args={[0.14, 10, 8]} />
            <meshStandardMaterial color="#bef264" flatShading roughness={0.8} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.22, 0.33, -0.02]} rotation={[0, 0, -s * 1.15]} castShadow>
              <coneGeometry args={[0.06, 0.22, 5]} />
              <meshStandardMaterial color="#65a30d" flatShading />
            </mesh>
          ))}
          <Eyes y={0.31} z={0.16} />
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.075, 0.385, 0.2]} rotation={[0, 0, s * 0.45]}>
              <boxGeometry args={[0.09, 0.022, 0.02]} />
              <meshStandardMaterial color="#1a2e05" />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.045, 0.19, 0.205]} rotation={[0.3, 0, 0]}>
              <coneGeometry args={[0.018, 0.05, 4]} />
              <meshStandardMaterial color="#fffbeb" />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} name={s < 0 ? 'footL' : 'footR'} position={[s * 0.1, 0.045, 0]}>
              <sphereGeometry args={[0.065, 8, 6]} />
              <meshStandardMaterial color="#3f6212" flatShading />
            </mesh>
          ))}
        </group>
      )
    case 'runner':
      return (
        <group>
          <mesh position={[0, 0.24, 0]} rotation={[0.5, 0, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.2, 4, 10]} />
            <meshStandardMaterial color={color} flatShading roughness={0.6} />
          </mesh>
          <Eyes y={0.33} z={0.13} spread={0.06} size={0.05} />
          <mesh name="tail" position={[0, 0.3, -0.16]}>
            <boxGeometry args={[0.07, 0.025, 0.3]} />
            <meshStandardMaterial color="#ef4444" flatShading />
          </mesh>
          <mesh position={[0, 0.3, -0.02]}>
            <torusGeometry args={[0.105, 0.025, 6, 14]} />
            <meshStandardMaterial color="#ef4444" flatShading />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} name={s < 0 ? 'footL' : 'footR'} position={[s * 0.07, 0.06, 0]}>
              <capsuleGeometry args={[0.03, 0.08, 3, 6]} />
              <meshStandardMaterial color="#a16207" />
            </mesh>
          ))}
        </group>
      )
    case 'tank':
      return (
        <group>
          <mesh position={[0, 0.38, 0]} castShadow>
            <boxGeometry args={[0.46, 0.4, 0.36]} />
            <meshStandardMaterial color={color} flatShading metalness={0.45} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.38, 0.185]}>
            <boxGeometry args={[0.3, 0.24, 0.02]} />
            <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.66, 0.02]} castShadow>
            <boxGeometry args={[0.26, 0.18, 0.24]} />
            <meshStandardMaterial color="#64748b" flatShading metalness={0.45} />
          </mesh>
          <mesh position={[0, 0.67, 0.145]}>
            <boxGeometry args={[0.19, 0.045, 0.01]} />
            <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={3} toneMapped={false} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} name={s < 0 ? 'armL' : 'armR'} position={[s * 0.31, 0.52, 0]}>
              <mesh position={[0, -0.14, 0]} castShadow>
                <boxGeometry args={[0.13, 0.32, 0.15]} />
                <meshStandardMaterial color="#7c8799" flatShading metalness={0.4} />
              </mesh>
              <mesh position={[0, 0.03, 0]}>
                <boxGeometry args={[0.17, 0.08, 0.2]} />
                <meshStandardMaterial color="#475569" flatShading metalness={0.5} />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} name={s < 0 ? 'footL' : 'footR'} position={[s * 0.12, 0.08, 0]}>
              <boxGeometry args={[0.14, 0.16, 0.18]} />
              <meshStandardMaterial color="#475569" flatShading />
            </mesh>
          ))}
        </group>
      )
    case 'flyer':
      return (
        <group>
          <mesh castShadow>
            <sphereGeometry args={[0.14, 12, 10]} />
            <meshStandardMaterial color={color} flatShading roughness={0.6} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.08, 0.14, -0.01]} rotation={[0, 0, -s * 0.35]}>
              <coneGeometry args={[0.04, 0.12, 4]} />
              <meshStandardMaterial color="#be185d" flatShading />
            </mesh>
          ))}
          <Eyes y={0.03} z={0.11} spread={0.05} size={0.035} glow="#fde047" />
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.025, -0.05, 0.125]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.012, 0.04, 4]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <group key={s} name={s < 0 ? 'wingL' : 'wingR'} position={[s * 0.1, 0.02, 0]} scale={[s, 1, 1]}>
              <mesh geometry={getWingGeometry()} castShadow>
                <meshStandardMaterial color="#9d174d" flatShading side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'boss':
      return (
        <group>
          <mesh position={[0, 0.5, 0]} castShadow>
            <dodecahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial color="#7f1d1d" flatShading emissive="#450a0a" roughness={0.6} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.33, 0.82, 0]} rotation={[0, 0, -s * 0.7]} castShadow>
              <coneGeometry args={[0.07, 0.34, 5]} />
              <meshStandardMaterial color="#e7e5e4" flatShading />
            </mesh>
          ))}
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2
            return (
              <mesh key={i} position={[Math.cos(a) * 0.17, 0.96, Math.sin(a) * 0.17]}>
                <coneGeometry args={[0.05, 0.2, 4]} />
                <meshStandardMaterial color={GOLD} emissive="#ca8a04" emissiveIntensity={1.4} metalness={0.6} />
              </mesh>
            )
          })}
          <Eyes y={0.58} z={0.33} spread={0.13} size={0.065} glow="#f87171" />
          <mesh position={[0, 0.38, 0.36]}>
            <boxGeometry args={[0.24, 0.04, 0.02]} />
            <meshStandardMaterial color="#1c0505" />
          </mesh>
        </group>
      )
  }
}

const SCALE: Record<EnemyKind, number> = { grunt: 1.35, runner: 1.3, tank: 1.35, flyer: 1.4, boss: 1.55 }
const BAR_Y: Record<EnemyKind, number> = { grunt: 0.62, runner: 0.6, tank: 0.98, flyer: 1.55, boss: 1.72 }

function HealthBar({ state, y, width }: { state: React.RefObject<{ hp: number; maxHp: number }>; y: number; width: number }) {
  const group = useRef<THREE.Group>(null)
  const fill = useRef<THREE.Mesh>(null)
  const trail = useRef<THREE.Mesh>(null)
  const lag = useRef(1)
  useFrame((_, delta) => {
    const s = state.current
    if (!s || !fill.current || !trail.current || !group.current) return
    const ratio = Math.max(0, s.hp / s.maxHp)
    // Masquée tant que l'ennemi est intact
    group.current.visible = ratio < 0.999
    lag.current = Math.max(ratio, lag.current - delta * 0.9)
    fill.current.scale.x = Math.max(0.001, ratio)
    fill.current.position.x = (-(1 - ratio) * width) / 2
    trail.current.scale.x = Math.max(0.001, lag.current)
    trail.current.position.x = (-(1 - lag.current) * width) / 2
    ;(fill.current.material as THREE.MeshBasicMaterial).color.set(ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#facc15' : '#ef4444')
  })
  return (
    <Billboard position={[0, y, 0]}>
      <group ref={group} visible={false}>
        <mesh renderOrder={8}>
          <planeGeometry args={[width + 0.05, 0.1]} />
          <meshBasicMaterial color="#0b1020" transparent opacity={0.85} depthWrite={false} />
        </mesh>
        <mesh ref={trail} position={[0, 0, 0.001]} renderOrder={9}>
          <planeGeometry args={[width, 0.06]} />
          <meshBasicMaterial color="#fff7ed" transparent opacity={0.85} depthWrite={false} />
        </mesh>
        <mesh ref={fill} position={[0, 0, 0.002]} renderOrder={10}>
          <planeGeometry args={[width, 0.06]} />
          <meshBasicMaterial color="#4ade80" toneMapped={false} depthWrite={false} transparent />
        </mesh>
      </group>
    </Billboard>
  )
}

interface FlashMat {
  mat: THREE.MeshStandardMaterial
  emissive: THREE.Color
  intensity: number
}

const WHITE = new THREE.Color('#ffffff')
const ICE = new THREE.Color('#7dd3fc')
const tmpColor = new THREE.Color()

/** Vrai pendant le sort de gel (effet global). */
export function isFrozen(engine: GameEngine): boolean {
  for (const e of engine.effects) if (e.type === 'freeze') return true
  return false
}

export function EnemyModel({ engine, id, kind }: { engine: GameEngine; id: number; kind: EnemyKind }) {
  const ref = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const ice = useRef<THREE.Mesh>(null)
  const map = engine.config.map
  const st = useRef({ phase: Math.random() * 10, hp: -1, maxHp: 1, flash: 0, squash: 0, mats: null as FlashMat[] | null, blink: 2 + Math.random() * 3, spawn: 0, iceAmt: 0 })
  const hpState = useRef({ hp: 1, maxHp: 1 })
  const scale = SCALE[kind]

  useFrame(({ clock }, delta) => {
    let e: EnemyState | undefined
    for (const x of engine.enemies) if (x.id === id) e = x
    const g = ref.current
    if (!e || !g) return
    const s = st.current
    const dt = Math.min(delta, 0.05)
    if (!s.mats && body.current) {
      // Matériaux propres à cet ennemi : on peut les faire flasher indépendamment.
      s.mats = []
      body.current.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
        if (m && 'emissive' in m) s.mats!.push({ mat: m, emissive: m.emissive.clone(), intensity: m.emissiveIntensity })
      })
    }
    // Flash blanc quand l'ennemi perd des PV
    if (s.hp >= 0 && e.hp < s.hp - 0.01) {
      s.flash = 1
      s.squash = 1
    }
    s.hp = e.hp
    hpState.current.hp = e.hp
    hpState.current.maxHp = e.maxHp

    const [wx, wz] = toWorld(map, e.x, e.z)
    const first = g.userData.init !== true
    g.userData.init = true
    const dx = wx - g.position.x
    const dz = wz - g.position.z
    if (first) g.position.set(wx, 0, wz)
    else {
      g.position.x = wx
      g.position.z = wz
      if (Math.abs(dx) + Math.abs(dz) > 0.0005) {
        let diff = Math.atan2(dx, dz) - g.rotation.y
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        g.rotation.y += diff * Math.min(1, dt * 10)
      }
    }
    const frozen = isFrozen(engine)
    const slowed = engine.time < e.slowUntil
    const moving = engine.phase === 'wave' && !frozen
    const speedMul = slowed ? 0.45 : 1
    if (moving) s.phase += dt * e.speed * 7 * speedMul
    const t = s.phase
    const b = body.current
    if (b) {
      if (e.flying) {
        b.position.y = 1.05 + Math.sin(t * 0.5) * 0.1
        const wl = b.getObjectByName('wingL')
        const wr = b.getObjectByName('wingR')
        const flap = moving ? Math.sin(t * 2.2) * 0.75 : 0.2
        if (wl) wl.rotation.z = flap
        if (wr) wr.rotation.z = -flap
      } else {
        const hop = Math.abs(Math.sin(t))
        b.position.y = hop * (kind === 'tank' || kind === 'boss' ? 0.03 : 0.07)
        const fl = b.getObjectByName('footL')
        const fr = b.getObjectByName('footR')
        if (fl) fl.position.z = Math.sin(t) * 0.07
        if (fr) fr.position.z = -Math.sin(t) * 0.07
        const al = b.getObjectByName('armL')
        const ar = b.getObjectByName('armR')
        if (al) al.rotation.x = Math.sin(t) * 0.5
        if (ar) ar.rotation.x = -Math.sin(t) * 0.5
        const tail = b.getObjectByName('tail')
        if (tail) tail.rotation.y = Math.sin(t * 2.5) * 0.4
      }
      // Clignement des yeux
      s.blink -= dt
      const eyes = b.getObjectByName('eyes')
      if (eyes) {
        eyes.scale.y = s.blink < 0.12 ? 0.15 : 1
        if (s.blink < 0) s.blink = 2 + Math.random() * 3
      }
      // Écrasement / étirement (marche + impact)
      s.squash = Math.max(0, s.squash - dt * 6)
      const walk = e.flying ? 0 : Math.sin(t * 2) * 0.04
      const sq = s.squash * 0.18
      b.scale.set(1 + sq - walk, 1 - sq + walk, 1 + sq - walk)
    }
    // Flash + teinte glacée
    s.flash = Math.max(0, s.flash - dt * 9)
    s.iceAmt = THREE.MathUtils.lerp(s.iceAmt, frozen ? 1 : slowed ? 0.55 : 0, Math.min(1, dt * 8))
    if (s.mats)
      for (const m of s.mats) {
        tmpColor.copy(m.emissive).lerp(ICE, s.iceAmt * 0.6).lerp(WHITE, s.flash)
        m.mat.emissive.copy(tmpColor)
        m.mat.emissiveIntensity = m.intensity + s.iceAmt * 0.5 * (m.intensity < 0.5 ? 1 : 0) + s.flash * 2.5
      }
    if (ice.current) {
      ice.current.visible = frozen
      if (frozen) ice.current.rotation.y = 0.3
    }
    // Apparition : grossit depuis le portail avec un léger rebond
    s.spawn = Math.min(1, s.spawn + dt * 3)
    const k = s.spawn
    const pop = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.25 : 1
    g.scale.setScalar(scale * Math.max(0.01, k) * pop)
    void clock
  })
  const iceY = kind === 'flyer' ? 1.05 : kind === 'tank' || kind === 'boss' ? 0.42 : 0.26
  const iceS = kind === 'boss' ? 1.15 : kind === 'tank' ? 0.85 : 0.6
  return (
    <group ref={ref} scale={0.01}>
      <group ref={body}>
        <EnemyBody kind={kind} />
      </group>
      <mesh ref={ice} visible={false} position={[0, iceY, 0]} scale={iceS}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#bae6fd" emissive="#38bdf8" emissiveIntensity={0.35} transparent opacity={0.45} roughness={0.05} metalness={0.1} depthWrite={false} />
      </mesh>
      <HealthBar state={hpState} y={BAR_Y[kind] / scale + 0.05} width={kind === 'boss' ? 0.75 : 0.42} />
    </group>
  )
}
