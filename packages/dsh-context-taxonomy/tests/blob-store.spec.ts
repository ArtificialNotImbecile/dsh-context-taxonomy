import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CaptureId } from '../src/types.ts'
import { BlobStore } from '../src/storage/blob-store.ts'

describe('BlobStore', () => {
  it('atomically stores sanitized gzip content with private permissions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-taxonomy-'))
    const store = new BlobStore(root)
    await store.init()
    const captureId = '123e4567-e89b-42d3-a456-426614174000' as CaptureId
    const stored = await store.write(captureId, '{"safe":true}')

    expect(await store.read(stored.blobKey)).toBe('{"safe":true}')
    expect((await stat(join(root, 'blobs'))).mode & 0o777).toBe(0o700)
    expect((await stat(join(root, 'blobs', stored.blobKey))).mode & 0o777).toBe(0o600)
    expect((await readFile(join(root, 'blobs', stored.blobKey))).subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]))
  })

  it('rejects path-like blob keys', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-taxonomy-'))
    const store = new BlobStore(root)
    await store.init()
    await expect(store.read('../secret.json.gz')).rejects.toThrow('invalid blob key')
  })

  it('removes only abandoned write temporaries during startup recovery', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-taxonomy-'))
    const store = new BlobStore(root)
    await store.init()
    await writeFile(join(root, 'blobs', '.123e4567-e89b-42d3-a456-426614174000.0a000000-0000-4000-8000-000000000000.tmp'), 'partial')
    await writeFile(join(root, 'blobs', 'operator-note.tmp'), 'keep')

    await store.pruneTemps()

    expect(await readdir(join(root, 'blobs'))).toEqual(['operator-note.tmp'])
  })
})
