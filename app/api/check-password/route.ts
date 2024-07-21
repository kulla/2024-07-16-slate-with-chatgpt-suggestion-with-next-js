import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('password') === process.env.PASSWORD) {
    return NextResponse.json({ success: true })
  } else {
    return NextResponse.json({ success: false }, { status: 401 })
  }
}
