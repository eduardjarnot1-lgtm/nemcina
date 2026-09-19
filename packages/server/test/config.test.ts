/**
 * Configuration.
 *
 * One rule being protected: a production build must not start with a secret it
 * invented for itself. A fallback signing key is a fallback that ships.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, readConfig } from '../src/config.ts';

describe('secrets', () => {
  test('production refuses to start without one', () => {
    assert.throws(
      () => readConfig({ NODE_ENV: 'production' }),
      (error: unknown) => {
        assert.ok(error instanceof ConfigError);
        assert.match(error.message, /TOKEN_PEPPER/);
        assert.match(error.message, /no default/);
        return true;
      },
    );
  });

  test('an empty string is not a secret', () => {
    assert.throws(() => readConfig({ NODE_ENV: 'production', TOKEN_PEPPER: '   ' }), ConfigError);
  });

  test('production starts when it is given one', () => {
    const config = readConfig({ NODE_ENV: 'production', TOKEN_PEPPER: 'a real secret' });
    assert.equal(config.production, true);
    assert.equal(config.tokenPepper, 'a real secret');
  });

  test('development generates one, and it is labelled and ephemeral', () => {
    const first = readConfig({ NODE_ENV: 'development' });
    const second = readConfig({ NODE_ENV: 'development' });
    assert.match(first.tokenPepper, /^dev-ephemeral-/);
    assert.notEqual(first.tokenPepper, second.tokenPepper,
      'a development secret that is stable is a development secret that ships');
  });

  test('development does not write to a production path by default', () => {
    assert.equal(readConfig({ NODE_ENV: 'development' }).databasePath, ':memory:');
  });
});

describe('CORS', () => {
  test('is off by default — a phone does not need it', () => {
    assert.deepEqual(readConfig({ NODE_ENV: 'test' }).corsOrigins, []);
  });

  test('origins are named one at a time; there is no wildcard to set', () => {
    const config = readConfig({
      NODE_ENV: 'test',
      CORS_ORIGINS: 'https://app.example.com, https://staging.example.com',
    });
    assert.deepEqual(config.corsOrigins, ['https://app.example.com', 'https://staging.example.com']);
  });
});

describe('defaults', () => {
  test('are the safe ones', () => {
    const config = readConfig({ NODE_ENV: 'test' });
    assert.equal(config.production, false);
    assert.ok(config.sessionDays > 0);
    assert.ok(config.signInAttempts > 0 && config.signInAttempts <= 20,
      'the sign-in limit is not a limit');
  });

  test('the environment can override them', () => {
    const config = readConfig({
      NODE_ENV: 'test', PORT: '9999', SESSION_DAYS: '7', SIGN_IN_ATTEMPTS: '3',
    });
    assert.equal(config.port, 9999);
    assert.equal(config.sessionDays, 7);
    assert.equal(config.signInAttempts, 3);
  });
});
