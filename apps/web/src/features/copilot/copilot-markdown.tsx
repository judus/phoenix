import { memo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const REMARK_PLUGINS = [remarkGfm]

export interface CopilotMarkdownProps {
  children: string
}

/** Renders trusted Markdown syntax without enabling raw model-supplied HTML. */
export const CopilotMarkdown = memo(function CopilotMarkdown ({ children }: CopilotMarkdownProps) {
  return (
    <div className="copilot-markdown">
      <Markdown remarkPlugins={REMARK_PLUGINS}>{children}</Markdown>
    </div>
  )
})
