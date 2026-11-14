// File save/open behind a thin adapter (PLAN.md section 3). The web version uses a download
// link and a hidden file input; native builds can swap in Capacitor's Filesystem/Share.

export interface FileAdapter {
  save(filename: string, blob: Blob): Promise<void>;
  /** Let the user pick one file. Resolves null if they cancel (where the platform can tell). */
  open(accept: string): Promise<File | null>;
}

export const webFiles: FileAdapter = {
  async save(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser a moment to start the download before freeing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },

  open(accept) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';
      input.addEventListener('change', () => {
        resolve(input.files?.[0] ?? null);
        input.remove();
      });
      input.addEventListener('cancel', () => {
        resolve(null);
        input.remove();
      });
      document.body.appendChild(input);
      input.click();
    });
  },
};

let files: FileAdapter = webFiles;
export const getFiles = () => files;
export const setFiles = (f: FileAdapter) => {
  files = f;
};

/** A safe file name from a board name. */
export function fileNameFor(name: string, ext: string): string {
  const base =
    name
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 80) || 'board';
  return `${base}.${ext}`;
}
