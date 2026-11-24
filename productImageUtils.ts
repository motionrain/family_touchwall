// @ts-nocheck

/**
 * Zieht das schnellste kleine Vorschaubild aus einer OpenFoodFacts-Antwort.
 */
export function extractOpenFoodFactsImage(product) {
  if (!product || typeof product !== 'object') return '';
  return (
    product.image_front_small_url ||
    product.image_front_thumb_url ||
    product.image_small_url ||
    product.image_url ||
    ''
  );
}

/**
 * Komprimiert ein File (Handy-Foto) oder ein laufendes HTMLVideoElement (Scanner-Kamera)
 * direkt im Browser auf ein leichtes JPEG (~12–20 KB).
 */
