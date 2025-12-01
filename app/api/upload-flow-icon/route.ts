import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured' },
      { status: 500 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB before compression)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      )
    }

    // Compress image on client side (we'll handle compression in the frontend)
    // For now, we'll upload the file as-is and compress it using browser APIs
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `flow-icons/${timestamp}-${randomStr}.${fileExt}`

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      console.error('Error uploading icon:', error)
      return NextResponse.json(
        { error: `Failed to upload icon: ${error.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName)

    if (!urlData?.publicUrl) {
      return NextResponse.json(
        { error: 'Failed to get public URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: urlData.publicUrl,
      fileName: data.path
    })
  } catch (error: any) {
    console.error('Upload icon error:', error)
    return NextResponse.json(
      { error: `Unexpected error: ${error.message}` },
      { status: 500 }
    )
  }
}

