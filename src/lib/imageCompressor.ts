/**
 * Client-Side Image Compressor for Mobile / 3G Pan-African environments
 * Converts camera photos into optimized WebP under 1600px max dimension.
 */
export async function compressImageToWebP(
  file: File | Blob,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.8
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error("Le fichier sélectionné n'est pas une image valide."));
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let { width, height } = img;

        // Maintain aspect ratio within 1600x1600 bounding box
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          return reject(new Error('Impossible d’initialiser le moteur de rendu graphique.'));
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export to WebP with fallback
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const dataUrl = canvas.toDataURL('image/webp', quality);
              resolve({ blob, dataUrl, width, height });
            } else {
              // JPEG Fallback
              canvas.toBlob(
                (fallbackBlob) => {
                  if (fallbackBlob) {
                    const fallbackDataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve({ blob: fallbackBlob, dataUrl: fallbackDataUrl, width, height });
                  } else {
                    reject(new Error("Erreur de compression d'image."));
                  }
                },
                'image/jpeg',
                quality
              );
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => reject(new Error('Impossible de charger l’image sélectionnée.'));
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
  });
}

// Backward-compatible alias
export async function compressImageToDataUrl(file: File, maxWidth = 1600, quality = 0.8): Promise<string> {
  const result = await compressImageToWebP(file, maxWidth, maxWidth, quality);
  return result.dataUrl;
}
