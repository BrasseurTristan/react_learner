import type { MapDef } from '../engine/types'

/**
 * Cartes partagées par les niveaux. Coordonnées en cases : x ∈ [0, width-1], z ∈ [0, depth-1].
 * Le chemin va du portail (premier point) à la base (dernier point).
 * Les slots ne doivent jamais être posés sur le chemin.
 */

/** Petite prairie en S, idéale pour débuter. Longueur du chemin : 19. */
export const MEADOW: MapDef = {
  width: 12,
  depth: 8,
  path: [
    { x: 0, z: 4 },
    { x: 3, z: 4 },
    { x: 3, z: 1 },
    { x: 7, z: 1 },
    { x: 7, z: 6 },
    { x: 11, z: 6 },
  ],
  slots: [
    { id: 'A', x: 2, z: 2 },
    { id: 'B', x: 5, z: 3 },
    { id: 'C', x: 8, z: 4, high: true },
    { id: 'D', x: 5, z: 6 },
    { id: 'E', x: 10, z: 5 },
  ],
}

/** Canyon en zigzag : plus long, plus de slots. Longueur du chemin : 33. */
export const CANYON: MapDef = {
  width: 14,
  depth: 9,
  path: [
    { x: 0, z: 1 },
    { x: 11, z: 1 },
    { x: 11, z: 4 },
    { x: 2, z: 4 },
    { x: 2, z: 7 },
    { x: 13, z: 7 },
  ],
  slots: [
    { id: 'A', x: 3, z: 2 },
    { id: 'B', x: 6, z: 2 },
    { id: 'C', x: 9, z: 2, high: true },
    { id: 'D', x: 12, z: 3 },
    { id: 'E', x: 4, z: 6 },
    { id: 'F', x: 7, z: 5, high: true },
    { id: 'G', x: 10, z: 6 },
    { id: 'H', x: 1, z: 5 },
  ],
}

/** Forteresse en spirale pour les niveaux avancés. Longueur du chemin : 46. */
export const FORTRESS: MapDef = {
  width: 15,
  depth: 11,
  path: [
    { x: 0, z: 0 },
    { x: 14, z: 0 },
    { x: 14, z: 10 },
    { x: 1, z: 10 },
    { x: 1, z: 3 },
    { x: 11, z: 3 },
    { x: 11, z: 7 },
    { x: 5, z: 7 },
  ],
  slots: [
    { id: 'A', x: 4, z: 1 },
    { id: 'B', x: 9, z: 1 },
    { id: 'C', x: 13, z: 2 },
    { id: 'D', x: 13, z: 8 },
    { id: 'E', x: 9, z: 9 },
    { id: 'F', x: 4, z: 9 },
    { id: 'G', x: 2, z: 6, high: true },
    { id: 'H', x: 6, z: 5, high: true },
    { id: 'I', x: 9, z: 5, high: true },
    { id: 'J', x: 12, z: 5 },
  ],
}
