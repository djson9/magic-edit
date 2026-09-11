import type {ReactElement} from 'react'

export type MagicEditThreadLinkTarget = 'app' | 'web'

export type MagicEditBubbleProps = {
  apiRoot: string
  bottomInset?: number
  threadId?: string
  threadIds?: readonly string[]
  threadLinkTarget?: MagicEditThreadLinkTarget
  visible?: boolean
}

export declare function magicEditBubblePosition(
  position: {x: number; y: number} | null,
  layout: {width: number; height: number},
  bottomInset: number,
): {x: number; y: number}

export declare function isMagicEditBubbleDrag(dx: number, dy: number): boolean

export declare function magicEditRecipientThreadIds(
  threadId?: string,
  threadIds?: readonly string[],
): string[]

export declare function MagicEditBubble(props: MagicEditBubbleProps): ReactElement | null
