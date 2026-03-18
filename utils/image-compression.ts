import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;

export async function compressImageUri(uri: string): Promise<string> {
  try {
    console.log(`[ImageCompress] Compressing image URI...`);

    if (Platform.OS === 'web') {
      return await compressImageUriWeb(uri);
    }

    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_DIMENSION } }],
      { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );

    console.log(`[ImageCompress] Compressed native image to: ${manipulated.uri.substring(0, 60)}...`);
    return manipulated.uri;
  } catch (error) {
    console.warn(`[ImageCompress] Compression failed, returning original URI:`, error);
    return uri;
  }
}

async function compressImageUriWeb(uri: string): Promise<string> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise<string>((resolve) => {
      const img = new (window as any).Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(uri);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        console.log(`[ImageCompress] Web compressed to ${dataUrl.length} chars`);
        resolve(dataUrl);
      };
      img.onerror = () => {
        console.warn(`[ImageCompress] Web image load failed, returning original`);
        resolve(uri);
      };
      img.src = URL.createObjectURL(blob);
    });
  } catch {
    return uri;
  }
}

export async function compressBase64Image(base64DataUri: string): Promise<string> {
  try {
    if (!base64DataUri || !base64DataUri.startsWith('data:image/')) {
      return base64DataUri;
    }

    const rawBase64 = base64DataUri.split(',')[1] || '';
    if (rawBase64.length < 50000) {
      console.log(`[ImageCompress] Base64 already small (${rawBase64.length} chars), skipping`);
      return base64DataUri;
    }

    console.log(`[ImageCompress] Compressing base64 image (${rawBase64.length} chars)...`);

    if (Platform.OS === 'web') {
      return await compressBase64Web(base64DataUri);
    }

    const manipulated = await ImageManipulator.manipulateAsync(
      base64DataUri,
      [{ resize: { width: MAX_DIMENSION } }],
      { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );

    const response = await fetch(manipulated.uri);
    const blob = await response.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log(`[ImageCompress] Compressed base64 from ${rawBase64.length} to ${(result.split(',')[1] || '').length} chars`);
        resolve(result);
      };
      reader.onerror = () => resolve(base64DataUri);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn(`[ImageCompress] Base64 compression failed:`, error);
    return base64DataUri;
  }
}

async function compressBase64Web(base64DataUri: string): Promise<string> {
  return new Promise<string>((resolve) => {
    const img = new (window as any).Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64DataUri);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      console.log(`[ImageCompress] Web base64 compressed to ${dataUrl.length} chars`);
      resolve(dataUrl);
    };
    img.onerror = () => resolve(base64DataUri);
    img.src = base64DataUri;
  });
}
