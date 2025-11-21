import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured' },
      { status: 500 }
    )
  }

  try {
    const bucketName = 'uploads'
    
    // Test 1: Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      return NextResponse.json({
        success: false,
        error: `Error listing buckets: ${listError.message}`,
        tests: {
          bucketExists: false,
          bucketPublic: false,
          policiesConfigured: false
        }
      })
    }

    const bucket = buckets?.find((b: { name: string; public?: boolean }) => b.name === bucketName)
    const bucketExists = !!bucket
    const bucketPublic = bucket?.public || false

    // Test 2: Try to list files (tests read policy)
    const { data: files, error: listFilesError } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 1 })

    const canRead = !listFilesError

    // Test 3: Try to upload a small test file (tests insert policy)
    const testContent = new Blob(['test'], { type: 'text/plain' })
    const testFile = new File([testContent], 'test.txt', { type: 'text/plain' })
    const testPath = `test-${Date.now()}.txt`
    
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(testPath, testFile)

    const canUpload = !uploadError

    // Clean up test file if upload succeeded
    if (canUpload) {
      await supabase.storage.from(bucketName).remove([testPath])
    }

    return NextResponse.json({
      success: bucketExists && bucketPublic && canRead && canUpload,
      tests: {
        bucketExists,
        bucketPublic,
        canRead,
        canUpload,
        readError: listFilesError?.message || null,
        uploadError: uploadError?.message || null
      },
      recommendations: [
        !bucketExists && 'Create the "uploads" bucket in Storage',
        !bucketPublic && 'Make the "uploads" bucket public',
        !canRead && 'Add a SELECT policy for the "uploads" bucket',
        !canUpload && 'Add an INSERT policy for the "uploads" bucket'
      ].filter(Boolean)
    })
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false,
        error: `Unexpected error: ${error.message}`,
        tests: {
          bucketExists: false,
          bucketPublic: false,
          policiesConfigured: false
        }
      },
      { status: 500 }
    )
  }
}


