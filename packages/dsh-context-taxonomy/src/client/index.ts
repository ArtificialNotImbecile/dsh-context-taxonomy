/** Browser entry: mount this package's generated Remote and register one conversation view. */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import contextTaxonomyRemote from '@artificialnotimbecile/dsh-context-taxonomy/remote'
import { ContextTaxonomyController, type ContextTaxonomyRemote } from './controller.ts'
import { ContextTaxonomyView } from './ContextTaxonomyView.tsx'
import type { ContextTaxonomyInjected } from './slots.ts'
import { en, NS, zh } from './locales.ts'

/** Required Client services. The Remote namespace mounts during apply. */
export const inject = ['remote', 'slots', 'locale']

/** Mount generated methods, bilingual copy, and the independent Context view tab. */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmountRemote = await ctx.remote.$mount(contextTaxonomyRemote)
  const taxonomyRemote = ctx.get('remote.contextTaxonomy') as ContextTaxonomyRemote | undefined
  if (taxonomyRemote === undefined) {
    await unmountRemote()
    throw new Error('contextTaxonomy Remote did not mount')
  }
  const unregisterLocale = ctx.locale.register(NS, { zh, en })
  const controllers = new Map<SessionId, ContextTaxonomyController>()
  const t = ctx.locale.bind(NS)
  const disposeSlot = ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'context-taxonomy',
    order: 20,
    locale: NS,
    label: () => t('view.label'),
    inject: (sessionId: SessionId): ContextTaxonomyInjected => {
      let controller = controllers.get(sessionId)
      if (controller === undefined) {
        controller = new ContextTaxonomyController(
          taxonomyRemote,
          sessionId,
        )
        controllers.set(sessionId, controller)
        void controller.refresh()
      }
      return {
        hooks: { taxonomy: controller },
        refresh: () => controller.refresh(),
        select: captureId => controller.select(captureId),
        pauseLatest: () => controller.pauseLatest(),
        jumpLatest: () => controller.jumpLatest(),
        loadRawPage: () => controller.loadRawPage(),
        readAllRaw: () => controller.readAllRaw(),
      }
    },
  }, ContextTaxonomyView))

  ctx.on('connection/reset', () => {
    for (const controller of controllers.values()) controller.reset()
  })

  return async () => {
    disposeSlot()
    for (const controller of controllers.values()) controller.dispose()
    controllers.clear()
    unregisterLocale()
    await unmountRemote()
  }
}
