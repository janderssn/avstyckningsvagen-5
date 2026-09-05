/** Resolve public assets against Vite's base without changing external sources. */
export function appAssetUrl(path, base = './') {
  if (typeof path !== 'string' || !/^\/(?!\/)/.test(path)) return path;
  return `${base.endsWith('/') ? base : `${base}/`}${path.slice(1)}`;
}
