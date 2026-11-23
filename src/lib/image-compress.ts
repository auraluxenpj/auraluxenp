const MAX_OUTPUT_BYTES = 512 * 1024;

type Options = { maxSize?: number };

/** Strict image pipeline: returns only WebP files at or below 512 KiB, or throws. */
export async function compressToWebp(file: File, { maxSize = 2000 }: Options = {}): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    throw new Error('Only still raster images can be converted to WebP.');
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('This image format is not supported. Please choose a JPG or PNG.'); }
  try {
    let edge = Math.min(maxSize, Math.max(bitmap.width, bitmap.height));
    while (edge >= 320) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Your browser could not process this image.');
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.84, 0.78, 0.72, 0.66, 0.60, 0.54, 0.48, 0.42]) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob || blob.type !== 'image/webp') throw new Error('WebP conversion is not supported by this browser.');
        if (blob.size <= MAX_OUTPUT_BYTES) {
          const baseName = file.name.replace(/\\.[^.]+$/, '') || 'image';
          return new File([blob], baseName + '.webp', { type: 'image/webp', lastModified: Date.now() });
        }
      }
      edge = Math.floor(edge * 0.8);
    }
    throw new Error('This image cannot be reduced below 512 KB. Choose a smaller or simpler image.');
  } finally { bitmap.close(); }
}
