import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { MapDef } from '../../engine/types'
import { mulberry32, pathCells, toWorld } from './coords'
import { slotLabel } from './labels'

const GRASS = ['#4f9d55', '#58a85c', '#4a9450', '#5fae60', '#529f57']
const PATH = ['#d9b77e', '#cfab70', '#e0c08a']

function Tiles({ map }: { map: MapDef }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const path = useMemo(() => pathCells(map), [map])
  const count = map.width * map.depth
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const rnd = mulberry32(map.width * 97 + map.depth)
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    let i = 0
    for (let x = 0; x < map.width; x++) {
      for (let z = 0; z < map.depth; z++) {
        const onPath = path.has(`${x},${z}`)
        const [wx, wz] = toWorld(map, x, z)
        const h = onPath ? 0.42 : 0.5 + rnd() * 0.04
        m.makeScale(0.98, h, 0.98)
        m.setPosition(wx, h / 2 - 0.5, wz)
        mesh.setMatrixAt(i, m)
        const palette = onPath ? PATH : GRASS
        c.set(palette[Math.floor(rnd() * palette.length)])
        mesh.setColorAt(i, c)
        i++
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [map, path])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} receiveShadow castShadow={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
  )
}

function Decor({ map }: { map: MapDef }) {
  const items = useMemo(() => {
    const path = pathCells(map)
    const blocked = new Set(path)
    for (const s of map.slots) blocked.add(`${s.x},${s.z}`)
    const rnd = mulberry32(map.width * 31 + map.depth * 7 + map.slots.length)
    const out: { kind: 'tree' | 'rock' | 'crystal'; x: number; z: number; s: number; r: number }[] = []
    if (map.decor) for (const d of map.decor) out.push({ ...d, s: 1, r: 0 })
    else {
      for (let x = 0; x < map.width; x++)
        for (let z = 0; z < map.depth; z++) {
          if (blocked.has(`${x},${z}`)) continue
          const roll = rnd()
          if (roll < 0.22) out.push({ kind: 'tree', x: x + (rnd() - 0.5) * 0.3, z: z + (rnd() - 0.5) * 0.3, s: 0.7 + rnd() * 0.5, r: rnd() * 6 })
          else if (roll < 0.3) out.push({ kind: 'rock', x, z, s: 0.5 + rnd() * 0.5, r: rnd() * 6 })
          else if (roll < 0.33) out.push({ kind: 'crystal', x, z, s: 0.6 + rnd() * 0.4, r: rnd() * 6 })
        }
    }
    return out
  }, [map])
  return (
    <group>
      {items.map((d, i) => {
        const [wx, wz] = toWorld(map, d.x, d.z)
        if (d.kind === 'tree')
          return (
            <group key={i} position={[wx, 0, wz]} scale={d.s} rotation={[0, d.r, 0]}>
              <mesh position={[0, 0.2, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.09, 0.4, 6]} />
                <meshStandardMaterial color="#7a5233" />
              </mesh>
              <mesh position={[0, 0.6, 0]} castShadow>
                <coneGeometry args={[0.32, 0.6, 7]} />
                <meshStandardMaterial color="#2f7d46" flatShading />
              </mesh>
              <mesh position={[0, 0.88, 0]} castShadow>
                <coneGeometry args={[0.22, 0.42, 7]} />
                <meshStandardMaterial color="#3b9455" flatShading />
              </mesh>
            </group>
          )
        if (d.kind === 'rock')
          return (
            <mesh key={i} position={[wx, 0.08, wz]} scale={d.s * 0.3} rotation={[d.r, d.r, 0]} castShadow>
              <dodecahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color="#8a93a6" flatShading roughness={1} />
            </mesh>
          )
        return (
          <mesh key={i} position={[wx, 0.25, wz]} scale={d.s * 0.25} rotation={[0, d.r, 0.2]}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={1.4} flatShading />
          </mesh>
        )
      })}
    </group>
  )
}

