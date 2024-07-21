import * as t from 'io-ts'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { OpenAI } from 'openai'

const Completion = t.type({ completion: t.string, newWord: t.boolean })
const openai = new OpenAI({ apiKey: '' })
const prompt = `Du bist ein KI-Assistent, der darauf spezialisiert ist, Lernmaterialien in deutscher Sprache zu vervollständigen. Deine Aufgabe ist es, einen gegebenen Text zu ergänzen, indem du maximal einen Absatz oder zwei Sätze hinzufügst.

Beachte folgende Richtlinien bei der Textvervollständigung:
- Füge nur relevante und thematisch passende Informationen hinzu.
- Achte auf einen flüssigen Übergang zwischen dem vorhandenen Text und deiner Ergänzung.
- Verwende einen sachlichen und informativen Schreibstil, der für Lernmaterialien geeignet ist.
- Stelle sicher, dass deine Ergänzung grammatikalisch korrekt und stilistisch angemessen ist.
- Wenn deine Ergänzung mit einem Wort beginnt, so füge ein Leerzeichen am Anfang hinzu, damit sie korrekt an den vorhandenen Text angehängt werden kann.

Der gegebene Text wird im folgenden Benutzer-Prompt vorgegeben. Dieser hat das folgende Format:

<text>
{{TEXT}}
</text>

Vervollständige nun den Text, indem du maximal einen Absatz oder zwei Sätze hinzufügst. Achte darauf, dass deine Ergänzung nahtlos an den vorhandenen Text anschließt und die oben genannten Richtlinien befolgt.

Deine Antwort soll im JSON-Format erfolgen und folgende Felder enthalten:
- "completion": Der Text, den du zur Vervollständigung hinzufügst (maximal ein Absatz oder zwei Sätze).
- "newWord": Ein boolescher Wert (true/false), der angibt, ob die Ergänzung mit einem eigenen Absatz beginnt (true) oder direkt an den bestehenden Text anschließt (false).

Analysiere den gegebenen Text sorgfältig und erstelle dann eine passende Ergänzung. Gib deine Antwort im spezifizierten JSON-Format aus, ohne zusätzliche Erklärungen oder Kommentare.`

export async function POST(req: NextRequest): Promise<NextResponse> {
  const suffix = req.nextUrl.searchParams.get('suffix')

  try {
    if (suffix === null || suffix.length === 0) {
      return NextResponse.json({ error: 'Invalid suffix' }, { status: 400 })
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `<text>${suffix}</text>` },
      ],
      temperature: 0.25,
      response_format: { type: 'json_object' },
    })
    const { choices } = response

    if (choices.length === 0 || choices[0].message.content === null) {
      return NextResponse.json(
        { error: 'No completions found' },
        { status: 500 },
      )
    }

    const completion = JSON.parse(choices[0].message.content) as unknown

    if (!Completion.is(completion)) {
      return NextResponse.json({ error: 'Invalid completion' }, { status: 500 })
    }

    const suggestion = (completion.newWord ? ' ' : '') + completion.completion

    return NextResponse.json({
      suggestion,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    })
  } catch (error) {
    console.error('Error fetching suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suggestion' },
      { status: 500 },
    )
  }
}
