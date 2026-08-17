import { memo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const plugins = [remarkGfm]

export const CopilotMarkdown = memo(function CopilotMarkdown({ children }: { children: string }) {
  return <div className="copilot-markdown"><Markdown remarkPlugins={plugins}>{children}</Markdown></div>
})
