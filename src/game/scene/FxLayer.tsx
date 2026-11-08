import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { ELEMENTS, TOWERS } from '../../engine/balance'
import type { GameEngine } from '../../engine/engine'
import { toWorld } from './coords'

const PROJECTILE_POOL = 96
const EFFECT_POOL = 48

/**
 * Projectiles et effets visuels. Rendu impératif par pool d'objets :
 * aucun re-rendu React, tout est mis à jour dans useFrame à partir du moteur.
 */
export function FxLayer({ engine }: { engine: GameEngine }) {
  const projectiles = useRef<(THREE.Mesh | null)[]>([])
  const effects = useRef<(THREE.Mesh | null)[]>([])
  const freeze = useRef<THREE.Mesh>(null)
  const map = engine.config.map
  const color = new THREE.Color()

  useFrame(() => {
    const now = engine.time
    // Projectiles
    const ps = engine.projectiles
    for (let i = 0; i < PROJECTILE_POOL; i++) {
      const mesh = projectiles.current[i]
      if (!mesh) continue
      const p = ps[i]
      if (!p) {
        mesh.visible = false
        continue
      }
      const t = Math.min(1, (now - p.born) / p.ttl)
      const [fx, fz] = toWorld(map, p.fromX, p.fromZ)
      const [tx, tz] = toWorld(map, p.toX, p.toZ)
      mesh.visible = true
      mesh.position.set(fx + (tx - fx) * t, 0.95 + (0.35 - 0.95) * t + (p.kind === 'cannon' ? Math.sin(Math.PI * t) * 0.9 : 0), fz + (tz - fz) * t)
      mesh.scale.setScalar(p.kind === 'cannon' ? 1.4 : p.kind === 'mage' ? 1.2 : 0.8)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.color.set(p.element !== 'neutral' ? ELEMENTS[p.element].color : TOWERS[p.kind].color)
    }
    // Effets
    const es = engine.effects
    for (let i = 0; i < EFFECT_POOL; i++) {
      const mesh = effects.current[i]
      if (!mesh) continue
      const e = es[i]
      if (!e || e.type === 'freeze') {
        mesh.visible = false
        continue
      }
      const t = Math.min(1, (now - e.born) / e.ttl)
      const [x, z] = toWorld(map, e.x, e.z)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mesh.visible = true
      switch (e.type) {
        case 'explosion':
          mesh.position.set(x, 0.3, z)
          mesh.scale.setScalar(0.2 + t * 1.1)
          color.set('#fb923c')
          mat.opacity = 1 - t
          break
        case 'death':
          mesh.position.set(x, 0.3 + t * 0.6, z)
          mesh.scale.setScalar(0.15 + t * 0.4)
          color.set('#fef08a')
          mat.opacity = (1 - t) * 0.9
          break
        case 'spawn':
          mesh.position.set(x, 0.4, z)
          mesh.scale.setScalar(0.5 + t * 0.6)
          color.set('#c084fc')
          mat.opacity = (1 - t) * 0.7
          break
        case 'leak':
          mesh.position.set(x, 0.6, z)
          mesh.scale.setScalar(0.4 + t * 1.4)
          color.set('#ef4444')
          mat.opacity = (1 - t) * 0.8
          break
        case 'meteor': {
          const fall = Math.min(1, t * 2)
          mesh.position.set(x, 6 * (1 - fall) + 0.3, z)
          mesh.scale.setScalar(fall < 1 ? 0.25 : 0.25 + (t - 0.5) * 2.2)
          color.set(fall < 1 ? '#fde047' : '#f97316')
          mat.opacity = fall < 1 ? 1 : 1 - (t - 0.5) * 2
          break
        }
      }
      mat.color.copy(color)
    }
    // Gel global
    if (freeze.current) {
      const f = es.find((e) => e.type === 'freeze')
      freeze.current.visible = !!f
      if (f) {
        const t = (now - f.born) / f.ttl
        ;(freeze.current.material as THREE.MeshBasicMaterial).opacity = 0.22 * Math.min(1, t * 6) * (1 - Math.max(0, t - 0.8) * 5)
      }
    }
  })

  return (
    <group>
      {Array.from({ length: PROJECTILE_POOL }, (_, i) => (
        <mesh key={`p${i}`} ref={(m) => void (projectiles.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshBasicMaterial toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: EFFECT_POOL }, (_, i) => (
        <mesh key={`e${i}`} ref={(m) => void (effects.current[i] = m)} visible={false}>
          <sphereGeometry args={[0.5, 16, 12]} />
          <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <mesh ref={freeze} visible={false} position={[0, 0.6, 0]}>
        <boxGeometry args={[map.width + 0.4, 1.4, map.depth + 0.4]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
