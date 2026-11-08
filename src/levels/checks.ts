import type { CheckContext, LevelDefinition, Objective } from './types'

/**
 * Retire les commentaires pour que les regex d'analyse ne se fassent pas
 * piéger par du code commenté (les chaînes sont conservées).
 */
export function stripComments(code: string): string {
  let out = ''
  let i = 0
  while (i < code.length) {
    const c = code[i]
    const n = code[i + 1]
    if (c === '/' && n === '/') {
      while (i < code.length && code[i] !== '\n') i++
    } else if (c === '/' && n === '*') {
      i += 2
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++
      i += 2
    } else {
      out += c
      i++
    }
  }
  return out
}

/** Vrai si le motif apparaît dans le code (hors commentaires). */
export function has(ctx: CheckContext, pattern: RegExp): boolean {
  return pattern.test(ctx.codeNoComments)
}

export function count(ctx: CheckContext, pattern: RegExp): number {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
  return (ctx.codeNoComments.match(new RegExp(pattern.source, flags)) ?? []).length
}

/* ------------------------------------------------------------------------------------------
 * Petit scanner de code, sans dépendance (ce fichier tourne aussi dans le navigateur, où le
 * compilateur TypeScript n'est pas chargé). Il ne remplace pas un vrai parseur, mais tolère
 * ce qui casse les regex : `=>` et `>=` dans les attributs, accolades imbriquées, multi-lignes.
 * ---------------------------------------------------------------------------------------- */

type Source = CheckContext | string

const codeOf = (src: Source): string => (typeof src === 'string' ? src : src.codeNoComments)

const CLOSING: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const WORD_CHAR = /[\p{L}\p{N}_$]/u

/**
 * Vrai si le guillemet en `i` ouvre vraiment une chaîne. Une apostrophe collée à une lettre
 * (« L'archer » dans du texte JSX) n'en est pas une.
 */
function opensString(code: string, i: number): boolean {
  const c = code[i]
  if (c === '`') return true
  if (c !== '"' && c !== "'") return false
  return !(i > 0 && WORD_CHAR.test(code[i - 1]))
}

/** Index juste après la chaîne (ou le gabarit) qui commence en `i`. */
function skipString(code: string, i: number): number {
  const quote = code[i]
  i++
  while (i < code.length) {
    const c = code[i]
    if (c === '\\') i += 2
    else if (c === quote) return i + 1
    else if (quote === '`' && c === '$' && code[i + 1] === '{') i = matchBracket(code, i + 1)
    else if (quote !== '`' && c === '\n') return i // chaîne non terminée : on s'arrête à la ligne
    else i++
  }
  return i
}

/**
 * Pour un crochet ouvrant `(`, `[` ou `{` situé en `open`, renvoie l'index juste APRÈS le
 * crochet fermant correspondant (les chaînes sont ignorées). `code.length` s'il n'est pas fermé.
 */
export function matchBracket(code: string, open: number): number {
  const stack = [CLOSING[code[open]]]
  let i = open + 1
  while (i < code.length && stack.length > 0) {
    const c = code[i]
    if (opensString(code, i)) {
      i = skipString(code, i)
      continue
    }
    if (c in CLOSING) stack.push(CLOSING[c])
    else if (c === stack[stack.length - 1]) stack.pop()
    i++
  }
  return i
}

export interface JsxTag {
  /** Nom de la balise, par ex. `Tower`, `button`, `ElementContext.Provider`. */
  name: string
  /** Position du `<`. */
  start: number
  /** Position juste après le `>` (ou `/>`) de la balise ouvrante. */
  end: number
  /** Attributs : texte de la valeur (sans guillemets ni accolades), ou `true` sans valeur. */
  attrs: Map<string, string | true>
}

const KEYWORDS_BEFORE_JSX = new Set(['return', 'yield', 'await', 'else', 'case', 'default', 'in', 'of'])

/** Vrai si un `<` en `i` peut ouvrir du JSX (et pas une comparaison ou un générique). */
function canStartJsx(code: string, i: number): boolean {
  let p = i - 1
  while (p >= 0 && /\s/.test(code[p])) p--
  if (p < 0) return true
  const c = code[p]
  if (c === ')' || c === ']') return false
  if (!WORD_CHAR.test(c)) return true
  let w = p
  while (w > 0 && WORD_CHAR.test(code[w - 1])) w--
  return KEYWORDS_BEFORE_JSX.has(code.slice(w, p + 1))
}

