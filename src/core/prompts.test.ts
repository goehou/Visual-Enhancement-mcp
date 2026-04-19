import test from 'node:test'
import assert from 'node:assert/strict'

import { buildAnalyzePrompt, buildOcrPrompt } from './prompts.js'

test('buildAnalyzePrompt trims whitespace', () => {
  assert.equal(buildAnalyzePrompt('  describe this image  '), 'describe this image')
})

test('buildAnalyzePrompt throws on empty string', () => {
  assert.throws(() => buildAnalyzePrompt(''), /prompt 不能为空/)
})

test('buildAnalyzePrompt throws on whitespace-only string', () => {
  assert.throws(() => buildAnalyzePrompt('   \n  '), /prompt 不能为空/)
})

test('buildOcrPrompt omits language hint line when hint is absent', () => {
  const prompt = buildOcrPrompt()
  assert.doesNotMatch(prompt, /已知语言偏好/)
  assert.match(prompt, /请执行高保真 OCR/)
})

test('buildOcrPrompt includes language hint when provided', () => {
  const prompt = buildOcrPrompt('zh-CN')
  assert.match(prompt, /已知语言偏好: zh-CN/)
})

test('buildOcrPrompt ignores whitespace-only language hint', () => {
  const prompt = buildOcrPrompt('   ')
  assert.doesNotMatch(prompt, /已知语言偏好/)
})

test('buildOcrPrompt lists faithful extraction rules', () => {
  const prompt = buildOcrPrompt()
  assert.match(prompt, /提取图片中全部可见文字/)
  assert.match(prompt, /\[uncertain\]/)
})
