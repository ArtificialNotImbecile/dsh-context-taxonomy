/** Generate rc.6 Typert artifacts for a package that may itself be the Git install root. */
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WorkspaceTypertGenerator } from '@deepseek-ai/dsh-typert-generator'

const PACKAGE_NAME = '@artificialnotimbecile/dsh-context-taxonomy'
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const temporaryRoot = await mkdtemp(join(tmpdir(), 'dsh-context-taxonomy-typert-'))
const temporaryPackage = join(temporaryRoot, 'packages', 'dsh-context-taxonomy')

try {
  await mkdir(temporaryPackage, { recursive: true })
  await Promise.all([
    cp(join(packageRoot, 'src'), join(temporaryPackage, 'src'), { recursive: true }),
    ...['package.json', 'tsconfig.base.json', 'tsconfig.json'].map(async file => {
      await cp(join(packageRoot, file), join(temporaryPackage, file))
    }),
  ])
  await writeFile(join(temporaryRoot, 'tsconfig.host.json'), JSON.stringify({
    files: [],
    references: [{ path: './packages/dsh-context-taxonomy/tsconfig.json' }],
  }, null, 2) + '\n')
  await symlink(join(packageRoot, 'node_modules'), join(temporaryRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')

  const artifacts = new WorkspaceTypertGenerator(temporaryRoot).generate([PACKAGE_NAME], ['host'])
  const artifact = artifacts.find(candidate => candidate.package === PACKAGE_NAME && candidate.face === 'host')
  if (artifact === undefined || artifact.remote === undefined) {
    throw new Error('context-taxonomy: Typert generator produced no Host Remote artifact')
  }
  const output = join(packageRoot, 'lib')
  await mkdir(output, { recursive: true })
  await Promise.all([
    writeFile(join(output, 'typert.host.js'), artifact.js),
    writeFile(join(output, 'typert.host.d.ts'), artifact.dts),
    writeFile(join(output, 'typert.remote-client.js'), artifact.remote.js),
    writeFile(join(output, 'typert.remote-client.d.ts'), artifact.remote.dts),
    writeFile(join(output, 'typert.remote-client.d.ts.map'), artifact.remote.dtsMap),
  ])

  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  if (manifest.name !== PACKAGE_NAME) throw new Error('context-taxonomy: package name changed during Typert generation')
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
