import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { whopsdk } from '@/lib/whop-sdk'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, experienceId } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required', success: false },
        { status: 400 }
      )
    }

    // Try to get user ID if available (optional)
    let userId: string | null = null
    try {
      const headersList = await headers()
      const { userId: verifiedUserId } = await whopsdk.verifyUserToken(headersList)
      userId = verifiedUserId
    } catch (error) {
      // User ID is optional, continue without it
      console.log('Could not get user ID for suggestion (optional):', error)
    }

    // Insert suggestion into database - creates a new row
    const insertData: {
      message: string
      experience_id: string | null
      user_id: string | null
      created_at?: string
    } = {
      message: message.trim(),
      experience_id: experienceId || null,
      user_id: userId || null,
    }

    // Only include created_at if we want to override the default
    // The database will set it automatically, but we can set it explicitly if needed
    const { data, error } = await supabase
      .from('suggestions')
      .insert(insertData)
      .select()

    if (error) {
      console.error('Error saving suggestion:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        insertData
      })
      
      // Check if table doesn't exist
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Suggestions table does not exist. Please run the migration: supabase/suggestions.sql', 
            success: false,
            details: error.message 
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to save suggestion', success: false, details: error.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      console.error('No data returned from insert')
      return NextResponse.json(
        { error: 'Failed to save suggestion - no data returned', success: false },
        { status: 500 }
      )
    }

    console.log('Suggestion saved successfully:', data[0])
    return NextResponse.json({ 
      success: true, 
      data: data[0],
      id: data[0].id 
    })
  } catch (error) {
    console.error('Error in suggestions API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage, success: false },
      { status: 500 }
    )
  }
}




