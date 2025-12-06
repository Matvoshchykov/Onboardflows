import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, experienceId } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Insert suggestion into database
    const { error } = await supabase
      .from('suggestions')
      .insert({
        message: message.trim(),
        experience_id: experienceId || null,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error saving suggestion:', error)
      return NextResponse.json(
        { error: 'Failed to save suggestion' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in suggestions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



