/** UI slot props for the Context Taxonomy conversation view. */
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { CaptureId } from '../types.ts'
import type { ContextTaxonomyViewState } from './controller.ts'
import type {} from './locales.ts'

/** Per-Session business face supplied to the view entry. */
export interface ContextTaxonomyInjected {
  hooks: { taxonomy: HostObservable<ContextTaxonomyViewState> }
  refresh(): Promise<void>
  select(captureId: CaptureId): Promise<void>
  pauseLatest(): void
  jumpLatest(): Promise<void>
  loadRawPage(): Promise<void>
  readAllRaw(): Promise<string>
}

/** Complete Context Taxonomy view props. */
export type ContextTaxonomyViewProps = PropsRuntime<'conversation.view'>
  & InjectFace<ContextTaxonomyInjected>
  & PropsLocale<'context-taxonomy'>
