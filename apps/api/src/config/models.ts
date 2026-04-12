export const MODELS = {
  /** Default model for translation enrichment and system tasks (Google) */
  system: 'gemini-2.5-flash-lite',
  /** Google model for users with custom API keys */
  google: 'gemini-2.5-flash-lite',
  /** OpenAI model for users with custom API keys */
  openai: 'gpt-4.1-nano',
  /** Anthropic model for users with custom API keys */
  anthropic: 'claude-sonnet-4-5',
  /** Mistral model for users with custom API keys */
  mistral: 'mistral-large-latest',
  /** Model for the tutor/chat feature */
  tutor: 'gpt-4.1-nano',
} as const
