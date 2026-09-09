export type DestinationResult =
  | { ok: true; destination: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'unsupported-protocol' };

export function parseDestination(value: string): DestinationResult {
  const candidate = value.trim();

  if (candidate.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  let destination: URL;

  try {
    destination = new URL(candidate);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (destination.protocol !== 'http:' && destination.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported-protocol' };
  }

  return { ok: true, destination: destination.href };
}

export function toShareFragment(destination: string): string {
  return `#${new URLSearchParams({ to: destination }).toString()}`;
}

export function fromShareFragment(fragment: string): DestinationResult {
  const payload = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  const destination = new URLSearchParams(payload).get('to') ?? '';

  return parseDestination(destination);
}
