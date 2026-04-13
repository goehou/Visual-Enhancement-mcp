export function buildAnalyzePrompt(prompt: string): string {
  const trimmed = prompt.trim()
  if (!trimmed) {
    throw new Error('prompt 不能为空')
  }
  return trimmed
}

export function buildOcrPrompt(languageHint?: string): string {
  const hint = languageHint?.trim() ? `已知语言偏好: ${languageHint.trim()}。\n` : ''
  return [
    '请执行高保真 OCR。',
    hint,
    '要求：',
    '1. 提取图片中全部可见文字。',
    '2. 尽量保持原有段落、换行、表格顺序。',
    '3. 不要解释，不要总结，不要补全文字。',
    '4. 无法确认的字符用 [uncertain] 标注。'
  ].join('\n')
}
