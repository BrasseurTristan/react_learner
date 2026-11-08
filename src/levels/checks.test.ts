import { describe, expect, it } from 'vitest'
import {
  callArguments,
  functionParams,
  hasTernary,
  jsxAttr,
  jsxAttrs,
  jsxOpeningTags,
  jsxTags,
  matchBracket,
  skipJsxElement,
  splitTopLevel,
  stripComments,
  typeDeclarations,
} from './checks'

describe('matchBracket', () => {
  it('équilibre les crochets imbriqués et ignore les chaînes', () => {
    const code = `f({ a: '}', b: [1, (2)] }) + x`
    expect(code.slice(0, matchBracket(code, 1))).toBe(`f({ a: '}', b: [1, (2)] })`)
  })
  it('gère les gabarits avec ${…}', () => {
    const code = '{ `a ${ {b: 1}.b } }` }!'
    expect(matchBracket(code, 0)).toBe(code.length - 1)
  })
  it('ne prend pas une apostrophe de texte pour une chaîne', () => {
    const code = `{ok && <p>L'archer tire</p>} reste`
    expect(code.slice(0, matchBracket(code, 0))).toBe(`{ok && <p>L'archer tire</p>}`)
  })
})

describe('jsxOpeningTags', () => {
  it('tolère => et >= dans les attributs', () => {
    const code = `<button disabled={level >= 3} onClick={() => setLevel((l) => l + 1)}>Améliorer</button>`
    const [tag] = jsxOpeningTags(code)
    expect(tag.name).toBe('button')
    expect([...tag.attrs.keys()]).toEqual(['disabled', 'onClick'])
    expect(tag.attrs.get('onClick')).toBe('() => setLevel((l) => l + 1)')
    expect(tag.attrs.get('disabled')).toBe('level >= 3')
  })

  it('lit les attributs sur plusieurs lignes, chaînes, booléens et props étalées', () => {
    const code = `<input
      type="number"
      autoFocus
      {...rest}
      onChange={(e) => {
        if (e.target.value > '1') setLevel(Number(e.target.value))
      }}
      value={level}
    />`
    const [tag] = jsxOpeningTags(code)
    expect(tag.attrs.get('type')).toBe('number')
    expect(tag.attrs.get('autoFocus')).toBe(true)
    expect(tag.attrs.has('value')).toBe(true)
    expect(tag.end).toBe(code.length)
  })

  it('ignore les génériques et les comparaisons', () => {
    const code = `const [k, setK] = useState<TowerKind>('archer')
if (a < b && c > d) {}
const ok = i<n
return <Tower slot="A" kind={k} />`
    expect(jsxOpeningTags(code).map((t) => t.name)).toEqual(['Tower'])
  })

  it('trouve les balises imbriquées, avec point dans le nom', () => {
    const code = `<Ctx.Provider value={x}><>{list.map((p) => <Tower key={p} slot={p} kind="archer" />)}</></Ctx.Provider>`
    expect(jsxOpeningTags(code).map((t) => t.name)).toEqual(['Ctx.Provider', 'Tower'])
  })

  it('ne lit pas de balise dans une chaîne', () => {
    expect(jsxOpeningTags(`log('<Tower slot="A" />')`)).toEqual([])
  })
})

describe('jsxAttr / jsxAttrs / jsxTags', () => {
  const code = `<select onChange={(e) => setKind(e.target.value as TowerKind)} value={kind}>
  <option value="archer">Archer</option>
</select>
<input type="number" value={level} />`
  it('trouve un attribut après une fonction fléchée', () => {
    expect(jsxAttr(code, 'select', 'value')).toBe(true)
    expect(jsxAttr(code, 'select', /^on[A-Z]/)).toBe(true)
  })
  it('exige les attributs sur la même balise', () => {
    expect(jsxAttrs(code, 'select', ['value', 'onChange'])).toBe(true)
    expect(jsxAttrs(code, 'input', ['value', 'onChange'])).toBe(false)
  })
  it('filtre par nom exact ou regex', () => {
    expect(jsxTags(code, 'option')).toHaveLength(1)
    expect(jsxTags(code, /^[a-z]/)).toHaveLength(3)
  })
  it('accepte un contexte de vérification', () => {
    const ctx = { codeNoComments: stripComments(`// <button onClick={x}>\n<p />`) } as never
    expect(jsxAttr(ctx, 'button', 'onClick')).toBe(false)
  })
})

