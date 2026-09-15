/**
 * The entry point.
 *
 * Refuses to start in production without its secrets rather than falling back
 * to a default that would ship.
 */
import { createApi } from './http.ts';
import { ConfigError, readConfig } from './config.ts';

try {
  const config = readConfig();
  const api = createApi(config);
  const port = await api.listen(config.port);
  console.log(`nemcina server listening on ${port} (${config.production ? 'production' : 'development'})`);
  if (!config.production) {
    console.log('development mode: session secrets are ephemeral and reset on restart');
  }
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`refusing to start: ${error.message}`);
    process.exit(78); // EX_CONFIG
  }
  throw error;
}
