export const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
/** The biggest file a person may pick; it is shrunk before it is uploaded. */
export const maxPickedBytes = 5 * 1024 * 1024;
const jpegQualities = [0.86, 0.7, 0.52];

/** Why a picked file cannot be used, or null if it can. */
export function checkImageFile(file: { type: string; size: number }): string | null {
  if (!acceptedImageTypes.includes(file.type)) return 'Choose a JPG, PNG or WebP image.';
  if (file.size > maxPickedBytes) return 'Choose an image smaller than 5 MB.';
  return null;
}

/** Dimensions that fit `maxSide` on the longer edge, keeping the shape and never enlarging. */
export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Shrink a picked photo in the browser before upload: scaled to `maxSide` on its longer edge and
 * re-encoded as a JPEG, lowering the quality until it is within `maxBytes`. Phone photos are
 * several megabytes, and the API only accepts small images.
 */
export async function prepareImage(
  file: File,
  options: { maxSide: number; maxBytes: number },
): Promise<Blob> {
  const problem = checkImageFile(file);
  if (problem) throw Error(problem);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw Error('That file could not be read as an image.');
  }
  try {
    const size = fitWithin(bitmap.width, bitmap.height, options.maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Image processing is unavailable in this browser.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    for (const quality of jpegQualities) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality),
      );
      if (blob && blob.size <= options.maxBytes) return blob;
    }
    throw Error('Unable to compress the image. Please choose a smaller photo.');
  } finally {
    bitmap.close();
  }
}
