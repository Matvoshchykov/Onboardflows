import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from "./supabase"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract file path from Supabase Storage public URL
 * @param url - The public URL from Supabase Storage
 * @returns The file path in the bucket, or null if URL is invalid
 */
function extractFilePathFromUrl(url: string): string | null {
  try {
    // Supabase Storage URLs look like:
    // https://project.supabase.co/storage/v1/object/public/bucket-name/path/to/file.jpg
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/').filter(p => p) // Remove empty strings
    
    // Find the index of 'public'
    const publicIndex = pathParts.indexOf('public')
    if (publicIndex === -1 || publicIndex >= pathParts.length - 2) {
      return null
    }
    
    // After 'public' we have: bucket-name, then path/to/file.jpg
    // We need: path/to/file.jpg (everything after bucket-name)
    const afterPublic = pathParts.slice(publicIndex + 1)
    if (afterPublic.length < 2) {
      return null // Need at least bucket-name and file path
    }
    
    // Skip bucket name (first element) and join the rest
    const filePath = afterPublic.slice(1).join('/')
    return filePath
  } catch {
    return null
  }
}

/**
 * Delete a file from Supabase Storage
 * @param url - The public URL of the file to delete
 * @param bucket - The bucket name (default: 'uploads')
 * @returns true if deletion succeeded, false otherwise
 */
export async function deleteFileFromStorage(
  url: string,
  bucket: string = 'uploads'
): Promise<boolean> {
  if (!supabase) {
    console.error('Supabase is not configured')
    return false
  }

  try {
    // Extract file path from URL
    const filePath = extractFilePathFromUrl(url)
    if (!filePath) {
      console.warn('Could not extract file path from URL:', url)
      return false
    }

    // The extracted path already has bucket name removed, so use it directly
    // Delete file from Supabase Storage
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath])

    if (error) {
      console.error('Error deleting file from storage:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error deleting file:', error)
    return false
  }
}

/**
 * Delete files associated with a component from Supabase Storage
 * @param component - The component that may have associated files
 * @returns Promise that resolves when deletion is complete
 */
export async function deleteComponentFiles(component: { type: string; config?: Record<string, any> }): Promise<void> {
  if (!component.config) return

  const deletePromises: Promise<boolean>[] = []

  // Check for image files
  if (component.config.imageUrl && typeof component.config.imageUrl === 'string') {
    // Only delete if it's a Supabase Storage URL (not a data URL)
    if (component.config.imageUrl.startsWith('http')) {
      deletePromises.push(deleteFileFromStorage(component.config.imageUrl, 'uploads'))
    }
  }

  // Check for video files (thumbnails)
  if (component.config.videoUrl && typeof component.config.videoUrl === 'string') {
    // Only delete if it's a Supabase Storage URL (not a data URL)
    if (component.config.videoUrl.startsWith('http')) {
      deletePromises.push(deleteFileFromStorage(component.config.videoUrl, 'uploads'))
    }
  }

  // Check for file upload files
  if (component.config.fileUrl && typeof component.config.fileUrl === 'string') {
    // Only delete if it's a Supabase Storage URL (not a data URL)
    if (component.config.fileUrl.startsWith('http')) {
      deletePromises.push(deleteFileFromStorage(component.config.fileUrl, 'uploads'))
    }
  }

  // Wait for all deletions to complete
  await Promise.all(deletePromises)
}

/**
 * Convert file to base64 data URL for storage in database
 * @param file - The file to convert
 * @returns Promise resolving to data URL string
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Extract the first frame from a video as an image
 * @param videoFile - The video file
 * @returns A File object containing the thumbnail image, or null if extraction fails
 */
export async function extractVideoThumbnail(videoFile: File): Promise<File | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      resolve(null)
      return
    }

    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      // Set canvas size to video dimensions (or max 1920x1080)
      const maxWidth = 1920
      const maxHeight = 1080
      let width = video.videoWidth
      let height = video.videoHeight

      // Scale down if needed
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = width * ratio
        height = height * ratio
      }

      canvas.width = width
      canvas.height = height

      // Seek to first frame (0 seconds)
      video.currentTime = 0
    }

    video.onseeked = () => {
      // Draw the first frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Create a File from the blob
            const thumbnailFile = new File(
              [blob],
              `${videoFile.name.replace(/\.[^/.]+$/, '')}-thumbnail.jpg`,
              { type: 'image/jpeg', lastModified: Date.now() }
            )
            resolve(thumbnailFile)
          } else {
            resolve(null)
          }
        },
        'image/jpeg',
        0.9 // Start with high quality
      )
    }

    video.onerror = () => {
      resolve(null)
    }

    // Load the video
    const url = URL.createObjectURL(videoFile)
    video.src = url
  })
}

