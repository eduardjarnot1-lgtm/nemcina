/**
 * Refuse to publish a build that points at the machine that built it.
 *
 * `e2e/sync.mjs` exports the app with EXPO_PUBLIC_API_URL set to its own
 * throwaway server, and Metro caches the transformed module with that value
 * inlined — so a later `expo export` without `--clear` reuses it and ships a
 * build that tries to reach a server on the reader's own machine. That shipped
 * once. It does not get to ship twice, by either publishing route.
 *
 * The check reads the one value that matters rather than scanning for loopback
 * strings, because a scan does not hold: the Firebase Auth SDK carries
 * `http://localhost` as an OAuth request literal, so a scan either fails on
 * every build or needs a vendor exception that would also hide a real one.
 * `src/api.ts` compiles to a string constant and the predicate built from it:
 *
 *   const t='',o=()=>t.trim().length>0
 *
 * Both quote styles have been seen from the same source — the minifier picks
 * whichever escapes less — so the pattern accepts either.
 *
 * Failing to find it is itself a failure. A gate that cannot see what it guards
 * is not a gate, and silently passing is how the first bad build got out.
 */
import { readFile } from 'node:fs/promises';

const PATTERN = /const (\w+)=(["'])((?:\\.|(?!\2)[^\\])*)\2,\w+=\(\)=>\1\.trim\(\)\.length>0/;
const LOOPBACK = /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i;

/**
 * @param {string[]} files absolute paths of every script in the export
 * @param {string} rebuild the command that produces a clean build
 * @returns {Promise<string>} the API URL found, for the caller to report
 */
export async function assertApiUrl(files, rebuild) {
  let apiUrl = null;
  for (const file of files) {
    const found = (await readFile(file, 'utf8')).match(PATTERN);
    if (found) apiUrl = found[3];
  }

  if (apiUrl === null) {
    throw new Error(
      'could not find the compiled API_URL in the export, so it cannot be checked.\n'
      + 'src/api.ts or the minifier changed shape — update the pattern in\n'
      + 'tools/assert-api-url.mjs rather than publishing an unchecked bundle.',
    );
  }

  if (LOOPBACK.test(apiUrl)) {
    throw new Error(
      `the bundle has a loopback API URL baked in (${apiUrl}).\n`
      + "It would send every reader's account requests to their own machine.\n"
      + 'This is Metro reusing a cached transform from e2e/sync.mjs.\n'
      + `Re-export with a cleared cache:\n  ${rebuild}`,
    );
  }

  return apiUrl;
}