/** Lit une balise ouvrante en `i` (sur le `<`). `null` si ce n'est pas du JSX. */
function readOpeningTag(code: string, i: number): JsxTag | null {
  const nameMatch = /^[A-Za-z_$][\w$.:-]*/.exec(code.slice(i + 1, i + 200))
  if (!nameMatch) return null
  const attrs = new Map<string, string | true>()
  let j = i + 1 + nameMatch[0].length
  // Arguments de type génériques sur un composant (`<Select<string> …>`) : rares, on les saute.
  while (j < code.length) {
    while (j < code.length && /\s/.test(code[j])) j++
    const c = code[j]
    if (c === '>') return { name: nameMatch[0], start: i, end: j + 1, attrs }
    if (c === '/' && code[j + 1] === '>') return { name: nameMatch[0], start: i, end: j + 2, attrs }
    if (c === '{') {
      // Props étalées : {...props}
      if (!/^\{\s*\.\.\./.test(code.slice(j, j + 10))) return null
      j = matchBracket(code, j)
      continue
    }
    const attr = /^[A-Za-z_$][\w$:-]*/.exec(code.slice(j, j + 100))
    if (!attr) return null
    j += attr[0].length
    let k = j
    while (k < code.length && /\s/.test(code[k])) k++
    if (code[k] !== '=') {
      attrs.set(attr[0], true)
      continue
    }
    k++
    while (k < code.length && /\s/.test(code[k])) k++
    if (code[k] === '"' || code[k] === "'") {
      const end = skipString(code, k)
      attrs.set(attr[0], code.slice(k + 1, end - 1))
      j = end
    } else if (code[k] === '{') {
      const end = matchBracket(code, k)
      attrs.set(attr[0], code.slice(k + 1, end - 1).trim())
      j = end
    } else {
      return null
    }
  }
  return null
}

/**
 * Index juste après l'élément JSX complet (balise, enfants, balise fermante) qui commence en `i`,
 * fragments `<>…</>` compris. Renvoie `i` si ce n'est pas du JSX.
 */
export function skipJsxElement(code: string, i: number): number {
  const first = code[i + 1] === '>' ? i + 2 : readOpeningTag(code, i)?.end
  if (first === undefined) return i
  if (code[first - 2] === '/') return first // auto-fermante
  let depth = 1
  let j = first
  while (j < code.length && depth > 0) {
    const c = code[j]
    if (c === '{') {
      j = matchBracket(code, j)
      continue
    }
    if (c === '<') {
      if (code[j + 1] === '/') {
        depth--
        j = code.indexOf('>', j)
        j = j === -1 ? code.length : j + 1
        continue
      }
      if (code[j + 1] === '>') {
        depth++
        j += 2
        continue
      }
      const tag = readOpeningTag(code, j)
      if (tag) {
        if (code[tag.end - 2] !== '/') depth++
        j = tag.end
        continue
      }
    }
    j++
  }
  return j
}

/** Toutes les balises JSX ouvrantes (ou auto-fermantes) du code, dans l'ordre. */
export function jsxOpeningTags(src: Source): JsxTag[] {
  const code = codeOf(src)
  const tags: JsxTag[] = []
  let i = 0
  while (i < code.length) {
    if (opensString(code, i)) {
      i = skipString(code, i)
      continue
    }
    if (code[i] === '<' && canStartJsx(code, i)) {
      const tag = readOpeningTag(code, i)
      if (tag) tags.push(tag)
    }
    i++
  }
  return tags
}

function nameMatches(name: string, pattern: string | RegExp): boolean {
  return typeof pattern === 'string' ? name === pattern : pattern.test(name)
}

/** Les balises ouvrantes dont le nom correspond (nom exact, ou regex testée sur le nom). */
export function jsxTags(src: Source, tag: string | RegExp): JsxTag[] {
  return jsxOpeningTags(src).filter((t) => nameMatches(t.name, tag))
}

/** Vrai si une balise correspondant à `tag` porte un attribut correspondant à `attr`. */
export function jsxAttr(src: Source, tag: string | RegExp, attr: string | RegExp): boolean {
  return jsxTags(src, tag).some((t) => [...t.attrs.keys()].some((a) => nameMatches(a, attr)))
}

/** Vrai si une même balise `tag` porte TOUS les attributs listés. */
export function jsxAttrs(src: Source, tag: string | RegExp, attrs: string[]): boolean {
  return jsxTags(src, tag).some((t) => attrs.every((a) => t.attrs.has(a)))
}

/** Texte des arguments (entre les parenthèses) de chaque appel dont le nom correspond, par ex. `/\.map/`. */
export function callArguments(src: Source, callee: RegExp): string[] {
  const code = codeOf(src)
  const re = new RegExp(`(?:${callee.source})\\s*(?:<[^<>()]*>)?\\s*\\(`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    const open = m.index + m[0].length - 1
    out.push(code.slice(open + 1, matchBracket(code, open) - 1))
  }
  return out
}

/** Découpe une liste d'éléments séparés par des virgules de premier niveau. */
export function splitTopLevel(text: string, sep = ','): string[] {
  const parts: string[] = []
  let start = 0
  let i = 0
  while (i < text.length) {
    if (opensString(text, i)) {
      i = skipString(text, i)
      continue
    }
    const c = text[i]
    if (c in CLOSING) {
      i = matchBracket(text, i)
      continue
    }
    if (c === sep) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
    i++
  }
  parts.push(text.slice(start))
  return parts.map((p) => p.trim()).filter((p) => p.length > 0)
}

/**
 * Noms des paramètres d'une fonction dont le texte commence par sa liste de paramètres :
 * `(p, i) => …`, `p => …`, `function (p: Post, i: number) {…}`. Les déstructurations
 * sont renvoyées telles quelles (`{ slot, kind }`).
 */
export function functionParams(fnText: string): string[] {
  const text = fnText.trimStart().replace(/^async\s+/, '').replace(/^function\b\s*[\w$]*\s*/, '')
  const single = /^([A-Za-z_$][\w$]*)\s*=>/.exec(text)
  if (single) return [single[1]]
  if (!text.startsWith('(')) return []
  const inner = text.slice(1, matchBracket(text, 0) - 1)
  return splitTopLevel(inner).map((p) => {
    const t = p.replace(/=[^]*$/, '').trim() // valeur par défaut
    if (/^[{[]/.test(t)) return t.slice(0, matchBracket(t, 0))
    return t.replace(/\??\s*:[^]*$/, '').trim() // annotation de type
  })
}

/**
 * Vrai si le code contient un opérateur ternaire `a ? b : c` (sur une ou plusieurs lignes),
 * sans confondre avec `?.`, `??` ou une propriété optionnelle `level?: number`.
 */
export function hasTernary(src: Source): boolean {
  const code = codeOf(src)
  let i = 0
  while (i < code.length) {
    if (opensString(code, i)) {
      i = skipString(code, i)
      continue
    }
    if (code[i] === '?') {
      const next = code[i + 1]
      const isOptionalChain = next === '.' && !/\d/.test(code[i + 2] ?? '')
      const isNullish = next === '?' || code[i - 1] === '?'
      const after = code.slice(i + 1).match(/^\s*(.)/)?.[1]
      const isOptionalMember = after === ':' || after === ')' || after === ',' || after === '='
      if (!isOptionalChain && !isNullish && !isOptionalMember && hasMatchingColon(code, i + 1)) return true
    }
    i++
  }
  return false
}

/** Cherche le `:` du ternaire au même niveau d'imbrication, avant la fin de l'expression. */
function hasMatchingColon(code: string, from: number): boolean {
  let nested = 0 // ternaires imbriqués dans la branche « vrai »
  let i = from
  while (i < code.length) {
    if (opensString(code, i)) {
      i = skipString(code, i)
      continue
    }
    const c = code[i]
    if (c in CLOSING) {
      i = matchBracket(code, i)
      continue
    }
    if (c === '<' && canStartJsx(code, i)) {
      const end = skipJsxElement(code, i)
      if (end > i) {
        i = end
        continue
      }
    }
    if (c === ')' || c === ']' || c === '}' || c === ';' || c === ',') return false
    if (c === '?' && code[i + 1] !== '.' && code[i + 1] !== '?' && code[i - 1] !== '?') nested++
    if (c === ':') {
      if (nested === 0) return true
      nested--
    }
    i++
  }
  return false
}

export interface TypeDeclaration {
  name: string
  start: number
  end: number
  /** Texte de la déclaration complète (`type X = …` ou `interface X { … }`). */
  text: string
}

/** Les déclarations `type X = …` et `interface X { … }` du code, même multi-lignes. */
export function typeDeclarations(src: Source): TypeDeclaration[] {
  const code = codeOf(src)
  const out: TypeDeclaration[] = []
  const re = /\b(type|interface)\s+([A-Za-z_$][\w$]*)\s*(?:<[^=>{]*>)?\s*(=|extends\b[^{]*\{|\{)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    let end: number
    if (m[1] === 'interface') {
      if (m[3] === '=') continue
      end = matchBracket(code, m.index + m[0].length - 1)
    } else {
      if (m[3] !== '=') continue
      end = typeAliasEnd(code, m.index + m[0].length)
    }
    out.push({ name: m[2], start: m.index, end, text: code.slice(m.index, end) })
    re.lastIndex = end
  }
  return out
}

/** Fin d'un alias de type : `;`, ou fin de ligne qui ne se poursuit pas par `|` / `&`. */
function typeAliasEnd(code: string, from: number): number {
  let i = from
  let seen = false
  while (i < code.length) {
    if (opensString(code, i)) {
      i = skipString(code, i)
      seen = true
      continue
    }
    const c = code[i]
    if (c in CLOSING) {
      i = matchBracket(code, i)
      seen = true
      continue
    }
    if (c === ';' || c === ')' || c === '}') return i
    if (c === '\n' && seen) {
      const before = code.slice(from, i).trimEnd()
      const after = code.slice(i).trimStart()
      const continues = /[|&=,<]$/.test(before) || /^[|&]/.test(after)
      if (!continues) return i
    }
    if (!/\s/.test(c)) seen = true
    i++
  }
  return i
}

/** Objectifs ajoutés automatiquement à chaque niveau. */
export const VICTORY_OBJECTIVE: Objective = {
  id: 'victory',
  label: 'Repousser toutes les vagues',
  check: (ctx) => ctx.victory,
}

export const TYPESCRIPT_OBJECTIVE: Objective = {
  id: 'typescript',
  label: 'Aucune erreur TypeScript',
  check: (ctx) => ctx.tsErrors === 0,
}

export function allObjectives(level: LevelDefinition): Objective[] {
  return [...level.objectives, TYPESCRIPT_OBJECTIVE, VICTORY_OBJECTIVE]
}
