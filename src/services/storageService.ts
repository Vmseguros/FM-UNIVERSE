import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseStorage, isFirebaseConfigured } from '../config/firebase';

export type ClubAssetType = 'logo' | 'kit-home' | 'kit-away' | 'stadium';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];

/**
 * Valida formato (PNG, JPG, JPEG, WEBP) e tamanho máximo de 5MB.
 */
export function validateImageFile(file: File): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo fornecido.' };
  }

  // Validação de tipo MIME
  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());
  const hasAllowedExt = /\.(png|jpe?g|webp)$/i.test(file.name);

  if (!isMimeAllowed && !hasAllowedExt) {
    return {
      valid: false,
      error: 'Formato inválido. São permitidos apenas arquivos PNG, JPG, JPEG e WEBP.',
    };
  }

  // Validação de tamanho
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Arquivo excede o limite máximo de 5MB (tamanho atual: ${sizeMb}MB).`,
    };
  }

  return { valid: true };
}

/**
 * Converte um arquivo de imagem em um Data URL compacto e otimizado (Base64),
 * redimensionado proporcionalmente para caber com segurança no Firestore (< 30KB).
 */
export async function convertImageToOptimizedDataUrl(
  file: File,
  maxDimension = 256
): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Salva como WebP ou PNG otimizado
            const dataUrl = canvas.toDataURL('image/webp', 0.85);
            resolve(dataUrl);
            return;
          }
        } catch {
          // Ignora e usa o resultado bruto do reader
        }
        resolve((e.target?.result as string) || '');
      };
      img.onerror = () => resolve((e.target?.result as string) || '');
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(URL.createObjectURL(file));
    reader.readAsDataURL(file);
  });
}

/**
 * Wrapper de timeout para promessas que evita bloqueios indefinidos na interface.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[Timeout ${timeoutMs}ms] ${errorMsg}`)), timeoutMs)
    ),
  ]);
}

/**
 * Gera o caminho estruturado e seguro para o asset do clube no Firebase Storage.
 * Estrutura: clubs/{uid}/{assetType}
 */
export function getClubAssetStoragePath(uid: string, assetType: ClubAssetType): string {
  const cleanUid = uid.trim();
  if (!cleanUid) {
    throw new Error('UID do manager é obrigatório para gerar o caminho de armazenamento.');
  }
  return `clubs/${cleanUid}/${assetType}`;
}

/**
 * Realiza o upload de um asset visual do clube para o Firebase Storage.
 * Inclui proteção estrita de timeout (5 segundos) e fallback para Data URL otimizado
 * caso o bucket de Storage do Firebase não esteja provisionado ou CORS falhe.
 */
export async function uploadClubAsset(
  uid: string,
  file: File,
  assetType: ClubAssetType
): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Arquivo inválido.');
  }

  const cleanUid = uid.trim();
  if (!cleanUid) {
    throw new Error('Manager não autenticado para realizar upload.');
  }

  const storagePath = getClubAssetStoragePath(cleanUid, assetType);
  const storage = getFirebaseStorage();

  if (isFirebaseConfigured() && storage) {
    try {
      const storageRef = ref(storage, storagePath);
      const metadata = {
        contentType: file.type || 'image/png',
        customMetadata: {
          managerUid: cleanUid,
          assetType,
          uploadedAt: new Date().toISOString(),
        },
      };

      // Executa o upload com timeout estrito de 4.5 segundos
      const uploadResult = await withTimeout(
        uploadBytes(storageRef, file, metadata),
        4500,
        `Tempo limite esgotado no upload de ${assetType} para Firebase Storage (${storagePath}).`
      );

      const downloadUrl = await withTimeout(
        getDownloadURL(uploadResult.ref),
        3000,
        `Tempo limite esgotado ao obter URL de download de ${assetType}.`
      );

      console.info(`✅ [Storage] Upload concluído com sucesso em ${storagePath}`);
      return downloadUrl;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `⚠️ [Storage] Falha no upload para ${storagePath} (${errMsg}). Utilizando imagem otimizada permanente:`,
        err
      );
      // Fallback seguro: converte para dataUrl leve que é persistido no Firestore sem depender do bucket
      return await convertImageToOptimizedDataUrl(
        file,
        assetType === 'stadium' ? 400 : 256
      );
    }
  }

  // Fallback offline / local para desenvolvimento
  return await convertImageToOptimizedDataUrl(
    file,
    assetType === 'stadium' ? 400 : 256
  );
}

export const storageService = {
  validateImageFile,
  getClubAssetStoragePath,
  uploadClubAsset,
  convertImageToOptimizedDataUrl,
};