/**
 * Compress an image to be under 1MB while preserving quality
 * Uses adaptive quality reduction to get as close to 1MB as possible
 * @param file - The image file to compress
 * @param maxSizeBytes - Maximum size in bytes (default: 1MB)
 * @param maxWidth - Maximum width (default: 1920)
 * @param maxHeight - Maximum height (default: 1080)
 * @returns Compressed File under 1MB
 */
export async function compressImageUnder1MB(
  file: File,
  maxSizeBytes: number = 1024 * 1024, // 1MB
  maxWidth: number = 1920,
  maxHeight: number = 1080
): Promise<File> {
  // If file is already under 1MB and not too large, return as-is
  if (file.size <= maxSizeBytes && file.size < 2 * 1024 * 1024) {
    return file
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }

        // Create canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          resolve(file)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Adaptive quality compression - start high and reduce until under 1MB
        const compressWithQuality = (quality: number): void => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file)
                return
              }

              // If under 1MB or quality is very low, use this
              if (blob.size <= maxSizeBytes || quality <= 0.1) {
                const compressedFile = new File(
                  [blob],
                  file.name,
                  { type: 'image/jpeg', lastModified: Date.now() }
                )
                resolve(compressedFile)
              } else {
                // Reduce quality and try again
                compressWithQuality(quality - 0.1)
              }
            },
            'image/jpeg', // Always convert to JPEG for better compression
            quality
          )
        }

        // Start with 0.9 quality and reduce if needed
        compressWithQuality(0.9)
      }
      img.onerror = () => resolve(file)
      img.src = e.target?.result as string
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}

/**
 * Check if a storage bucket exists
 * Note: listBuckets() requires admin permissions, so we skip the check
 * and assume the bucket exists (user should create it manually if needed)
 * @param bucket - The storage bucket name
 * @returns true (assumes bucket exists)
 */
async function ensureBucketExists(bucket: string): Promise<boolean> {
  // Skip the check - listBuckets() requires admin permissions that anon key doesn't have
  // If bucket doesn't exist, the upload will fail with "Bucket not found" error
  return true
}

/**
 * Upload a file to Supabase Storage
 * @param file - The file to upload
 * @param bucket - The storage bucket name (default: 'uploads')
 * @param folder - Optional folder path within the bucket
 * @returns The public URL of the uploaded file, or null if upload failed
 */
export async function uploadFileToStorage(
  file: File,
  bucket: string = 'uploads',
  folder?: string,
  compress: boolean = true
): Promise<string | null> {
  if (!supabase) {
    console.error('Supabase is not configured')
    return null
  }

  try {
    // Skip bucket existence check - assume it exists
    // (listBuckets requires admin permissions that anon key doesn't have)
    // If bucket doesn't exist, upload will fail with "Bucket not found" error

    // Compress images to under 1MB before uploading to bucket (unless compress=false)
    let fileToUpload = file
    if (compress && file.type.startsWith('image/')) {
      fileToUpload = await compressImageUnder1MB(file)
      const sizeReduction = ((1 - fileToUpload.size / file.size) * 100).toFixed(1)
      console.log(`Image compressed: ${(file.size / 1024).toFixed(2)}KB → ${(fileToUpload.size / 1024).toFixed(2)}KB (${sizeReduction}% reduction)`)
    }

    // Generate a unique filename
    const fileExt = fileToUpload.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = folder ? `${folder}/${fileName}` : fileName

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      if (error.message?.includes('Bucket not found')) {
        console.error(`Bucket '${bucket}' not found. Please create it in your Supabase dashboard.`)
        console.error('Go to Storage > New bucket > Name: "uploads" > Make it public')
      } else if (error.message?.includes('row-level security policy') || error.message?.includes('RLS') || error.message?.includes('violates')) {
        console.error('❌ Storage RLS Policy Error: Row Level Security is blocking the upload.')
        console.error('')
        console.error('Your policies exist but may not be active. Try:')
        console.error('1. Go to Storage > uploads bucket > Policies tab')
        console.error('2. Verify all 4 policies show "Target roles: public" (not "authenticated")')
        console.error('3. If any show "authenticated", delete and recreate them')
        console.error('4. Make sure bucket is set to PUBLIC')
        console.error('')
        console.error('Or re-run the SQL script: supabase/storage-policies.sql')
        console.error('The SQL includes DROP statements to remove old policies first.')
      } else {
        console.error('Error uploading file:', error)
        if (error.message) {
          console.error('Error message:', error.message)
        }
        if (error.statusCode) {
          console.error('Status code:', error.statusCode)
        }
      }
      return null
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error('Error uploading file:', error)
    return null
  }
}
