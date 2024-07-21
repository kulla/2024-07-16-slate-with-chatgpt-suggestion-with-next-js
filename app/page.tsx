'use client'

import SlateEditor from './editor'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function Home() {
  return (
    <main className="mx-auto w-[32em]">
      <QueryClientProvider client={queryClient}>
        <SlateEditor />
      </QueryClientProvider>
    </main>
  )
}
