export interface NormalizedProfile {
  providerAccountId: string;
  email: string;
  name?: string | null;
  image?: string | null;
  raw: Record<string, unknown>;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function parseProviderProfile(providerId: string, raw: Record<string, unknown>): NormalizedProfile {
  const id = stringOrNull(raw.sub) ?? stringOrNull(raw.id);
  const email = stringOrNull(raw.email);

  // Accounts need both values to be stable enough for future logins.
  if (!id || !email) {
    throw new Error(`Provider ${providerId} did not return a stable id and email.`);
  }

  return {
    providerAccountId: id,
    email: email.toLowerCase(),
    name: stringOrNull(raw.name) ?? stringOrNull(raw.login),
    image: stringOrNull(raw.picture) ?? stringOrNull(raw.avatar_url),
    raw
  };
}
