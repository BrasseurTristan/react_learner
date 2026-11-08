/**
 * Protection contre les boucles infinies du code joueur.
 *
 * Un `while (true) {}` exécuté dans l'onglet gèlerait toute la page (éditeur compris).
 * On instrumente donc le JavaScript transpilé : la condition de chaque `while`, `do … while`
 * et `for (…; …; …)` est préfixée par un appel au garde-fou :
 *
 *   while (cond)         →  while (__rlLoopGuard(3) && (cond))
 *   for (init; c; next)  →  for (init; __rlLoopGuard(3) && (c); next)
 *   for (;;)             →  for (;__rlLoopGuard(3);)
 *
 * Les `for…of` / `for…in` parcourent des collections finies et ne sont pas modifiés.
 * Sucrase conserve les numéros de ligne, ce qui permet de citer la ligne du code source.
 *
 * Le garde-fou mesure la durée de l'exécution synchrone en cours (rendu, effet, gestionnaire…) :
 * dès que la pile se vide, une micro-tâche remet le compteur à zéro. Seule une boucle qui
 * monopolise le fil d'exécution plus de `timeoutMs` lève une erreur.
 */

export const LOOP_GUARD_NAME = '__rlLoopGuard'
export const DEFAULT_LOOP_TIMEOUT_MS = 1000

type TokenType = 'ident' | 'num' | 'str' | 'template' | 'regex' | 'punct'

interface Token {
  type: TokenType
  value: string
  start: number
  end: number
}

/** Mots-clés après lesquels un `/` ouvre une expression régulière (et non une division). */
const REGEX_AFTER_KEYWORD = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
])

const isIdentStart = (c: string) => /[A-Za-z_$À-￿]/.test(c)
const isIdentPart = (c: string) => /[\w$À-￿]/.test(c)

/** Découpe grossièrement du JavaScript en jetons (suffisant pour repérer les boucles). */
export function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  const regexAllowed = () => {
    const prev = tokens[tokens.length - 1]
    if (!prev) return true
    if (prev.type === 'ident') return REGEX_AFTER_KEYWORD.has(prev.value)
    if (prev.type === 'punct') return !/^[)\]}]$/.test(prev.value)
    return false
  }

  const skipString = (quote: string) => {
    i++
    while (i < src.length && src[i] !== quote) {
      if (src[i] === '\\') i++
      else if (src[i] === '\n') break
      i++
    }
    i++
  }

  // Une template literal peut contenir des ${ … } imbriqués : on compte les accolades.
  const skipTemplate = () => {
    i++
    while (i < src.length) {
      const c = src[i]
      if (c === '\\') {
        i += 2
      } else if (c === '`') {
        i++
        return
      } else if (c === '$' && src[i + 1] === '{') {
        i += 2
        let depth = 1
        while (i < src.length && depth > 0) {
          const d = src[i]
          if (d === '{') depth++
          else if (d === '}') depth--
          if (depth === 0) break
          if (d === '"' || d === "'") skipString(d)
          else if (d === '`') skipTemplate()
          else if (d === '/' && src[i + 1] === '/') while (i < src.length && src[i] !== '\n') i++
          else if (d === '/' && src[i + 1] === '*') {
            const close = src.indexOf('*/', i + 2)
            i = close < 0 ? src.length : close + 2
          } else i++
        }
        i++
      } else {
        i++
      }
    }
  }

  while (i < src.length) {
    const c = src[i]
    const start = i
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
    } else if (c === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2)
      i = close < 0 ? src.length : close + 2
    } else if (c === '"' || c === "'") {
      skipString(c)
      tokens.push({ type: 'str', value: src.slice(start, i), start, end: i })
    } else if (c === '`') {
      skipTemplate()
      tokens.push({ type: 'template', value: src.slice(start, i), start, end: i })
    } else if (c === '/' && regexAllowed()) {
      i++
      let inClass = false
      while (i < src.length && src[i] !== '\n') {
        const d = src[i]
        if (d === '\\') i++
        else if (d === '[') inClass = true
        else if (d === ']') inClass = false
        else if (d === '/' && !inClass) break
        i++
      }
      i++
      while (i < src.length && isIdentPart(src[i])) i++
      tokens.push({ type: 'regex', value: src.slice(start, i), start, end: i })
    } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      while (i < src.length && /[\w.]/.test(src[i])) i++
      tokens.push({ type: 'num', value: src.slice(start, i), start, end: i })
    } else if (isIdentStart(c)) {
      while (i < src.length && isIdentPart(src[i])) i++
      tokens.push({ type: 'ident', value: src.slice(start, i), start, end: i })
    } else {
      i++
      tokens.push({ type: 'punct', value: c, start, end: i })
    }
  }
  return tokens
}

