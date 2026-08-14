/** Read-only logical-call taxonomy inspector for one Harness Session. */
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CaptureRecord, TaxonomyCategory, TaxonomyItem } from '../types.ts'
import type { ContextTaxonomyViewProps } from './slots.ts'
import css from './ContextTaxonomyView.module.css'

const CATEGORIES: readonly TaxonomyCategory[] = [
  'system', 'conversation', 'current-prompt', 'tools', 'options', 'unclassified',
]

function outcomeStatus(capture: CaptureRecord): 'running' | 'success' | 'error' | 'aborted' | 'interrupted' {
  if (capture.status === 'running') return 'running'
  if (capture.status === 'interrupted') return 'interrupted'
  switch (capture.observedOutcome?.kind) {
    case 'error':
    case 'downstream-threw':
      return 'error'
    case 'aborted':
      return 'aborted'
    case 'consumer-stopped':
    case 'stream-ended-without-finish':
      return 'interrupted'
    default:
      return 'success'
  }
}

function categoryClass(category: TaxonomyCategory): string {
  switch (category) {
    case 'system': return css.categorySystem!
    case 'conversation': return css.categoryConversation!
    case 'current-prompt': return css.categoryPrompt!
    case 'tools': return css.categoryTools!
    case 'options': return css.categoryOptions!
    case 'unclassified': return css.categoryUnclassified!
  }
}

function statusClass(status: ReturnType<typeof outcomeStatus>): string | undefined {
  switch (status) {
    case 'running': return css.statusRunning
    case 'success': return css.statusSuccess
    case 'error': return css.statusError
    case 'aborted': return css.statusAborted
    case 'interrupted': return css.statusInterrupted
  }
}

