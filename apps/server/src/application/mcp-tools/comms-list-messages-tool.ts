import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { CommunicationDataReader, CommunicationQueryView } from '../../domain/communications.js'
import { boundedLimit, json, optionalIntegerArgument, optionalStringArgument, output } from './tool-support.js'

export class CommsListMessagesTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Read retained Elite communications. Use inbox for private and group messages, traffic for public system chat plus NPC and station chatter, or all for both. Contacts are observation history, not online-presence claims.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        limit: { maximum: 100, minimum: 1, type: 'integer' },
        search: { description: 'Optional case-insensitive text to match sender, recipient, or message.', type: 'string' },
        view: { enum: ['inbox', 'traffic', 'all'], type: 'string' }
      },
      type: 'object'
    },
    name: 'comms.list_messages'
  }

  public constructor (private readonly communications: CommunicationDataReader) {}

  public readonly execute = (arguments_: JsonObject) => {
    const requestedView = optionalStringArgument(arguments_, 'view') ?? 'all'
    const view: CommunicationQueryView = requestedView === 'inbox' || requestedView === 'traffic' ? requestedView : 'all'
    const limit = boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 20, 100)
    const search = optionalStringArgument(arguments_, 'search')?.toLocaleLowerCase()
    const response = this.communications.getCommunications(view, search ? 1000 : limit)
    const messages = response.messages
      .filter(message => !search || [message.sender, message.recipient, message.message].some(value => value?.toLocaleLowerCase().includes(search)))
      .slice(0, limit)
    const text = messages.length === 0
      ? `No retained ${view === 'all' ? '' : `${view} `}messages match.`
      : messages.map(message => {
          const speaker = message.sender ?? message.recipient ?? message.senderKind
          return `- ${message.timestamp}: ${speaker} [${message.channel}] ${message.message}`
        }).join('\n')
    return output(text, json({ contacts: response.contacts, messages, summary: response.summary, view }))
  }
}
