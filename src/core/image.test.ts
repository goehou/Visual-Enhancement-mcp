import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

import * as z from 'zod/v4'

import { createImageInputSchema, loadImageInputs, MAX_IMAGES_PER_CALL } from './image.js'

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg=='

test('loadImageInputs supports file URLs for local images', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mcp-vision-image-'))
  const imagePath = path.join(dir, 'tiny.png')

  try {
    await writeFile(imagePath, Buffer.from(PNG_BASE64, 'base64'))

    const [loaded] = await loadImageInputs({ imageUrl: pathToFileURL(imagePath).toString() })

    assert.equal(loaded.mediaType, 'image/png')
    assert.equal(loaded.sourceLabel, imagePath)
    assert.match(loaded.imageUrl, /^data:image\/png;base64,/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('loadImageInputs supports base64 payloads with explicit media type', async () => {
  const [loaded] = await loadImageInputs({
    imageBase64: PNG_BASE64,
    imageMediaType: 'image/png'
  })

  assert.equal(loaded.mediaType, 'image/png')
  assert.equal(loaded.sourceLabel, 'base64-upload')
  assert.equal(loaded.imageUrl, `data:image/png;base64,${PNG_BASE64}`)
})

test('loadImageInputs rejects local files larger than maxImageBytes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mcp-vision-image-'))
  const imagePath = path.join(dir, 'tiny.png')

  try {
    await writeFile(imagePath, Buffer.from(PNG_BASE64, 'base64'))

    await assert.rejects(loadImageInputs({ imagePath }, 10), /Image file too large/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('loadImageInputs rejects base64 payloads larger than maxImageBytes', async () => {
  await assert.rejects(
    loadImageInputs({ imageBase64: PNG_BASE64, imageMediaType: 'image/png' }, 10),
    /Image payload too large/
  )
})

test('loadImageInputs loads multiple images from the images[] list, in order', async () => {
  const loaded = await loadImageInputs({
    images: [
      { imageBase64: PNG_BASE64, imageMediaType: 'image/png' },
      { imageUrl: 'https://example.com/b.png' }
    ]
  })

  assert.equal(loaded.length, 2)
  assert.equal(loaded[0].sourceLabel, 'base64-upload')
  assert.equal(loaded[1].sourceLabel, 'https://example.com/b.png')
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

test('createImageInputSchema accepts images[] and rejects combining it with single-image fields', () => {
  const schema = createImageInputSchema({
    prompt: z.string()
  })

  const validList = z.safeParse(schema, {
    images: [
      { imageUrl: 'https://example.com/a.png' },
      { imageBase64: PNG_BASE64, imageMediaType: 'image/png' }
    ],
    prompt: 'compare these'
  })
  assert.equal(validList.success, true)

  const mixed = z.safeParse(schema, {
    imageUrl: 'https://example.com/a.png',
    images: [{ imageUrl: 'https://example.com/b.png' }],
    prompt: 'compare these'
  })
  assert.equal(mixed.success, false)

  const tooMany = z.safeParse(schema, {
    images: Array.from({ length: MAX_IMAGES_PER_CALL + 1 }, () => ({ imageUrl: 'https://example.com/a.png' })),
    prompt: 'compare these'
  })
  assert.equal(tooMany.success, false)

  const missing = z.safeParse(schema, {
    prompt: 'compare these'
  })
  assert.equal(missing.success, false)
})

