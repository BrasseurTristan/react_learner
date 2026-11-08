import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { MapDef } from '../../engine/types'

const POLAR = 0.86 // angle depuis la verticale
const INTRO_DURATION = 2.1

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Direction (unitaire) de la caméra depuis la cible. */
function direction(polar: number, azimuth: number) {
  return new THREE.Vector3(Math.sin(polar) * Math.sin(azimuth), Math.cos(polar), Math.sin(polar) * Math.cos(azimuth))
}

/**
 * Distance minimale pour que tout le plateau (avec ses bords et ses tours) tienne dans le cadre.
 * Recherche dichotomique en projetant les coins du plateau.
 */
function fitDistance(map: MapDef, aspect: number, fov: number, dir: THREE.Vector3, target: THREE.Vector3) {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 500)
  const hw = map.width / 2 + 0.25
  const hd = map.depth / 2 + 0.25
  const corners: THREE.Vector3[] = []
  for (const x of [-hw, hw]) for (const z of [-hd, hd]) for (const y of [-1.2, 1.4]) corners.push(new THREE.Vector3(x, y, z))
  const v = new THREE.Vector3()
  const fits = (d: number) => {
    cam.position.copy(target).addScaledVector(dir, d)
    cam.lookAt(target)
    cam.updateMatrixWorld()
    cam.updateProjectionMatrix()
    for (const c of corners) {
      v.copy(c).project(cam)
      // Marges : un peu plus en haut et en bas pour laisser respirer le HUD.
      if (Math.abs(v.x) > 0.95 || v.y > 0.86 || v.y < -0.84 || v.z > 1) return false
    }
    return true
  }
  let lo = 2
  let hi = 120
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) hi = mid
    else lo = mid
  }
  return hi
}

/**
 * Caméra orbitale qui cadre automatiquement le plateau selon la taille du panneau,
 * avec un survol d'introduction au chargement du niveau.
 */
export function CameraRig({ map }: { map: MapDef }) {
  const { camera, size } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const target = useMemo(() => new THREE.Vector3(0, -0.1, 0.15), [])
  const intro = useRef({ t: reducedMotion() ? INTRO_DURATION : 0 })
  const fit = useRef(0)

  // Orientation : sur un panneau étroit, on tourne la caméra pour aligner le grand côté du plateau.
  const aspect = size.width / Math.max(1, size.height)
  const portrait = aspect < 0.9 && map.width > map.depth
  const azimuth = portrait ? Math.PI / 2 : 0
  const fov = (camera as THREE.PerspectiveCamera).fov

  const layout = useMemo(() => {
    const dir = direction(POLAR, azimuth)
    return { dir, dist: fitDistance(map, aspect, fov, dir, target) }
  }, [map, aspect, azimuth, fov, portrait, target])

  // Recadrage quand le panneau change de taille (on garde l'angle choisi par le joueur).
  useEffect(() => {
    const ctrl = controls.current
    const prev = fit.current
    fit.current = layout.dist
    if (!ctrl) return
    ctrl.minDistance = layout.dist * 0.55
    ctrl.maxDistance = layout.dist * 1.6
    if (intro.current.t < INTRO_DURATION) return
    if (prev === 0) {
      camera.position.copy(target).addScaledVector(layout.dir, layout.dist)
    } else {
      const offset = camera.position.clone().sub(target)
      const ratio = offset.length() / prev
      camera.position.copy(target).add(offset.setLength(layout.dist * ratio))
    }
    ctrl.update()
  }, [layout, camera, target])

  useFrame((_, delta) => {
    const ctrl = controls.current
    const it = intro.current
    if (it.t >= INTRO_DURATION) return
    it.t = Math.min(INTRO_DURATION, it.t + Math.min(delta, 0.05))
    const k = it.t / INTRO_DURATION
    const e = 1 - Math.pow(1 - k, 3)
    const polar = THREE.MathUtils.lerp(0.32, POLAR, e)
    const az = azimuth + THREE.MathUtils.lerp(-0.9, 0, e)
    const dist = fit.current * THREE.MathUtils.lerp(1.75, 1, e)
    camera.position.copy(target).addScaledVector(direction(polar, az), dist)
    camera.lookAt(target)
    if (ctrl) {
      ctrl.enabled = it.t >= INTRO_DURATION
      ctrl.update()
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      zoomSpeed={0.7}
      minPolarAngle={0.3}
      maxPolarAngle={1.2}
      target={target}
    />
  )
}
