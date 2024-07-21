'use client'

import SlateEditor from './editor'
import LoginForm from './login-form'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function Home() {
  return (
    <main className="mx-auto" style={{ maxWidth: '720px' }}>
      <QueryClientProvider client={queryClient}>
        <LoginForm>
          <SlateEditor />
        </LoginForm>
      </QueryClientProvider>
    </main>
  )
}
