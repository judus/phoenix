import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface CopilotMarkdownProps {
  children: string
}

/** Renders trusted Markdown syntax without enabling raw model-supplied HTML. */
export function CopilotMarkdown ({ children }: CopilotMarkdownProps) {
  return (
    <div className="copilot-markdown">
      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
    </div>
  )
}
