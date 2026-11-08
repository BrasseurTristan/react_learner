import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { MapDef } from '../../engine/types'
import { mulberry32 } from './coords'

export const HORIZON = new THREE.Color('#1a2f5c')
const WATER_Y = -1.08

// ───────────────────────── Ciel ─────────────────────────

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const skyFragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uGlow;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
  col = mix(col, uBottom, smoothstep(0.0, -0.35, h));
  // Halo chaud sur l'horizon, côté soleil couchant
  float sun = pow(max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(0.7, 0.0, -0.7)))), 6.0);
  col += uGlow * sun * exp(-abs(h) * 9.0) * 0.55;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`

function Sky() {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color('#050a1c') },
      uHorizon: { value: HORIZON.clone() },
      uBottom: { value: new THREE.Color('#0b1a36') },
      uGlow: { value: new THREE.Color('#f0a0d0') },
    }),
    [],
  )
  return (
    <mesh renderOrder={-10}>
      <sphereGeometry args={[160, 32, 16]} />
      <shaderMaterial vertexShader={skyVertex} fragmentShader={skyFragment} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  )
}

function Stars() {
  const geo = useMemo(() => {
    const rnd = mulberry32(42)
    const n = 500
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = rnd() * Math.PI * 2
      const v = 0.08 + rnd() * 0.9
      const r = 140
      pos[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * r
      pos[i * 3 + 1] = v * r
      pos[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * r
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])
  const mat = useRef<THREE.PointsMaterial>(null)
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = 0.65 + Math.sin(clock.elapsedTime * 0.8) * 0.15
  })
  return (
    <points geometry={geo}>
      <pointsMaterial ref={mat} color="#dbe7ff" size={1.1} sizeAttenuation transparent depthWrite={false} fog={false} />
    </points>
  )
}

// ───────────────────────── Eau ─────────────────────────

const waterVertex = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.y += sin(w.x * 0.6 + uTime * 1.1) * 0.04 + cos(w.z * 0.7 + uTime * 0.9) * 0.04;
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const waterFragment = /* glsl */ `
uniform float uTime;
uniform vec2 uHalf;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uHorizon;
uniform vec3 uCam;
varying vec3 vWorld;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

