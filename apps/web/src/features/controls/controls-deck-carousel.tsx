import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import { ControlsPage } from './controls-page.js'
import { useDeckSwipe } from './use-deck-swipe.js'

type Props = ComponentProps<typeof ControlsPage> & { onSelectDeck(deckId: string): void }

export function ControlsDeckCarousel(props: Props) {
  if (props.editing || props.macros.recording || props.controller.status !== 'ready' || !props.controller.configuration) {
    return <ControlsPage {...props} />
  }
  return <DeckCarousel {...props} />
}

function DeckCarousel({ onSelectDeck, ...props }: Props) {
  const viewport = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [visibleId, setVisibleId] = useState(props.deckId)
  const decks = props.controller.configuration!.decks
  const index = decks.findIndex(deck => deck.id === visibleId)
  const order = decks.map(deck => deck.id).join('\n')
  useLayoutEffect(() => setVisibleId(props.deckId), [props.deckId, order])
  useDeckSwipe({ viewport, strip, deckId: visibleId, order,
    previous: decks[index - 1]?.id, next: decks[index + 1]?.id, setBusy,
    onSelect: id => { setVisibleId(id); onSelectDeck(id) } })
  if (index < 0) return <ControlsPage {...props} />
  return <div aria-label="Control deck carousel" className="deck-carousel" ref={viewport}>
    <div className="deck-strip" inert={busy || undefined} ref={strip}>
      {decks.slice(Math.max(0, index - 1), index + 2).map(deck => {
        const offset = decks.indexOf(deck) - index
        return <div className="deck-slide" key={deck.id} aria-hidden={offset !== 0 || undefined}
          inert={offset !== 0 || undefined} style={{ transform: `translateY(${offset * 100}%)` }}>
          <ControlsPage {...props} deckId={deck.id} preview={offset !== 0}
            runtime={offset === 0 ? props.runtime : undefined} />
        </div>
      })}
    </div>
  </div>
}
