/** Private gzip storage for sanitized canonical logical requests. */
import { constants } from 'node:fs'
import { access, chmod, mkdir, open, readFile, readdir, rename, stat, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, isAbsolute, join } from 'node:path'
import { gzip, gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import type { CaptureId } from '../types.ts'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/** Result of one committed blob write. */
export interface StoredBlob {
  /** Opaque relative key kept in the index. */
  readonly blobKey: string
  /** Compressed bytes stored on disk. */
  readonly storedBytes: number
}

/** Local private blob store; callers own record-level lifecycle policy. */
export class BlobStore {
  private readonly blobRoot: string

  /**
   * @param root - absolute plugin data root.
   */
  constructor(readonly root: string) {
    if (!isAbsolute(root)) throw new TypeError(`context-taxonomy: root must be absolute, got ${JSON.stringify(root)}`)
    this.blobRoot = join(root, 'blobs')
  }

  /** Create private root directories. */
  async init(): Promise<void> {
    await mkdir(this.blobRoot, { recursive: true, mode: 0o700 })
    await chmod(this.root, 0o700)
    await chmod(this.blobRoot, 0o700)
  }

  /**
   * Atomically persist sanitized JSON.
   * @param captureId - opaque capture id used as a filename, never caller input.
   * @param json - sanitized canonical JSON.
   * @returns relative blob metadata after rename commits.
   */
  async write(captureId: CaptureId, json: string): Promise<StoredBlob> {
    const blobKey = `${captureId}.json.gz`
    const target = this.pathFor(blobKey)
    const temp = join(this.blobRoot, `.${captureId}.${randomUUID()}.tmp`)
    const bytes = await gzipAsync(Buffer.from(json, 'utf8'))
    let handle: Awaited<ReturnType<typeof open>> | undefined
    try {
      handle = await open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600)
      await handle.writeFile(bytes)
      await handle.sync()
      await handle.close()
      handle = undefined
      await rename(temp, target)
    } catch (error: unknown) {
      if (handle !== undefined) await handle.close().catch(() => undefined)
      await unlink(temp).catch(() => undefined)
      throw error
    }
    await chmod(target, 0o600)
    return Object.freeze({ blobKey, storedBytes: bytes.byteLength })
  }

  /**
   * Read and decompress one available sanitized blob.
   * @param blobKey - key previously minted by this store.
   * @returns sanitized canonical JSON.
   */
  async read(blobKey: string): Promise<string> {
    const compressed = await readFile(this.pathFor(blobKey))
    return (await gunzipAsync(compressed)).toString('utf8')
  }

  /**
   * Test whether one indexed blob still exists.
   * @param blobKey - opaque stored blob key.
   * @returns whether the file exists.
   */
  async exists(blobKey: string): Promise<boolean> {
    try {
      await access(this.pathFor(blobKey))
      return true
    } catch (error: unknown) {
      if (isErrno(error, 'ENOENT')) return false
      throw error
    }
  }

  /**
   * Delete one blob idempotently.
   * @param blobKey - opaque stored blob key.
   */
  async delete(blobKey: string): Promise<void> {
    try {
      await unlink(this.pathFor(blobKey))
    } catch (error: unknown) {
      if (!isErrno(error, 'ENOENT')) throw error
    }
  }

  /** Return all committed blob keys; temp files remain maintenance-owned. */
  async list(): Promise<readonly string[]> {
    return (await readdir(this.blobRoot)).filter(name => name.endsWith('.json.gz'))
  }

  /** Remove abandoned write temporaries left by an interrupted process. */
  async pruneTemps(): Promise<void> {
    const entries = await readdir(this.blobRoot)
    await Promise.all(entries
      .filter(name => /^\.[0-9a-f-]+\.[0-9a-f-]+\.tmp$/iu.test(name))
      .map(name => unlink(join(this.blobRoot, name)).catch(error => {
        if (!isErrno(error, 'ENOENT')) throw error
      })))
  }

  /**
   * Read one committed blob's compressed byte size.
   * @param blobKey - opaque stored blob key.
   * @returns compressed byte size, or zero after disappearance.
   */
  async size(blobKey: string): Promise<number> {
    try {
      return (await stat(this.pathFor(blobKey))).size
    } catch (error: unknown) {
      if (isErrno(error, 'ENOENT')) return 0
      throw error
    }
  }

  private pathFor(blobKey: string): string {
    if (!/^[0-9a-f-]+\.json\.gz$/iu.test(blobKey) || dirname(blobKey) !== '.') {
      throw new TypeError('context-taxonomy: invalid blob key')
    }
    return join(this.blobRoot, blobKey)
  }
}

function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}
