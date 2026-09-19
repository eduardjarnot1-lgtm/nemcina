/**
 * The static config in `app.json`, plus the one thing that cannot be static.
 *
 * GitHub Pages serves this app from a folder — `/nemcina/` — not from the root
 * of a domain. Expo handles that with `experiments.baseUrl`, which bakes the
 * prefix into the bundle's asset and script paths. That is the supported
 * answer and it is better than rewriting paths afterwards, because the router
 * then writes real URLs: `/nemcina/lessons` is a link that survives a reload.
 *
 * It is baked in, though, so a build carrying it works *only* under that
 * prefix. A build for the root of a host, or for one that assigns the path
 * afterwards, must not have it. So it comes from the environment rather than
 * living in `app.json`:
 *
 *   EXPO_BASE_URL=/nemcina npx expo export --platform web   # for Pages
 *   npx expo export --platform web                          # for anywhere else
 *
 * `npm run build:pages` sets it; nothing else does.
 */
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL?.trim();
  if (!baseUrl) return config;

  // A leading slash and no trailing one is what Expo expects; getting it wrong
  // yields a bundle whose asset paths are subtly wrong, which is worth failing
  // over rather than shipping.
  if (!baseUrl.startsWith('/') || baseUrl.endsWith('/')) {
    throw new Error(
      `EXPO_BASE_URL must start with "/" and not end with one, got "${baseUrl}".`,
    );
  }
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
