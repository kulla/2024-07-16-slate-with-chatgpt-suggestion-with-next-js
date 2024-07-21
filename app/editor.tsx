import React, { useMemo, useCallback } from 'react'
import {
  createEditor,
  Editor,
  Transforms,
  Text,
  BaseEditor,
  Range,
  Node,
} from 'slate'
import {
  Slate,
  Editable,
  withReact,
  ReactEditor,
  RenderLeafProps,
} from 'slate-react'
import { withHistory, HistoryEditor } from 'slate-history'
import { useMutation } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import { PasswordContext } from './password-context'

interface CustomText {
  text: string
  bold?: boolean
  italic?: boolean
  suggestion?: boolean
}

type CustomElement = { type: 'paragraph'; children: CustomText[] }

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor
    Element: CustomElement
    Text: CustomText
  }
}

const initialValue: CustomElement[] = [
  {
    type: 'paragraph',
    children: [{ text: 'Der Satz des Pythagoras ist' }],
  },
]

const SlateEditor = () => {
  const password = React.useContext(PasswordContext)
  const controller = React.useRef<AbortController | null>(null)
  const lastChange = React.useRef<number>(Date.now())
  const suggestionsEnabled = React.useRef<boolean>(true)
  const [{ promptTokens, completionTokens }, setTokens] = React.useState({
    promptTokens: 0,
    completionTokens: 0,
  })

  const { editor, editorKey } = useMemo(
    () => ({
      editor: withHistory(withReact(createEditor())),
      editorKey: uuidv4(),
    }),
    [],
  )

  const fetchSuggestion = useMutation({
    mutationFn: async ({
      suffix,
    }: {
      suffix: string
      lastChangeOfThisCall: number
    }) => {
      controller.current = new AbortController()
      const response = await fetch(
        `/api/complete-text?suffix=${encodeURIComponent(suffix)}&password=${encodeURIComponent(password)}`,
        { signal: controller.current.signal, method: 'POST' },
      )
      if (!response.ok) {
        console.error('Failed to fetch suggestion', await response.text())
        throw new Error('Failed to fetch suggestion')
      }
      return response.json() as Promise<{
        suggestion: string
        promptTokens: number
        completionTokens: number
      }>
    },
    onSuccess: async (
      { suggestion, promptTokens, completionTokens },
      { lastChangeOfThisCall },
    ) => {
      const { selection } = editor

      if (selection == null || !Range.isCollapsed(selection)) return

      if (lastChange.current === lastChangeOfThisCall) {
        Transforms.insertNodes(editor, {
          text: suggestion,
          suggestion: true,
        })
        editor.setSelection(selection)
      }

      setTokens((prev) => ({
        promptTokens: prev.promptTokens + promptTokens,
        completionTokens: prev.completionTokens + completionTokens,
      }))
    },
  })

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const { selection } = editor

      if (selection == null || !Range.isCollapsed(selection)) return

      const [nextNode] = Editor.next(editor) ?? [null]

      if (nextNode != null && isText(nextNode) && nextNode.suggestion) {
        if (event.key === 'Tab') {
          Transforms.select(
            editor,
            Editor.range(editor, ReactEditor.findPath(editor, nextNode)),
          )
          Editor.addMark(editor, 'suggestion', false)
          Transforms.collapse(editor, { edge: 'end' })

          event.preventDefault()
        } else {
          if (
            event.key.length === 1 &&
            Node.string(nextNode).startsWith(event.key)
          ) {
            Editor.deleteForward(editor)
            Editor.addMark(editor, 'suggestion', false)
            Editor.insertText(editor, event.key)
            event.preventDefault()
          } else if (!isModifierKey(event.key) && !isFunctionKey(event.key)) {
            Transforms.select(
              editor,
              Editor.range(editor, ReactEditor.findPath(editor, nextNode)),
            )
            Editor.deleteFragment(editor)
            Editor.addMark(editor, 'suggestion', false)
            suggestionsEnabled.current = false
          }
        }
      } else if (event.key.length === 1 || event.key === 'Enter') {
        suggestionsEnabled.current = true
      }
    },
    [editor],
  )

  const onChange = React.useCallback(() => {
    const lastChangeOfThisCall = Date.now()
    lastChange.current = lastChangeOfThisCall

    if (controller.current) {
      controller.current.abort()
      controller.current = null
    }

    const { selection } = editor

    if (selection == null || !Range.isCollapsed(selection)) return

    const [nextNode] = Editor.next(editor) ?? [null]

    if (nextNode != null && isText(nextNode) && nextNode.suggestion) return

    // TODO: Check that selection is on end of the line
    // TODO: Get until selection
    const suffix = Node.string(editor)

    setTimeout(() => {
      if (
        lastChange.current === lastChangeOfThisCall &&
        !fetchSuggestion.isPending &&
        suggestionsEnabled.current
      ) {
        fetchSuggestion.mutate({ suffix, lastChangeOfThisCall })
      }
    }, 1000)
  }, [editor])

  const cost = (0.5 * promptTokens) / 1e6 + (1.5 * completionTokens) / 1e6

  return (
    <>
      <h1>Editor</h1>
      <div className="mt-1 border rounded-lg mb-2" lang="de">
        <div
          style={{ backgroundColor: '#FFBE5E' }}
          className="p-2 flex space-x-2 rounded-t-lg"
        >
          <button
            onClick={() => toggleMark(editor, 'bold')}
            className="px-1 font-bold shadow rounded w-5"
          >
            F
          </button>
          <button
            onClick={() => toggleMark(editor, 'italic')}
            className="px-1 shadow italic rounded w-5"
          >
            K
          </button>
        </div>
        <Slate
          editor={editor}
          key={editorKey}
          initialValue={initialValue}
          onChange={onChange}
        >
          <Editable
            renderLeaf={(props) => <Leaf {...props} />}
            onKeyDown={onKeyDown}
            style={{ padding: '0.2em' }}
          />
        </Slate>
      </div>
      <h1>Data about the prototype</h1>
      <p>Status of fetching suggestions: {fetchSuggestion.status}</p>
      <p>
        Used tokens: promptTokens={promptTokens} completionTokens=
        {completionTokens}
      </p>
      <p>Costs so far: {cost}$</p>
    </>
  )
}

function toggleMark(editor: Editor, format: 'bold' | 'italic') {
  const isActive = isMarkActive(editor, format)
  Transforms.setNodes(
    editor,
    { [format]: isActive ? null : true },
    { match: Text.isText, split: true },
  )
}

function isText(node: object): node is Text {
  return 'text' in node
}

function isMarkActive(editor: Editor, format: 'bold' | 'italic') {
  const marks = Editor.marks(editor) || {}
  return marks[format] === true
}

function Leaf(props: RenderLeafProps) {
  let { children } = props
  const { leaf, attributes } = props
  if (leaf.suggestion) {
    children = <span style={{ color: 'grey' }}>{children}</span>
  }
  if (leaf.bold) {
    children = <strong>{children}</strong>
  }
  if (leaf.italic) {
    children = <em>{children}</em>
  }
  return <span {...attributes}>{children}</span>
}

function isModifierKey(key: string): boolean {
  const modifierKeys: string[] = ['Shift', 'Control', 'Alt', 'Meta']
  return modifierKeys.includes(key)
}

function isFunctionKey(key: string): boolean {
  const functionKeys: string[] = [
    'F1',
    'F2',
    'F3',
    'F4',
    'F5',
    'F6',
    'F7',
    'F8',
    'F9',
    'F10',
    'F11',
    'F12',
  ]
  return functionKeys.includes(key)
}

export default SlateEditor
