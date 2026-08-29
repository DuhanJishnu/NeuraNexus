const validateBaseUrl = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`${name} is required`);
  if (value.startsWith('/')) {
    if (value.startsWith('//') || value.includes('?') || value.includes('#')) {
      throw new Error(`${name} must be a simple root-relative path`);
    }
    return value.replace(/\/$/, '');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
    throw new Error(`${name} must be an HTTP(S) URL without query parameters`);
  }
  return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
};

export const API_BASE_URL = validateBaseUrl(
  process.env.NEXT_PUBLIC_BASEURL,
  'NEXT_PUBLIC_BASEURL',
);

export const FILE_BASE_URL = validateBaseUrl(
  process.env.NEXT_PUBLIC_FILE_BASE_URL || process.env.NEXT_PUBLIC_BASEURL,
  'NEXT_PUBLIC_FILE_BASE_URL',
);