function matches(item: TaxonomyItem, query: string): boolean {
  if (query.length === 0) return true
  const searchable = [
    item.label, item.role, item.sourceKind, item.contextForm, item.path, item.preview,
    ...item.parts.flatMap(part => [part.kind, part.label, part.path, part.text]),
  ].filter((value): value is string => value !== undefined).join('\n').toLocaleLowerCase()
  return searchable.includes(query)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

function formatShare(value: number, total: number): string {
  if (total === 0 || value === 0) return '0%'
  const percentage = value / total * 100
  return percentage < 1 ? '<1%' : `${Math.round(percentage)}%`
}

function formatDuration(startedAt: number, settledAt: number | undefined, now: number): string {
  const elapsed = Math.max(0, (settledAt ?? now) - startedAt)
  if (elapsed < 1_000) return `${elapsed} ms`
  return `${(elapsed / 1_000).toFixed(elapsed < 10_000 ? 1 : 0)} s`
}

/** Render one Session's durable logical-call captures. */
export function ContextTaxonomyView({
  useSession,
  useTaxonomy,
  refresh,
  select,
  pauseLatest,
  jumpLatest,
  loadRawPage,
  readAllRaw,
  t,
}: ContextTaxonomyViewProps) {
  const view = useTaxonomy(value => value)
  const conversation = useSession(snapshot => snapshot)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<TaxonomyCategory | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [rawOpen, setRawOpen] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle')
  const [announcement, setAnnouncement] = useState('')
  const [now, setNow] = useState(Date.now())
  const announcedSelection = useRef<CaptureRecord['captureId'] | null>(null)

  const selected = view.captures.find(capture => capture.captureId === view.selectedId)
  const selectedStatus = selected === undefined ? undefined : outcomeStatus(selected)

  useEffect(() => {
    const timers = [150, 500, 1_200].map(delay => setTimeout(() => void refresh(), delay))
    return () => timers.forEach(clearTimeout)
  }, [conversation, refresh])

  useEffect(() => {
    if (selectedStatus !== 'running') return
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [selectedStatus])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const acceptsText = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable === true
      if (event.key === '/' && !acceptsText) {
        event.preventDefault()
        searchRef.current?.focus()
      } else if (event.key === 'Escape' && !acceptsText && (query.length > 0 || category !== null)) {
        event.preventDefault()
        clearFilter()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [query, category])

  useEffect(() => {
    setRawOpen(false)
    setCopyState('idle')
    const defaults = new Set<string>()
    for (const item of view.taxonomy?.items ?? []) {
      if (item.category === 'current-prompt') defaults.add(item.path)
      const messageIndex = /^\$\.messages\[(\d+)\]/u.exec(item.path)?.[1]
      if (view.taxonomy?.reasoning.status === 'fail' && messageIndex !== undefined
        && view.taxonomy.reasoning.missingMessageIndexes.includes(Number(messageIndex))) {
        defaults.add(item.path)
      }
    }
    setExpanded(defaults)
  }, [view.selectedId, view.taxonomy])

  useEffect(() => {
    if (view.selectedId === null) return
    if (announcedSelection.current !== null && announcedSelection.current !== view.selectedId) {
      const capture = view.captures.find(candidate => candidate.captureId === view.selectedId)
      if (capture !== undefined) setAnnouncement(t('announce.switch', { call: capture.location.callOrdinal + 1 }))
    }
    announcedSelection.current = view.selectedId
  }, [view.selectedId, view.captures, t])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleItems = useMemo(() => (view.taxonomy?.items ?? []).filter(item =>
    (category === null || item.category === category) && matches(item, normalizedQuery)),
  [view.taxonomy, category, normalizedQuery])

  const groupedItems = useMemo(() => CATEGORIES.map(candidate => ({
    category: candidate,
    items: visibleItems.filter(item => item.category === candidate),
  })).filter(group => group.items.length > 0), [visibleItems])

  const allExpanded = visibleItems.length > 0 && visibleItems.every(item => expanded.has(item.path))
  const estimatedTotal = selected?.summary.estimatedTokens ?? 0
  const usage = selected?.usage
  const promptTokens = usage === undefined
    ? undefined
    : usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
  const estimateDelta = promptTokens === undefined || promptTokens === 0
    ? undefined
    : (estimatedTotal - promptTokens) / promptTokens * 100
  const unclassifiedCount = view.taxonomy?.items.filter(item => item.category === 'unclassified').length ?? 0
  const reasoningContextTokens = view.taxonomy?.items.reduce((total, item) => total
    + item.parts.filter(part => part.kind === 'reasoning').reduce((sum, part) => sum + part.estimatedTokens, 0), 0) ?? 0
  const cacheEvidence = [
    usage?.cacheReadTokens === undefined ? null : t('status.cache.read', { value: formatNumber(usage.cacheReadTokens) }),
    usage?.cacheWriteTokens === undefined ? null : t('status.cache.write', { value: formatNumber(usage.cacheWriteTokens) }),
  ].filter((value): value is string => value !== null)

  const callGroups = useMemo(() => {
    const groups = new Map<string, CaptureRecord[]>()
    for (const capture of view.captures) {
      const key = `${capture.location.turn}:${capture.location.step}`
      const group = groups.get(key) ?? []
      group.push(capture)
      groups.set(key, group)
    }
    return [...groups.values()]
  }, [view.captures])

  const toggleExpanded = (path: string, open: boolean): void => {
    setExpanded(current => {
      const next = new Set(current)
      if (open) next.add(path)
      else next.delete(path)
      return next
    })
  }

  const clearFilter = (): void => {
    setQuery('')
    setCategory(null)
    searchRef.current?.focus()
  }

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    const target = event.target as HTMLElement
    if (event.key === '/' && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
      event.preventDefault()
      searchRef.current?.focus()
    } else if (event.key === 'Escape' && (query.length > 0 || category !== null)) {
      event.preventDefault()
      clearFilter()
    }
  }

  const openRaw = (open: boolean): void => {
    setRawOpen(open)
    if (open && view.rawText.length === 0 && !view.rawDone) void loadRawPage()
  }

  const copyRaw = async (): Promise<void> => {
    setCopyState('copying')
    try {
      const text = await readAllRaw()
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1_400)
    } catch {
      setCopyState('failed')
    }
  }

  if (view.status === 'cold' || view.status === 'loading') {
    return <section className={css.panel} aria-busy="true" aria-label={t('title')}>
      <div className={css.skeletonHeader} />
      <div className={css.skeletonCard} />
      <div className={css.skeletonRows}>{[0, 1, 2, 3, 4].map(index => <i key={index} />)}</div>
    </section>
  }

  if (view.status === 'error' && view.captures.length === 0) {
    return <section className={css.panel} aria-label={t('title')}>
      <div className={css.centerState} role="alert">
        <strong>{t('error.title')}</strong>
        <p>{view.error}</p>
        <button type="button" onClick={() => void refresh()}>{t('refresh')}</button>
      </div>
    </section>
  }

  if (view.captures.length === 0) {
    return <section className={css.panel} aria-label={t('title')}>
      <header className={css.identity}><strong>{t('title')}</strong><span>{t('calls.empty')}</span></header>
      <div className={css.centerState}>
        <strong>{t('empty.title')}</strong>
        <p>{t('empty.body')}</p>
        <p className={css.scope}>{t('scope')}</p>
      </div>
    </section>
  }

  return <section className={css.panel} aria-label={t('title')} onKeyDown={onPanelKeyDown}>
    <header className={css.identity}>
      <div className={css.identityMain}>
        <div className={css.model} title={selected === undefined ? '' : `${selected.provider}/${selected.model}`}>
          {selected === undefined ? t('title') : `${selected.provider}/${selected.model}`}
        </div>
      </div>
      <div className={css.callControls}>
        <label>
          <span className={css.srOnly}>{t('calls.label')}</span>
          <select
            aria-label={t('calls.label')}
            value={view.selectedId ?? ''}
            onChange={event => void select(event.target.value as CaptureRecord['captureId'])}
          >
            {callGroups.map(group => <optgroup
              key={`${group[0]?.location.turn}:${group[0]?.location.step}`}
              label={`${t('turn')} ${group[0]?.location.turn} · ${t('step')} ${group[0]?.location.step}`}
            >
              {group.map(capture => <option key={capture.captureId} value={capture.captureId}>
                {`${t('step')} ${capture.location.step} · ${t('call')} ${capture.location.callOrdinal + 1} · ${t(outcomeStatus(capture))}`
                  + (capture.dshRetry === undefined ? '' : ` · ${t('retry')} ${capture.dshRetry.retry}`)}
              </option>)}
            </optgroup>)}
          </select>
        </label>
        {view.followLatest
          ? <button type="button" className={css.followBadge} aria-pressed="true" onClick={pauseLatest}>{t('follow')}</button>
          : <button type="button" className={css.jumpButton} onClick={() => void jumpLatest()}>
            {t('jumpLatest', { count: view.newerCount })}
          </button>}
      </div>
      {selected !== undefined && <div className={css.callMeta}>
        <span className={css.sourceBadge}>{t('source')}</span>
        <span className={`${css.statusDot} ${statusClass(selectedStatus!) ?? ''}`} />
        <span>{t(selectedStatus!)}</span>
        <span>{t('turn')} {selected.location.turn} · {t('step')} {selected.location.step} · {t('call')} {selected.location.callOrdinal + 1}</span>
        <time dateTime={new Date(selected.startedAt).toISOString()}>
          {new Date(selected.startedAt).toLocaleTimeString()} · {formatDuration(selected.startedAt, selected.settledAt, now)}
        </time>
      </div>}
    </header>

    {selected !== undefined && <div className={css.budget}>
      <div className={css.budgetTop}>
        <div><strong>{formatNumber(promptTokens ?? estimatedTotal)}</strong><span>{t(promptTokens === undefined ? 'tokens.estimated' : 'tokens.actual')}</span></div>
        {promptTokens !== undefined && <span>{t('tokens.estimateDelta', {
          estimate: formatNumber(estimatedTotal),
          delta: `${estimateDelta !== undefined && estimateDelta > 0 ? '+' : ''}${estimateDelta?.toFixed(1) ?? '0.0'}`,
        })}</span>}
      </div>
      <div className={css.composition} aria-hidden="true">
        {CATEGORIES.map(candidate => {
          const amount = selected.summary.estimatedByCategory[candidate]
          return amount === 0 ? null : <i
            key={candidate}
            className={`${categoryClass(candidate)} ${category !== null && category !== candidate ? css.compositionDim : ''}`}
            style={{ '--share': String(amount) } as CSSProperties}
          />
        })}
      </div>
      <div className={css.legend} aria-label={t('tokens.estimated')}>
        {CATEGORIES.map(candidate => {
          const amount = selected.summary.estimatedByCategory[candidate]
          if (amount === 0) return null
          return <button
            key={candidate}
            type="button"
            className={category === candidate ? css.filterActive : undefined}
            aria-pressed={category === candidate}
            onClick={() => setCategory(current => current === candidate ? null : candidate)}
          >
            <i className={categoryClass(candidate)} />
            <span>{t(`category.${candidate}`)}</span>
            <b>{formatNumber(amount)}</b>
            <em>{formatShare(amount, estimatedTotal)}</em>
          </button>
        })}
      </div>
      <div className={css.diagnostics}>
        {cacheEvidence.length > 0 && <span>{t('status.cache')}: {cacheEvidence.join(' · ')}</span>}
        {(reasoningContextTokens > 0 || view.taxonomy?.reasoning.status === 'fail') && <span
          className={view.taxonomy?.reasoning.status === 'fail' ? css.diagnosticBad : undefined}
        >
          {t('status.reasoning')}: {t(`reasoning.${view.taxonomy?.reasoning.status ?? 'unknown'}`)} · {t('status.reasoning.context', { value: formatNumber(reasoningContextTokens) })}
        </span>}
        {unclassifiedCount > 0 && <span className={css.diagnosticBad}>
          {t('status.unclassified')}: {t('status.unclassified.count', { count: unclassifiedCount })}
        </span>}
        {usage === undefined && selected.status !== 'running' && <span title={t('noUsage')}>{t('tokens.unknown')}</span>}
      </div>
      {selected.observedOutcome !== undefined && 'failure' in selected.observedOutcome && <div className={css.failure} role={selectedStatus === 'error' ? 'alert' : 'status'}>
        <strong>{selected.observedOutcome.failure.message}</strong>
        <span>{t('failure.code')}: <code>{selected.observedOutcome.failure.code}</code></span>
        {selected.observedOutcome.failure.status !== undefined && <span>{t('failure.status')}: {selected.observedOutcome.failure.status}</span>}
      </div>}
    </div>}

    <div className={css.toolbar}>
      <input
        ref={searchRef}
        type="search"
        value={query}
        aria-label={t('search')}
        placeholder={t('search.placeholder')}
        onChange={event => setQuery(event.target.value)}
      />
      <button type="button" onClick={() => setExpanded(allExpanded
        ? new Set()
        : new Set(visibleItems.map(item => item.path)))}>
        {t(allExpanded ? 'tree.collapseAll' : 'tree.expandAll')}
      </button>
    </div>

    <div className={css.tree} aria-busy={view.detailLoading}>
      {view.detailLoading && <div className={css.inlineLoading}>{t('loading')}</div>}
      {!view.detailLoading && view.taxonomy !== null && groupedItems.map(group => <section
        key={group.category}
        className={`${css.group} ${categoryClass(group.category)}`}
        aria-label={t(`category.${group.category}`)}
      >
        <header><strong>{t(`category.${group.category}`)}</strong><span>{group.items.length} · {formatShare(
          group.items.reduce((sum, item) => sum + item.estimatedTokens, 0),
          estimatedTotal,
        )}</span></header>
        {group.items.map(item => <details
          key={item.path}
          open={expanded.has(item.path)}
          onToggle={event => {
            if (event.currentTarget === event.target) toggleExpanded(item.path, event.currentTarget.open)
          }}
          className={css.item}
        >
          <summary>
            <span>{item.label}</span><b>{formatNumber(item.estimatedTokens)}</b>
          </summary>
          <div className={css.itemMeta}>
            <span>{item.role}</span>
            {item.sourceKind !== undefined && <span>{item.sourceKind}</span>}
            {item.contextForm !== undefined && <span>{item.contextForm}</span>}
            <code title={item.path}><bdi>{item.path}</bdi></code>
          </div>
          <div className={css.parts}>
            {item.parts.map(part => <details key={part.path} open={part.kind === 'reasoning' && view.taxonomy?.reasoning.status === 'fail'}>
              <summary><code>{part.kind}</code><span>{part.label}</span><b>{formatNumber(part.estimatedTokens)}</b></summary>
              <div className={css.partMeta}><code title={part.path}><bdi>{part.path}</bdi></code></div>
              <pre>{part.text}</pre>
            </details>)}
          </div>
        </details>)}
      </section>)}
      {!view.detailLoading && view.taxonomy !== null && visibleItems.length === 0 && <div className={css.filteredEmpty}>
        <p>{normalizedQuery.length === 0 && category === null ? t('tree.empty') : t('filter.empty')}</p>
        {(normalizedQuery.length > 0 || category !== null) && <button type="button" onClick={clearFilter}>{t('tree.clear')}</button>}
      </div>}
    </div>

    {selected !== undefined && <details className={css.raw} open={rawOpen} onToggle={event => openRaw(event.currentTarget.open)}>
      <summary>
        <span>{t('raw.title')}</span>
        <code>{selected.raw.state}</code>
      </summary>
      <p>{t('raw.note')}</p>
      <div className={css.rawStructure}>{t('raw.structureSummary', {
        count: selected.summary.itemCount,
        keys: selected.summary.topLevelOrder.join(' → '),
      })}</div>
      {selected.raw.state === 'available' && <>
        {view.rawText.length > 0 && <pre>{view.rawText}</pre>}
        <div className={css.rawActions}>
          {!view.rawDone && <button type="button" disabled={view.rawLoading} onClick={() => void loadRawPage()}>
            {view.rawLoading ? t('loading') : t('raw.loadMore')}
          </button>}
          <button type="button" disabled={view.rawLoading || copyState === 'copying'} onClick={() => void copyRaw()}>
            {copyState === 'copied' ? t('raw.copied') : copyState === 'failed' ? t('raw.copyFailed') : t('raw.copy')}
          </button>
          {view.rawTotalChars !== null && <span>{t('raw.progress', {
            loaded: formatNumber(view.rawText.length),
            total: formatNumber(view.rawTotalChars),
          })}</span>}
        </div>
      </>}
      {selected.raw.state !== 'available' && <div className={css.rawUnavailable}>{t(rawMessageKey(selected.raw.state))}</div>}
    </details>}
    <div className={css.srOnly} aria-live="polite">
      {announcement}
      {!view.followLatest && view.newerCount > 0 ? t('jumpLatest', { count: view.newerCount }) : ''}
      {copyState === 'copied' ? t('raw.copied') : copyState === 'failed' ? t('raw.copyFailed') : ''}
    </div>
  </section>
}

function rawMessageKey(state: CaptureRecord['raw']['state']): 'raw.unavailable' | 'raw.corrupt' | 'raw.oversize' | 'raw.structure' | 'raw.pending' | 'raw.failed' | 'raw.missing' {
  switch (state) {
    case 'corrupt': return 'raw.corrupt'
    case 'omitted-size-limit': return 'raw.oversize'
    case 'structure-only': return 'raw.structure'
    case 'pending': return 'raw.pending'
    case 'write-failed': return 'raw.failed'
    case 'missing': return 'raw.missing'
    case 'available': return 'raw.unavailable'
  }
}
