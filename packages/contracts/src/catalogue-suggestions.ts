import { z } from 'zod'

export const CatalogueSuggestionKindSchema = z.enum(['ship', 'module', 'commodity'])
export const CatalogueSuggestionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  source: z.enum(['Elite', 'Spansh'])
})
export const CatalogueSuggestionsSchema = z.array(CatalogueSuggestionSchema).max(12)
export type CatalogueSuggestionKind = z.infer<typeof CatalogueSuggestionKindSchema>
export type CatalogueSuggestion = z.infer<typeof CatalogueSuggestionSchema>