function SlotPad({ map, id, x, z, high, occupied }: { map: MapDef; id: string; x: number; z: number; high?: boolean; occupied: boolean }) {
  const ring = useRef<THREE.Mesh>(null)
  const label = useRef<THREE.Sprite>(null)
  const [wx, wz] = toWorld(map, x, z)
  const h = high ? 0.42 : 0.14
  const tex = useMemo(() => slotLabel(id, occupied, !!high), [id, occupied, high])
  useFrame(({ clock }, delta) => {
    if (ring.current) {
      const mat = ring.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = occupied ? 0.15 : 1.2 + Math.sin(clock.elapsedTime * 3 + x) * 0.6
      ring.current.visible = !occupied
    }
    if (label.current) {
      // L'étiquette monte au-dessus de la tour quand le slot est occupé.
      const targetY = h + (occupied ? 2.05 : 0.95 + Math.sin(clock.elapsedTime * 2 + x * 0.7 + z) * 0.05)
      label.current.position.y = THREE.MathUtils.lerp(label.current.position.y, targetY, Math.min(1, delta * 6))
      const s = occupied ? 0.62 : 0.78
      label.current.scale.set(s * tex.aspect, s, 1)
    }
  })
  return (
    <group position={[wx, 0, wz]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.44, 0.5, h, 8]} />
        <meshStandardMaterial color={high ? '#a3a7b8' : '#b9b2a3'} flatShading roughness={0.8} />
      </mesh>
      <mesh ref={ring} position={[0, h + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.38, 32]} />
        <meshStandardMaterial color="#61dafb" emissive="#61dafb" transparent opacity={0.85} />
      </mesh>
      <sprite ref={label} position={[0, h + 0.95, 0]} renderOrder={20}>
        <spriteMaterial map={tex.texture} depthTest={false} depthWrite={false} transparent toneMapped={false} />
      </sprite>
    </group>
  )
}

function Portal({ map }: { map: MapDef }) {
  const ref = useRef<THREE.Group>(null)
  const p = map.path[0]
  const n = map.path[1]
  const [wx, wz] = toWorld(map, p.x, p.z)
  const angle = Math.atan2(n.x - p.x, n.z - p.z)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.children[0].rotation.z = clock.elapsedTime * 1.5
  })
  return (
    <group ref={ref} position={[wx, 0.55, wz]} rotation={[0, angle, 0]}>
      <mesh>
        <torusGeometry args={[0.45, 0.07, 10, 40]} />
        <meshStandardMaterial color="#c084fc" emissive="#a855f7" emissiveIntensity={3} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.4, 32]} />
        <meshBasicMaterial color="#3b0764" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <pointLight color="#a855f7" intensity={4} distance={3} />
    </group>
  )
}

function Castle({ map }: { map: MapDef }) {
  const flag = useRef<THREE.Mesh>(null)
  const p = map.path[map.path.length - 1]
  const [wx, wz] = toWorld(map, p.x, p.z)
  useFrame(({ clock }) => {
    if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 4) * 0.3
  })
  const turret = (x: number, z: number) => (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.9, 8]} />
        <meshStandardMaterial color="#e5e7eb" flatShading />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <coneGeometry args={[0.22, 0.35, 8]} />
        <meshStandardMaterial color="#3b82f6" flatShading />
      </mesh>
    </group>
  )
  return (
    <group position={[wx, 0, wz]}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
        <meshStandardMaterial color="#d1d5db" flatShading />
      </mesh>
      <mesh position={[0, 0.25, 0.41]}>
        <boxGeometry args={[0.24, 0.34, 0.02]} />
        <meshStandardMaterial color="#5b3a29" />
      </mesh>
      {turret(-0.38, -0.38)}
      {turret(0.38, -0.38)}
      {turret(-0.38, 0.38)}
      {turret(0.38, 0.38)}
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.8, 4]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh ref={flag} position={[0.14, 1.28, 0]}>
        <boxGeometry args={[0.28, 0.16, 0.01]} />
        <meshStandardMaterial color="#61dafb" emissive="#61dafb" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

export function Terrain({ map, occupied }: { map: MapDef; occupied: Set<string> }) {
  return (
    <group>
      {/* Socle de terre sous le plateau */}
      <mesh position={[0, -0.85, 0]} receiveShadow>
        <boxGeometry args={[map.width + 0.3, 0.7, map.depth + 0.3]} />
        <meshStandardMaterial color="#6b4430" flatShading />
      </mesh>
      <mesh position={[0, -1.35, 0]}>
        <boxGeometry args={[map.width - 0.4, 0.3, map.depth - 0.4]} />
        <meshStandardMaterial color="#4a2e20" flatShading />
      </mesh>
      <Tiles map={map} />
      <Decor map={map} />
      {map.slots.map((s) => (
        <SlotPad key={s.id} map={map} {...s} occupied={occupied.has(s.id)} />
      ))}
      <Portal map={map} />
      <Castle map={map} />
    </group>
  )
}
