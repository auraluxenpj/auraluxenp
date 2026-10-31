// src/lib/image-compress.ts
// Resizes an image in the browser and converts it to WebP before upload.

type Options = {
  maxSize?: number; // longest side in pixels
  quality?: number; // 0..1
};

export async function compressToWebp(
  file: File,
  { maxSize = 1600, quality = 0.82 }: Options = {},
): Promise<File> {
  // Leave non-images, GIFs and SVGs untouched
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );

    // Browser couldn't make WebP, or the result isn't smaller: keep the original
    if (!blob || blob.type !== "image/webp" || (scale === 1 && blob.size >= file.size)) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
  } catch {
    // If anything fails, upload the original instead of blocking the admin
    return file;
  }
}
