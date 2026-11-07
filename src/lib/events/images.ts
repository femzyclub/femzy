import "server-only";

/**
 * Secure image check for uploads: trusts the file's actual bytes, not its name or the browser's
 * MIME type. Returns the real type + a safe extension, or null if it isn't an allowed image.
 */
export async function sniffImage(file: File, { maxBytes, allowHeic = false }: { maxBytes: number; allowHeic?: boolean }) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) return { error: "No image selected." } as const;
  if (file.size > maxBytes) return { error: `Image must be under ${Math.round(maxBytes / 1024 / 1024)} MB.` } as const;

  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.slice(from, to));

  let type: string | null = null;
  let ext = "";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) [type, ext] = ["image/jpeg", "jpg"];
  else if (buf[0] === 0x89 && ascii(1, 4) === "PNG") [type, ext] = ["image/png", "png"];
  else if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") [type, ext] = ["image/webp", "webp"];
  else if (allowHeic && ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|mif1|msf1|heif)$/.test(ascii(8, 12)))
    [type, ext] = ["image/heic", "heic"];

  if (!type) return { error: allowHeic ? "Upload a JPG, PNG, WEBP or HEIC image." : "Upload a JPG, PNG or WEBP image." } as const;
  return { type, ext, body: await file.arrayBuffer() } as const;
}
