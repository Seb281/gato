import { setupServer } from 'msw/node'
import { supabaseAuthHandlers } from './supabaseAuth.ts'
import { deeplHandlers } from './deepl.ts'

export const server = setupServer(...supabaseAuthHandlers, ...deeplHandlers)
