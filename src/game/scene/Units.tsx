import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { ELEMENTS, ENEMIES, TOWERS } from '../../engine/balance'
import type { GameEngine } from '../../engine/engine'
import type { EnemyKind, TowerKind, TowerState } from '../../engine/types'
import { toWorld } from './coords'

// ───────────────────────── Tours ─────────────────────────

function TowerBody({ kind, color, ghost }: { kind: TowerKind; color: string; ghost: boolean }) {
  const mat = (c: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => (
    <meshStandardMaterial color={ghost ? '#f87171' : c} transparent={ghost} opacity={ghost ? 0.35 : 1} flatShading {...extra} />
  )
  switch (kind) {
    case 'archer':
      return (
        <group>
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.28, 0.7, 6]} />
            {mat('#a0703f')}
          </mesh>
          <mesh position={[0, 0.74, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.26, 0.12, 6]} />
            {mat('#8a5a30')}
          </mesh>
          <mesh name="head" position={[0, 0.98, 0]} castShadow>
            <coneGeometry args={[0.32, 0.4, 6]} />
            {mat(color)}
          </mesh>
        </group>
      )
    case 'cannon':
      return (
        <group>
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.4, 0.44, 8]} />
            {mat('#9ca3af')}
          </mesh>
          <group name="head" position={[0, 0.55, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.22, 12, 10]} />
              {mat('#4b5563')}
            </mesh>
            <mesh position={[0, 0.02, 0.24]} rotation={[Math.PI / 2 - 0.25, 0, 0]} castShadow>
              <cylinderGeometry args={[0.09, 0.11, 0.42, 10]} />
              {mat('#1f2937')}
            </mesh>
            <mesh position={[0, 0.07, 0.44]} rotation={[Math.PI / 2 - 0.25, 0, 0]}>
              <torusGeometry args={[0.1, 0.025, 6, 12]} />
              {mat(color, { emissive: color, emissiveIntensity: 0.6 })}
            </mesh>
          </group>
        </group>
      )
    case 'mage':
      return (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.26, 0.9, 6]} />
            {mat('#4c1d95')}
          </mesh>
          <mesh position={[0, 0.95, 0]} castShadow>
            <coneGeometry args={[0.2, 0.25, 6]} />
            {mat('#6d28d9')}
          </mesh>
          <mesh name="head" position={[0, 1.35, 0]}>
            <octahedronGeometry args={[0.17, 0]} />
            {mat(color, { emissive: color, emissiveIntensity: ghost ? 0 : 2.2 })}
          </mesh>
        </group>
      )
    case 'frost':
      return (
        <group>
          <mesh position={[0, 0.15, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.36, 0.3, 6]} />
            {mat('#cbd5e1')}
          </mesh>
          <group name="head" position={[0, 0.3, 0]}>
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} position={[Math.cos(i * 1.256) * 0.14 * (i ? 1 : 0), 0.3 + (i ? 0 : 0.15), Math.sin(i * 1.256) * 0.14 * (i ? 1 : 0)]} rotation={[0, 0, (i ? 0.35 : 0) * (i % 2 ? 1 : -1)]} castShadow>
                <coneGeometry args={[i ? 0.08 : 0.12, i ? 0.5 : 0.8, 5]} />
                {mat(color, { emissive: color, emissiveIntensity: ghost ? 0 : 0.8, transparent: true, opacity: ghost ? 0.35 : 0.9 })}
              </mesh>
            ))}
          </group>
        </group>
      )
  }
}

