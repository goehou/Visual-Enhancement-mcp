export type OcrOutputFormat = 'plain' | 'markdown' | 'json'

export function buildAnalyzePrompt(prompt: string): string {
  const trimmed = prompt.trim()
  if (!trimmed) {
    throw new Error('prompt cannot be empty')
  }
  return trimmed
}

export function buildOcrPrompt(languageHint?: string, outputFormat: OcrOutputFormat = 'plain'): string {
  const hint = languageHint?.trim() ? `Known language preference: ${languageHint.trim()}\n` : ''
  const formatInstructions: Record<OcrOutputFormat, string[]> = {
    plain: ['Output format: plain text.', 'Return only the extracted text.'],
    markdown: [
      'Output format: Markdown.',
      'Preserve headings, lists, paragraphs, and tables as Markdown when feasible.',
      'Return only the Markdown document.'
    ],
    json: [
      'Output format: valid JSON only.',
      'Use this shape: {"text":"full extracted text","blocks":[{"type":"paragraph|heading|table|list|other","text":"block text"}]}.',
      'Do not wrap the JSON in Markdown fences.'
    ]
  }

  return [
    'Perform high-fidelity OCR.',
    hint,
    'Requirements:',
    '1. Extract all visible text in the image.',
    '2. Preserve original paragraphs, line breaks, and table reading order as much as possible.',
    '3. Do not explain, summarize, or fill in missing text.',
    '4. Mark uncertain characters with [uncertain].',
    ...formatInstructions[outputFormat]
  ].join('\n')
}