describe('skipJsxElement', () => {
  it('saute un élément complet avec ses enfants', () => {
    const code = `<p>Volants, archers : {n > 1 ? 'oui' : 'non'}<b>!</b></p> : rest`
    expect(code.slice(skipJsxElement(code, 0))).toBe(' : rest')
  })
  it('saute un fragment et une balise auto-fermante', () => {
    expect(skipJsxElement('<><Tower /></>!', 0)).toBe(14)
    expect(skipJsxElement('<Tower />!', 0)).toBe(9)
  })
})

describe('callArguments / splitTopLevel / functionParams', () => {
  it('extrait les arguments d’un appel, même multi-lignes', () => {
    const code = `POSTS.map((post, i) => {
      return <Tower key={post.slot} slot={post.slot} kind={post.kind} />
    })`
    const [arg] = callArguments(code, /\.map/)
    expect(arg.startsWith('(post, i) =>')).toBe(true)
    expect(arg.trimEnd().endsWith('}')).toBe(true)
    expect(functionParams(arg)).toEqual(['post', 'i'])
  })
  it('gère les paramètres typés, déstructurés ou uniques', () => {
    expect(functionParams('p => p')).toEqual(['p'])
    expect(functionParams('({ slot, kind }: Post, index: number) => 1')).toEqual(['{ slot, kind }', 'index'])
    expect(functionParams('function (p: Post) { return p }')).toEqual(['p'])
  })
  it('découpe au premier niveau seulement', () => {
    expect(splitTopLevel(`a, f(b, c), { d, e }, 'x,y'`)).toEqual(['a', 'f(b, c)', '{ d, e }', `'x,y'`])
  })
})

describe('hasTernary', () => {
  it.each([
    `const k = flyers ? 'archer' : 'cannon'`,
    `kind={flyers\n  ? 'archer'\n  : 'cannon'}`,
    `{danger ? <p>Alerte, volants !</p> : <p>Calme</p>}`,
    `{danger ? (\n  <p>A</p>\n) : null}`,
    `const lvl = a ? (b ? 3 : 2) : 1`,
    `x = cond ? { a: 1 } : { a: 2 }`,
  ])('reconnaît %j', (code) => expect(hasTernary(code)).toBe(true))

  it.each([
    `const k = enemy?.kind`,
    `const t = currentWave ?? nextWave`,
    `type P = { level?: number; slot: string }`,
    `function f(a?: number) {}`,
    `log('vraiment ? : non')`,
  ])('ne confond pas %j', (code) => expect(hasTernary(code)).toBe(false))
})

describe('typeDeclarations', () => {
  it('lit les alias multi-lignes sans point-virgule', () => {
    const code = `type PlanAction =
  | { type: 'build', slot: string, kind: TowerKind }
  | { type: 'upgrade'
      slot: string }
  | { slot: string, type: 'sell' }

const x = 1`
    const [decl] = typeDeclarations(code)
    expect(decl.name).toBe('PlanAction')
    expect(decl.text).toContain(`'sell'`)
    expect(decl.text).not.toContain('const x')
  })
  it('lit les alias sur une ligne et les interfaces', () => {
    const code = `type A = { type: 'a' } | { type: 'b' }; interface B extends C { type: 'c' }\nconst y = 2`
    expect(typeDeclarations(code).map((d) => d.name)).toEqual(['A', 'B'])
    expect(typeDeclarations(code)[1].text).toBe(`interface B extends C { type: 'c' }`)
  })
})
