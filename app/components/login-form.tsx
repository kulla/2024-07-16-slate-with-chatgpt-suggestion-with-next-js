import clsx from 'clsx'
import React from 'react'
import { useMutation } from '@tanstack/react-query'

import { PasswordContext } from '../hooks/password-context'

interface LoginFormProps {
  children: React.ReactNode
}

export default function LoginForm(props: LoginFormProps) {
  const [password, setPassword] = React.useState('')
  const [isCorrectPassword, setIsCorrectPassword] = React.useState(false)

  const checkPassword = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/check-password?password=${encodeURIComponent(password)}`,
        { method: 'POST' },
      )
      if (!response.ok) {
        throw new Error('Wrong password')
      }
      return response.json()
    },
    onSuccess: () => setIsCorrectPassword(true),
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
  }

  return isCorrectPassword ? renderChildren() : renderLoginForm()

  function renderChildren() {
    return (
      <PasswordContext.Provider value={password}>
        {props.children}
      </PasswordContext.Provider>
    )
  }

  function renderLoginForm() {
    return (
      <div>
        <div className="max-w-md mx-auto p-8">
          <h1 className="text-3xl font-bold mb-4">Login</h1>
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block mb-1">
                Password:
              </label>
              <input
                id="password"
                className="w-full border border-gray-300 rounded px-3 py-2"
                type="password"
                value={password}
                onChange={handleChange}
              />
            </div>
            <button
              className={clsx(
                'w-full py-2 rounded text-white font-bold',
                password.length ? 'bg-gray-700' : 'bg-gray-200',
              )}
              onClick={() => checkPassword.mutate()}
              disabled={!password.length}
            >
              Sign in
            </button>
            {checkPassword.isError && (
              <div className="text-red-500">Wrong password</div>
            )}
          </div>
        </div>
      </div>
    )
  }
}
