import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured' },
      { status: 500 }
    )
  }

  try {
    const bucketName = 'uploads'
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      return NextResponse.json(
        { error: `Error listing buckets: ${listError.message}` },
        { status: 500 }
      )
    }

    const bucketExists = buckets?.some((b: { name: string }) => b.name === bucketName)
    
    if (bucketExists) {
      return NextResponse.json({
        message: `Bucket '${bucketName}' already exists`,
        bucket: bucketName
      })
    }

    // Create the bucket
    const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: null,
      fileSizeLimit: 10485760 // 10MB
    })

    if (createError) {
      // Bucket creation might require admin permissions
      // Provide clear instructions for manual creation
      return NextResponse.json(
        { 
          error: `Failed to create bucket: ${createError.message}`,
          message: 'Bucket creation via API may require admin permissions. Please create it manually.',
          instructions: [
            '1. Go to Storage in your Supabase dashboard',
            `2. Click "New bucket"`,
            `3. Name it "${bucketName}"`,
            '4. Toggle "Public bucket" to ON',
            '5. Click "Create bucket"',
            '6. Then run the storage policies SQL from supabase/storage-policies.sql'
          ]
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Bucket '${bucketName}' created successfully`,
      bucket: bucketName,
      public: true
    })
  } catch (error: any) {
    console.error('Setup storage error:', error)
    return NextResponse.json(
      { 
        error: `Unexpected error: ${error.message}`,
        message: 'Please create the bucket manually in your Supabase dashboard',
        instructions: [
          '1. Go to Storage in your Supabase dashboard',
          '2. Click "New bucket"',
          '3. Name it "uploads"',
          '4. Toggle "Public bucket" to ON',
          '5. Click "Create bucket"'
        ]
      },
      { status: 500 }
    )
  }
}