function lineAt(src: string, pos: number): number {
  let line = 1
  for (let i = 0; i < pos; i++) if (src.charCodeAt(i) === 10) line++
  return line
}

/** Index du jeton `)` qui ferme la parenthèse ouverte en `open`, ou -1. */
function matchingParen(tokens: Token[], open: number): number {
  let depth = 0
  for (let k = open; k < tokens.length; k++) {
    const t = tokens[k]
    if (t.type !== 'punct') continue
    if (t.value === '(' || t.value === '[' || t.value === '{') depth++
    else if (t.value === ')' || t.value === ']' || t.value === '}') {
      depth--
      if (depth === 0) return t.value === ')' ? k : -1
    }
  }
  return -1
}

/** Ajoute un appel au garde-fou dans la condition de chaque boucle. */
export function instrumentLoops(js: string): { code: string; loops: number } {
  const tokens = tokenize(js)
  const edits: { at: number; text: string }[] = []
  let loops = 0
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]
    if (t.type !== 'ident' || (t.value !== 'while' && t.value !== 'for')) continue
    const prev = tokens[k - 1]
    if (prev && prev.type === 'punct' && prev.value === '.') continue
    const open = tokens[k + 1]
    if (!open || open.type !== 'punct' || open.value !== '(') continue
    const close = matchingParen(tokens, k + 1)
    if (close < 0) continue
    const guard = `${LOOP_GUARD_NAME}(${lineAt(js, t.start)})`

    if (t.value === 'while') {
      edits.push({ at: open.end, text: `${guard} && (` }, { at: tokens[close].start, text: ')' })
      loops++
      continue
    }

    // for (init; cond; update) : repérer les deux « ; » de premier niveau.
    const semis: number[] = []
    let depth = 0
    for (let m = k + 2; m < close; m++) {
      const p = tokens[m]
      if (p.type !== 'punct') continue
      if ('([{'.includes(p.value)) depth++
      else if (')]}'.includes(p.value)) depth--
      else if (p.value === ';' && depth === 0) semis.push(m)
    }
    if (semis.length !== 2) continue // for…of / for…in
    const [s1, s2] = semis
    if (s2 === s1 + 1) {
      edits.push({ at: tokens[s1].end, text: guard })
    } else {
      edits.push({ at: tokens[s1].end, text: ` ${guard} && (` }, { at: tokens[s2].start, text: ')' })
    }
    loops++
  }
  edits.sort((a, b) => b.at - a.at)
  let code = js
  for (const e of edits) code = code.slice(0, e.at) + e.text + code.slice(e.at)
  return { code, loops }
}

/**
 * Crée la fonction appelée à chaque tour de boucle. Elle lève une erreur claire
 * si l'exécution synchrone en cours dépasse `timeoutMs`.
 */
export function createLoopGuard(timeoutMs = DEFAULT_LOOP_TIMEOUT_MS): (line: number) => true {
  const now = () => globalThis.performance.now()
  let runStart = 0
  let iterations = 0
  let fresh = true
  const endOfRun = () => {
    fresh = true
  }
  return (line: number) => {
    if (fresh) {
      fresh = false
      runStart = now()
      iterations = 0
      queueMicrotask(endOfRun)
    }
    if ((++iterations & 127) === 0 && now() - runStart > timeoutMs) {
      fresh = true // nouveau budget pour le code exécuté après l'erreur
      const secs = timeoutMs >= 1000 ? `${(timeoutMs / 1000).toLocaleString('fr-FR')} s` : `${timeoutMs} ms`
      throw new Error(
        `Boucle infinie détectée ligne ${line} : la boucle tourne depuis plus de ${secs} sans s’arrêter ` +
          `(${iterations.toLocaleString('fr-FR')} tours). Vérifie que sa condition finit par devenir fausse.`,
      )
    }
    return true
  }
}
