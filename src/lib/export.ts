import { toPng } from 'html-to-image';

export async function exportMindMapToPng(container: HTMLElement): Promise<string> {
  return toPng(container, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#f5f7ff'
  });
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [metadata, base64] = dataUrl.split(',');
  const mime = metadata.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}
