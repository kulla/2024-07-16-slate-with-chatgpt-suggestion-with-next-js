import * as t from 'io-ts'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { OpenAI } from 'openai'

const Completion = t.type({ completion: t.string })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (req.nextUrl.searchParams.get('password') !== process.env.PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const suffix = req.nextUrl.searchParams.get('suffix')

  try {
    if (suffix === null || suffix.length === 0) {
      return NextResponse.json({ error: 'Invalid suffix' }, { status: 400 })
    }

    const model = req.nextUrl.searchParams.get('model') ?? 'gpt-3.5-turbo'

    const openAIResponse = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: req.nextUrl.searchParams.get('prompt') ?? '',
        },
        { role: 'user', content: `<text>${suffix}</text>` },
      ],
      temperature: 0.25,
      ...(model != 'gpt-4' ? { response_format: { type: 'json_object' } } : {}),
    })
    const { choices } = openAIResponse

    if (choices.length === 0 || choices[0].message.content === null) {
      return NextResponse.json(
        { error: 'No completions found', openAIResponse },
        { status: 500 },
      )
    }

    const completion = JSON.parse(choices[0].message.content) as unknown

    if (!Completion.is(completion)) {
      return NextResponse.json(
        { error: 'Invalid completion', openAIResponse },
        { status: 500 },
      )
    }

    return NextResponse.json({
      suggestion: completion.completion,
      promptTokens: openAIResponse.usage?.prompt_tokens ?? 0,
      completionTokens: openAIResponse.usage?.completion_tokens ?? 0,
      openAIResponse,
    })
  } catch (error) {
    console.error('Error fetching suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suggestion' },
      { status: 500 },
    )
  }
}
