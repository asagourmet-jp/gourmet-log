// Image compression utilities

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

// Compresses an image file: corrects EXIF rotation, downsizes to MAX_DIMENSION,
// re-encodes as JPEG. Falls back to the original file on any failure or when
// the image is already small enough.
export async function compressImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const { width, height } = bitmap;
    if (Math.max(width, height) <= MAX_DIMENSION) {
      return file;
    }

    const scale = MAX_DIMENSION / Math.max(width, height);
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch (e) {
    return file;
  } finally {
    bitmap?.close?.();
  }
}
