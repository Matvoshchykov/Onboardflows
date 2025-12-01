/**
 * Compress an image file to a smaller size while maintaining quality
 * Returns a compressed File object
 */
export async function compressImage(
  file: File,
  maxWidth: number = 512,
  maxHeight: number = 512,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const img = new Image()
      
      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.width
        let height = img.height
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }
        
        // Use high-quality image rendering
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        
        // Draw the image
        ctx.drawImage(img, 0, 0, width, height)
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'))
              return
            }
            
            // Create a new File object with the compressed blob
            const compressedFile = new File(
              [blob],
              file.name,
              {
                type: 'image/png', // Always use PNG for consistency
                lastModified: Date.now()
              }
            )
            
            resolve(compressedFile)
          },
          'image/png',
          quality
        )
      }
      
      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }
      
      if (e.target?.result) {
        img.src = e.target.result as string
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsDataURL(file)
  })
}

