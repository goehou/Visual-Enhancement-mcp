import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

import * as z from 'zod/v4'

import { createImageInputSchema, loadImageInput } from './image.js'

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg=='

test('loadImageInput supports file URLs for local images', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mcp-vision-image-'))
  const imagePath = path.join(dir, 'tiny.png')

  try {
    await writeFile(imagePath, Buffer.from(PNG_BASE64, 'base64'))

    const loaded = await loadImageInput({ imageUrl: pathToFileURL(imagePath).toString() })

    assert.equal(loaded.mediaType, 'image/png')
    assert.equal(loaded.sourceLabel, imagePath)
    assert.match(loaded.imageUrl, /^data:image\/png;base64,/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('loadImageInput supports base64 payloads with explicit media type', async () => {
  const loaded = await loadImageInput({
    imageBase64: PNG_BASE64,
    imageMediaType: 'image/png'
  })

  assert.equal(loaded.mediaType, 'image/png')
  assert.equal(loaded.sourceLabel, 'base64-upload')
  assert.equal(loaded.imageUrl, `data:image/png;base64,${PNG_BASE64}`)
})

test('createImageInputSchema accepts base64 uploads and rejects mixed sources', () => {
  const schema = createImageInputSchema({
    prompt: z.string()
  })

  const valid = z.safeParse(schema, {
    imageBase64: PNG_BASE64,
    imageMediaType: 'image/png',
    prompt: 'describe the image'
  })
  assert.equal(valid.success, true)

  const invalid = z.safeParse(schema, {
    imagePath: 'C:\\tmp\\tiny.png',
    imageBase64: PNG_BASE64,
    imageMediaType: 'image/png',
    prompt: 'describe the image'
  })
  assert.equal(invalid.success, false)
})