void main() {
  vec2 p = vWorld.xz;
  float d = sdBox(p, uHalf);
  // Couleur : turquoise près de l'île, bleu profond au large
  vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 6.0, d));
  // Reflets ondulants
  float n = noise(p * 0.55 + vec2(uTime * 0.12, uTime * 0.09)) * 0.65 + noise(p * 1.3 - vec2(uTime * 0.16, -uTime * 0.1)) * 0.35;
  col += vec3(0.25, 0.45, 0.6) * smoothstep(0.55, 0.85, n) * 0.18;
  col *= 0.92 + 0.08 * sin(p.x * 0.9 + p.y * 0.6 + uTime * 0.8);
  // Écume animée au bord de l'île
  float wave = sin(d * 6.0 - uTime * 2.2) * 0.5 + 0.5;
  float foamBand = smoothstep(0.45, 0.0, d) * (0.6 + 0.4 * wave);
  foamBand += smoothstep(0.08, 0.0, abs(d - 0.55 - 0.2 * sin(uTime * 1.3))) * 0.5;
  col = mix(col, uFoam, clamp(foamBand, 0.0, 1.0) * 0.6);
  // Fondu vers l'horizon
  float dist = length(vWorld.xz - uCam.xz);
  col = mix(col, uHorizon, smoothstep(18.0, 70.0, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`

function Water({ map }: { map: MapDef }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHalf: { value: new THREE.Vector2(map.width / 2 + 0.15, map.depth / 2 + 0.15) },
      uDeep: { value: new THREE.Color('#0b2a55') },
      uShallow: { value: new THREE.Color('#1c7f9a') },
      uFoam: { value: new THREE.Color('#bfeaf5') },
      uHorizon: { value: HORIZON.clone() },
      uCam: { value: new THREE.Vector3() },
    }),
    [map.width, map.depth],
  )
  useFrame(({ clock, camera }) => {
    if (!mat.current) return
    mat.current.uniforms.uTime.value = clock.elapsedTime
    mat.current.uniforms.uCam.value.copy(camera.position)
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, 0]} receiveShadow={false}>
      <planeGeometry args={[220, 220, 120, 120]} />
      <shaderMaterial ref={mat} vertexShader={waterVertex} fragmentShader={waterFragment} uniforms={uniforms} />
    </mesh>
  )
}

// ───────────────────────── Nuages ─────────────────────────

interface Puff {
  angle: number
  radius: number
  y: number
  speed: number
  offsets: [number, number, number, number][]
}

function Clouds({ map }: { map: MapDef }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const puffs = useMemo<Puff[]>(() => {
    const rnd = mulberry32(7 + map.width)
    const base = Math.max(map.width, map.depth) * 0.75
    return Array.from({ length: 11 }, (_, i) => ({
      angle: (i / 11) * Math.PI * 2 + rnd() * 0.4,
      radius: base + 3 + rnd() * 9,
      y: -0.4 + rnd() * 2.6,
      speed: 0.008 + rnd() * 0.012,
      offsets: Array.from({ length: 5 }, (_, j) => [
        (j - 2) * 0.75 + (rnd() - 0.5) * 0.4,
        (rnd() - 0.3) * 0.35,
        (rnd() - 0.5) * 0.7,
        0.55 + rnd() * 0.5 + (j === 2 ? 0.35 : 0),
      ]),
    }))
  }, [map.width, map.depth])
  const count = puffs.length * 5
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const s = useMemo(() => new THREE.Vector3(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    let i = 0
    for (const c of puffs) {
      const a = c.angle + clock.elapsedTime * c.speed
      const cx = Math.cos(a) * c.radius
      const cz = Math.sin(a) * c.radius
      q.setFromAxisAngle(up, -a)
      for (const [ox, oy, oz, sc] of c.offsets) {
        p.set(ox, oy, oz).applyQuaternion(q)
        p.x += cx
        p.y += c.y + Math.sin(clock.elapsedTime * 0.3 + c.angle) * 0.15
        p.z += cz
        s.set(sc * 1.25, sc * 0.8, sc)
        m.compose(p, q, s)
        mesh.setMatrixAt(i++, m)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#e9eeff" emissive="#4b5f9e" emissiveIntensity={0.25} roughness={1} flatShading transparent opacity={0.92} />
    </instancedMesh>
  )
}

/** Petits rochers émergeant de l'eau autour de l'île. */
function SeaRocks({ map }: { map: MapDef }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const n = 14
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const rnd = mulberry32(map.depth * 13 + 5)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2
      const rx = map.width / 2 + 1.2 + rnd() * 4
      const rz = map.depth / 2 + 1.2 + rnd() * 4
      const sc = 0.2 + rnd() * 0.45
      e.set(rnd() * 3, rnd() * 3, rnd() * 3)
      q.setFromEuler(e)
      m.compose(new THREE.Vector3(Math.cos(a) * rx, WATER_Y + sc * 0.2, Math.sin(a) * rz), q, new THREE.Vector3(sc, sc * 0.8, sc))
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [map])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} castShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#56607a" flatShading roughness={1} />
    </instancedMesh>
  )
}

/** Décor d'ambiance autour du plateau : ciel, étoiles, mer, nuages, lucioles. */
export function Ambience({ map }: { map: MapDef }) {
  const size = Math.max(map.width, map.depth)
  return (
    <>
      <fog attach="fog" args={[HORIZON, size * 2.2, size * 6]} />
      <Sky />
      <Stars />
      <Water map={map} />
      <SeaRocks map={map} />
      <Clouds map={map} />
      <Sparkles count={70} scale={[map.width, 2.5, map.depth]} position={[0, 1.4, 0]} size={2.2} speed={0.25} color="#c7f0ff" opacity={0.6} />
    </>
  )
}
