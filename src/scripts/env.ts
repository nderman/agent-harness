/**
 * Shared script bootstrap: load `.env` for local runs (an already-exported
 * ANTHROPIC_API_KEY still wins), then require the key or exit with a clear
 * message. Used by the live scripts (`demo`, `record`); the test suite never
 * touches this path.
 */
export function requireApiKey(scriptName: string): string {
  try {
    process.loadEnvFile('.env');
  } catch {
    // no .env file — rely on the ambient environment
  }
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    console.error(`${scriptName}: set ANTHROPIC_API_KEY to run.`);
    process.exit(1);
  }
  return apiKey;
}
