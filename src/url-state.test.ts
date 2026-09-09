import { describe, expect, it } from 'vitest';

import { fromShareFragment, parseDestination, toShareFragment } from './url-state';

describe('destination URL state', () => {
  it('normalizes an absolute HTTPS destination', () => {
    expect(parseDestination('  https://example.com/reef?q=fish  ')).toEqual({
      ok: true,
      destination: 'https://example.com/reef?q=fish',
    });
  });

  it.each(['', 'example.com', 'mailto:reef@example.com', 'javascript:alert(1)'])(
    'rejects unsupported destination %j',
    (value) => {
      expect(parseDestination(value).ok).toBe(false);
    },
  );

  it('round-trips reserved characters through the share fragment', () => {
    const destination = 'https://example.com/a%20path/?q=fish&tone=blue#deep';

    expect(fromShareFragment(toShareFragment(destination))).toEqual({
      ok: true,
      destination,
    });
  });
});
