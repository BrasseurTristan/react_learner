import { marked } from 'marked'
import { useMemo } from 'react'

marked.setOptions({ gfm: true, breaks: false })

/** Rendu Markdown du contenu pédagogique (contenu interne au projet, jamais saisi par un tiers). */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => marked.parse(source.trim(), { async: false }) as string, [source])
  return <div className={`md ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />
}

/** Markdown en ligne (sans paragraphe englobant), pour les libellés d'objectifs ou les indices courts. */
export function InlineMarkdown({ source }: { source: string }) {
  const html = useMemo(() => marked.parseInline(source, { async: false }) as string, [source])
  return <span className="md-inline" dangerouslySetInnerHTML={{ __html: html }} />
}
