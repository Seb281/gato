import { setupServer } from 'msw/node'
import { supabaseAuthHandlers } from './supabaseAuth.ts'

export const server = setupServer(...supabaseAuthHandlers)
