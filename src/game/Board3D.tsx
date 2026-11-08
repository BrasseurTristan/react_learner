import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import type { GameEngine } from '../engine/engine'
import type { EnemyKind, TowerState } from '../engine/types'
import { Ambience } from './scene/Ambience'
import { CameraRig } from './scene/CameraRig'
import { FxLayer } from './scene/FxLayer'
import { Terrain } from './scene/Terrain'
import { EnemyModel, TowerModel } from './scene/Units'

/** Délai pendant lequel une tour retirée reste affichée pour son animation de disparition. */
const TOWER_EXIT_MS = 450

/**
 * Sélecteurs « signature » : React ne re-rend la scène que quand la liste des tours,
 * des ennemis ou des slots occupés change — jamais à chaque frame.
 */
function towerSignature(engine: GameEngine) {
  let sig = ''
  for (const t of engine.towers.values()) sig += `${t.id}:${t.slot}:${t.kind}:${t.level}:${t.element}:${t.status}:${t.range.toFixed(2)}|`
  return sig
}
function enemySignature(engine: GameEngine) {
  let sig = ''
  for (const e of engine.enemies) sig += `${e.id}:${e.kind}|`
  return sig
}
function occupiedSignature(engine: GameEngine) {
  let sig = ''
  for (const t of engine.towers.values()) if (t.status === 'active') sig += `${t.slot}|`
  return sig
}

type RenderedTower = TowerState & { leaving?: boolean }

/** Garde les tours retirées quelques instants pour animer leur disparition. */
function useTowerPresence(engine: GameEngine, sig: string): RenderedTower[] {
  const [, force] = useState(0)
  const leaving = useRef(new Map<string, { tower: TowerState; until: number }>())
  const previous = useRef(new Map<string, TowerState>())
  const current = useMemo(() => {
    const now = performance.now()
    const live = new Map<string, TowerState>()
    for (const t of engine.towers.values()) live.set(t.id, { ...t })
    for (const [id, t] of previous.current) if (!live.has(id) && !leaving.current.has(id)) leaving.current.set(id, { tower: t, until: now + TOWER_EXIT_MS })
    for (const id of live.keys()) leaving.current.delete(id)
    previous.current = live
    return live
  }, [sig, engine])
  useEffect(() => {
    if (!leaving.current.size) return
    const t = setTimeout(() => {
      const now = performance.now()
      for (const [id, l] of leaving.current) if (l.until <= now) leaving.current.delete(id)
      force((n) => n + 1)
    }, TOWER_EXIT_MS + 20)
    return () => clearTimeout(t)
  })
  const out: RenderedTower[] = [...current.values()]
  for (const l of leaving.current.values()) out.push({ ...l.tower, leaving: true })
  return out
}

function Scene({ engine }: { engine: GameEngine }) {
  const map = engine.config.map
  const tSig = useSyncExternalStore(engine.subscribe, () => towerSignature(engine))
  const eSig = useSyncExternalStore(engine.subscribe, () => enemySignature(engine))
  const oSig = useSyncExternalStore(engine.subscribe, () => occupiedSignature(engine))
  const towers = useTowerPresence(engine, tSig)
  const enemies = useMemo(
    () => eSig.split('|').filter(Boolean).map((s) => {
      const [id, kind] = s.split(':')
      return { id: Number(id), kind: kind as EnemyKind }
    }),
    [eSig],
  )
  const occupied = useMemo(() => new Set(oSig.split('|').filter(Boolean)), [oSig])
  const size = Math.max(map.width, map.depth)
  return (
    <>
      <Ambience map={map} />
      <hemisphereLight args={['#cfe6ff', '#4a3524', 0.85]} />
      <ambientLight intensity={0.15} color="#9db8ff" />
      <directionalLight
        position={[size * 0.45, size * 0.95, size * 0.35]}
        intensity={2.4}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-size * 0.8}
        shadow-camera-right={size * 0.8}
        shadow-camera-top={size * 0.8}
        shadow-camera-bottom={-size * 0.8}
        shadow-camera-near={0.5}
        shadow-camera-far={size * 3}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-size * 0.6, size * 0.4, -size * 0.5]} intensity={0.45} color="#8fb4ff" />
      <Terrain map={map} occupied={occupied} />
      {towers.map((t) => (
        <TowerModel key={t.id} engine={engine} tower={t} leaving={!!t.leaving} />
      ))}
      {enemies.map((e) => (
        <EnemyModel key={e.id} engine={engine} id={e.id} kind={e.kind} />
      ))}
      <FxLayer engine={engine} />
      <CameraRig map={map} />
      <EffectComposer multisampling={0}>
        <SMAA />
        <Bloom intensity={0.85} luminanceThreshold={0.8} luminanceSmoothing={0.25} mipmapBlur />
        <Vignette eskil={false} offset={0.3} darkness={0.55} />
      </EffectComposer>
    </>
  )
}

export function Board3D({ engine }: { engine: GameEngine }) {
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      camera={{ position: [0, 14, 12], fov: 40, near: 0.1, far: 300 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
      }}
    >
      <Scene engine={engine} />
    </Canvas>
  )
}
