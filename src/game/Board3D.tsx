import { OrbitControls, Sparkles } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useMemo, useSyncExternalStore } from 'react'
import type { GameEngine } from '../engine/engine'
import { FxLayer } from './scene/FxLayer'
import { Terrain } from './scene/Terrain'
import { EnemyModel, TowerModel } from './scene/Units'

function Scene({ engine }: { engine: GameEngine }) {
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot)
  const map = engine.config.map
  const towers = useMemo(() => [...engine.towers.values()].map((t) => ({ ...t })), [snap, engine])
  const occupied = useMemo(() => new Set(snap.slots.filter((s) => s.occupied).map((s) => s.id)), [snap.slots])
  const size = Math.max(map.width, map.depth)
  return (
    <>
      <color attach="background" args={['#0b1226']} />
      <fog attach="fog" args={['#0b1226', size * 1.4, size * 3]} />
      <hemisphereLight args={['#c7e0ff', '#3b2a1a', 0.9]} />
      <directionalLight
        position={[size * 0.4, size * 0.9, size * 0.5]}
        intensity={2.2}
        color="#fff4e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-bias={-0.0005}
      />
      <Terrain map={map} occupied={occupied} />
      {towers.map((t) => (
        <TowerModel key={t.id} engine={engine} tower={t} />
      ))}
      {snap.enemies.map((e) => (
        <EnemyModel key={e.id} engine={engine} id={e.id} kind={e.kind} />
      ))}
      <FxLayer engine={engine} />
      <Sparkles count={60} scale={[map.width, 3, map.depth]} position={[0, 1.5, 0]} size={2} speed={0.3} color="#bae6fd" opacity={0.5} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minPolarAngle={0.35}
        maxPolarAngle={1.15}
        minDistance={size * 0.6}
        maxDistance={size * 1.8}
        target={[0, 0, 0.5]}
      />
      <EffectComposer multisampling={4}>
        <Bloom intensity={0.9} luminanceThreshold={0.75} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette eskil={false} offset={0.25} darkness={0.6} />
      </EffectComposer>
    </>
  )
}

export function Board3D({ engine }: { engine: GameEngine }) {
  const map = engine.config.map
  const size = Math.max(map.width, map.depth)
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, size * 0.95, size * 0.85], fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: true }}
    >
      <Scene engine={engine} />
    </Canvas>
  )
}
