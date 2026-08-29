const validateOrigin = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`${name} is required`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/') {
    throw new Error(`${name} must contain only an HTTP(S) origin`);
  }
  return url.origin;
};

export const API_ORIGIN = validateOrigin(
  process.env.NEXT_PUBLIC_BASEURL,
  'NEXT_PUBLIC_BASEURL',
);

export const FILE_ORIGIN = validateOrigin(
  process.env.NEXT_PUBLIC_FILE_BASE_URL || process.env.NEXT_PUBLIC_BASEURL,
  'NEXT_PUBLIC_FILE_BASE_URL',
);
