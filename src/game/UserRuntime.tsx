import { Component, Profiler, type ComponentType, type ErrorInfo, type ReactNode } from 'react'

/** Traduit les erreurs React les plus fréquentes en conseils compréhensibles par un débutant. */
export function explainRuntimeError(message: string): string {
  const tips: [RegExp, string][] = [
    [/Too many re-renders/i, 'Tu modifies un état (setState) directement pendant le rendu, ce qui relance le rendu à l’infini. Déplace cet appel dans un gestionnaire d’événement (onClick…) ou un useEffect.'],
    [/Maximum update depth exceeded/i, 'Une mise à jour d’état déclenche une nouvelle mise à jour en boucle. Vérifie les dépendances de tes useEffect.'],
    [/Rendered (more|fewer) hooks than/i, 'Les hooks doivent toujours être appelés dans le même ordre : jamais dans un if, une boucle ou après un return anticipé.'],
    [/Invalid hook call/i, 'Les hooks (useState, useEffect…) ne s’appellent qu’au premier niveau d’un composant ou d’un hook personnalisé.'],
    [/is not defined/i, 'Une variable ou un composant est utilisé sans avoir été déclaré ou importé.'],
    [/Objects are not valid as a React child/i, 'Tu essaies d’afficher un objet directement dans le JSX. Affiche plutôt une de ses propriétés (ex. {game.gold}).'],
    [/is not a function/i, 'Tu appelles quelque chose qui n’est pas une fonction. Vérifie le nom et l’import.'],
    [/Cannot read properties of (undefined|null)/i, 'Tu lis une propriété sur une valeur undefined ou null. Vérifie que la valeur existe avant de l’utiliser.'],
    [/Element type is invalid/i, 'Un composant utilisé dans ton JSX n’existe pas (import oublié ou mal orthographié ?).'],
    [/useContext|must be used within/i, 'Ce hook a besoin d’un Provider plus haut dans l’arbre de composants.'],
  ]
  const tip = tips.find(([re]) => re.test(message))
  return tip ? tip[1] : 'Lis le message ci-dessus : il indique souvent la ligne et la cause du problème.'
}

interface BoundaryProps {
  onError: (message: string) => void
  children: ReactNode
}

class UserErrorBoundary extends Component<BoundaryProps, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(error: Error) {
    return { error: error?.message ?? String(error) }
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError(error?.message ?? String(error))
  }
  render() {
    if (this.state.error) {
      return (
        <div className="runtime-crash">
          <div className="runtime-crash-title">💥 Ton composant a planté</div>
          <code>{this.state.error}</code>
          <p>{explainRuntimeError(this.state.error)}</p>
        </div>
      )
    }
    return this.props.children
  }
}

interface Props {
  Component: ComponentType | null
  runKey: number
  onError: (message: string) => void
  onRender: () => void
}

/** Affiche le composant du joueur, isolé dans une ErrorBoundary et mesuré par un Profiler. */
export function UserRuntime({ Component: UserComponent, runKey, onError, onRender }: Props) {
  if (!UserComponent) return <div className="user-empty">Ton composant apparaîtra ici dès que ton code compile.</div>
  return (
    <UserErrorBoundary key={runKey} onError={onError}>
      <Profiler id="user" onRender={onRender}>
        <UserComponent />
      </Profiler>
    </UserErrorBoundary>
  )
}
