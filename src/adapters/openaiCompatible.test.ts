import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeContent } from './openaiCompatible.js'

test('normalizeContent returns trimmed string content', () => {
  const text = normalizeContent({
    choices: [{ message: { content: '  cabbage  ' } }]
  })

  assert.equal(text, 'cabbage')
})

test('normalizeContent joins text parts from array content', () => {
  const text = normalizeContent({
    choices: [
      {
        message: {
          content: [
            { type: 'text', text: '  line 1  ' },
            { type: 'image_url', text: 'ignored' },
            { type: 'text', text: 'line 2' }
          ]
        }
      }
    ]
  })

  assert.equal(text, 'line 1\nline 2')
})

test('normalizeContent falls back to reasoning when content is null', () => {
  const text = normalizeContent({
    choices: [{ message: { content: undefined, reasoning: '  detected cabbage  ' } }]
  })

  assert.equal(text, 'detected cabbage')
})

test('normalizeContent falls back to reasoning_content when reasoning is empty', () => {
  const text = normalizeContent({
    choices: [{ message: { content: undefined, reasoning: ' ', reasoning_content: '  detected cabbage  ' } }]
  })

  assert.equal(text, 'detected cabbage')
})

test('normalizeContent returns empty string when no usable text exists', () => {
  const text = normalizeContent({
    choices: [{ message: { content: [{ type: 'image_url', text: 'ignored' }] } }]
  })

  assert.equal(text, '')
})
