import test from 'node:test'
import assert from 'node:assert/strict'

import { buildAnalyzePrompt, buildOcrPrompt } from './prompts.js'

test('buildAnalyzePrompt trims whitespace', () => {
  assert.equal(buildAnalyzePrompt('  describe this image  '), 'describe this image')
})

test('buildAnalyzePrompt throws on empty string', () => {
  assert.throws(() => buildAnalyzePrompt(''), /prompt cannot be empty/)
})

test('buildAnalyzePrompt throws on whitespace-only string', () => {
  assert.throws(() => buildAnalyzePrompt('   \n  '), /prompt cannot be empty/)
})

test('buildOcrPrompt omits language hint line when hint is absent', () => {
  const prompt = buildOcrPrompt()
  assert.doesNotMatch(prompt, /Known language preference/)
  assert.match(prompt, /Perform high-fidelity OCR/)
})

test('buildOcrPrompt includes language hint when provided', () => {
  const prompt = buildOcrPrompt('zh-CN')
  assert.match(prompt, /Known language preference: zh-CN/)
})

test('buildOcrPrompt ignores whitespace-only language hint', () => {
  const prompt = buildOcrPrompt('   ')
  assert.doesNotMatch(prompt, /Known language preference/)
})

test('buildOcrPrompt lists faithful extraction rules', () => {
  const prompt = buildOcrPrompt()
  assert.match(prompt, /Extract all visible text/)
  assert.match(prompt, /\[uncertain\]/)
})

test('buildOcrPrompt defaults to plain text output', () => {
  const prompt = buildOcrPrompt()
  assert.match(prompt, /Output format: plain text/)
})

test('buildOcrPrompt supports Markdown output', () => {
  const prompt = buildOcrPrompt(undefined, 'markdown')
  assert.match(prompt, /Output format: Markdown/)
  assert.match(prompt, /tables as Markdown/)
})

test('buildOcrPrompt supports JSON output', () => {
  const prompt = buildOcrPrompt(undefined, 'json')
  assert.match(prompt, /Output format: valid JSON only/)
  assert.match(prompt, /"blocks"/)
})