export function TowerModel({ engine, tower }: { engine: GameEngine; tower: TowerState }) {
  const root = useRef<THREE.Group>(null)
  const range = useRef<THREE.Mesh>(null)
  const map = engine.config.map
  const slot = map.slots.find((s) => s.id === tower.slot)
  const ghost = tower.status !== 'active'
  const kindOk = tower.kind in TOWERS
  useFrame(({ clock }, delta) => {
    const g = root.current
    if (!g) return
    const live = engine.towers.get(tower.id)
    const targetScale = ghost ? 0.9 : 1
    const s = THREE.MathUtils.lerp(g.scale.x, targetScale, Math.min(1, delta * 8))
    g.scale.setScalar(s)
    const head = g.getObjectByName('head')
    if (head && live) {
      if (tower.kind === 'mage') {
        head.rotation.y = clock.elapsedTime * 2
        head.position.y = 1.35 + Math.sin(clock.elapsedTime * 3) * 0.06
      } else {
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, live.aim, Math.min(1, delta * 12))
      }
      const recoil = engine.time - live.lastShot < 0.12 ? 0.92 : 1
      head.scale.setScalar(THREE.MathUtils.lerp(head.scale.x, recoil, 0.5))
    }
    if (range.current) {
      const mat = range.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.08 + Math.sin(clock.elapsedTime * 2) * 0.03
    }
  })
  if (!slot || !kindOk) return null
  const [wx, wz] = toWorld(map, slot.x, slot.z)
  const baseY = slot.high ? 0.42 : 0.14
  const color = tower.element !== 'neutral' && tower.element in ELEMENTS ? ELEMENTS[tower.element].color : TOWERS[tower.kind].color
  return (
    <group position={[wx, baseY, wz]}>
      <group ref={root} scale={0.01}>
        <TowerBody kind={tower.kind} color={color} ghost={ghost} />
        {!ghost &&
          Array.from({ length: Math.max(0, Math.min(3, tower.level) - 1) }, (_, i) => (
            <mesh key={i} position={[Math.cos(i * 2.4 + 0.6) * 0.38, 0.08, Math.sin(i * 2.4 + 0.6) * 0.38]}>
              <octahedronGeometry args={[0.07, 0]} />
              <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={2} />
            </mesh>
          ))}
      </group>
      {!ghost && (
        <mesh ref={range} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02 - baseY + 0.01, 0]}>
          <ringGeometry args={[tower.range - 0.05, tower.range, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

// ───────────────────────── Ennemis ─────────────────────────

function EnemyBody({ kind }: { kind: EnemyKind }) {
  const color = ENEMIES[kind].color
  const eyes = (y: number, z: number, spread = 0.07, size = 0.045) => (
    <>
      {[-spread, spread].map((x) => (
        <mesh key={x} position={[x, y, z]}>
          <sphereGeometry args={[size, 8, 6]} />
          <meshStandardMaterial color="#fff" emissive="#fef9c3" emissiveIntensity={0.6} />
        </mesh>
      ))}
    </>
  )
  switch (kind) {
    case 'grunt':
      return (
        <group>
          <mesh position={[0, 0.2, 0]} castShadow>
            <sphereGeometry args={[0.2, 12, 10]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
          {eyes(0.26, 0.16)}
          {[-0.17, 0.17].map((x) => (
            <mesh key={x} position={[x, 0.33, 0]} rotation={[0, 0, x > 0 ? -0.6 : 0.6]}>
              <coneGeometry args={[0.05, 0.16, 4]} />
              <meshStandardMaterial color="#65a30d" />
            </mesh>
          ))}
        </group>
      )
    case 'runner':
      return (
        <group>
          <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2.4, 0, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.22, 4, 8]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
          {eyes(0.24, 0.15, 0.05, 0.035)}
        </group>
      )
    case 'tank':
      return (
        <group>
          <mesh position={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[0.42, 0.42, 0.42]} />
            <meshStandardMaterial color={color} flatShading metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.52, 0]} castShadow>
            <boxGeometry args={[0.26, 0.16, 0.26]} />
            <meshStandardMaterial color="#64748b" flatShading metalness={0.4} />
          </mesh>
          <mesh position={[0, 0.53, 0.14]}>
            <boxGeometry args={[0.18, 0.04, 0.01]} />
            <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={2} />
          </mesh>
        </group>
      )
    case 'flyer':
      return (
        <group>
          <mesh castShadow>
            <sphereGeometry args={[0.13, 10, 8]} />
            <meshStandardMaterial color={color} flatShading />
          </mesh>
          {eyes(0.04, 0.11, 0.05, 0.03)}
          {[-1, 1].map((side) => (
            <mesh key={side} name={side < 0 ? 'wingL' : 'wingR'} position={[side * 0.12, 0, 0]}>
              <boxGeometry args={[0.26, 0.015, 0.16]} />
              <meshStandardMaterial color="#be185d" flatShading />
            </mesh>
          ))}
        </group>
      )
    case 'boss':
      return (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow>
            <dodecahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial color="#7f1d1d" flatShading emissive="#450a0a" />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos(i * 1.256) * 0.2, 0.92, Math.sin(i * 1.256) * 0.2]}>
              <coneGeometry args={[0.06, 0.22, 4]} />
              <meshStandardMaterial color="#facc15" emissive="#ca8a04" emissiveIntensity={1.2} />
            </mesh>
          ))}
          {eyes(0.55, 0.36, 0.13, 0.06)}
        </group>
      )
  }
}

function HealthBar({ engine, id, y, width }: { engine: GameEngine; id: number; y: number; width: number }) {
  const fill = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const e = engine.enemies.find((x) => x.id === id)
    if (!e || !fill.current) return
    const ratio = Math.max(0, e.hp / e.maxHp)
    fill.current.scale.x = Math.max(0.001, ratio)
    fill.current.position.x = (-(1 - ratio) * width) / 2
    ;(fill.current.material as THREE.MeshBasicMaterial).color.set(ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#facc15' : '#ef4444')
  })
  return (
    <Billboard position={[0, y, 0]}>
      <mesh>
        <planeGeometry args={[width + 0.04, 0.09]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.8} />
      </mesh>
      <mesh ref={fill} position={[0, 0, 0.001]}>
        <planeGeometry args={[width, 0.06]} />
        <meshBasicMaterial color="#4ade80" />
      </mesh>
    </Billboard>
  )
}

export function EnemyModel({ engine, id, kind }: { engine: GameEngine; id: number; kind: EnemyKind }) {
  const ref = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const map = engine.config.map
  const phase = useRef(Math.random() * 10)
  useFrame(({ clock }, delta) => {
    const e = engine.enemies.find((x) => x.id === id)
    const g = ref.current
    if (!e || !g) return
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
        const target = Math.atan2(dx, dz)
        let diff = target - g.rotation.y
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        g.rotation.y += diff * Math.min(1, delta * 10)
      }
    }
    const t = clock.elapsedTime * (e.speed * 6) + phase.current
    const frozen = engine.time < e.slowUntil
    if (body.current) {
      if (e.flying) {
        body.current.position.y = 1.0 + Math.sin(t * 0.6) * 0.1
        const wl = body.current.getObjectByName('wingL')
        const wr = body.current.getObjectByName('wingR')
        if (wl && wr) {
          wl.rotation.z = Math.sin(t * 2) * 0.7
          wr.rotation.z = -Math.sin(t * 2) * 0.7
        }
      } else {
        body.current.position.y = Math.abs(Math.sin(t)) * 0.06
      }
      body.current.scale.setScalar(frozen ? 0.92 : 1)
    }
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x || 0.01, 1, Math.min(1, delta * 6)))
  })
  const barY = kind === 'boss' ? 1.25 : kind === 'flyer' ? 1.35 : kind === 'tank' ? 0.8 : 0.6
  return (
    <group ref={ref} scale={0.01}>
      <group ref={body}>
        <EnemyBody kind={kind} />
      </group>
      <HealthBar engine={engine} id={id} y={barY} width={kind === 'boss' ? 0.9 : 0.5} />
    </group>
  )
}
