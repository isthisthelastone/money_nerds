export type PrivacyChoice = "necessary" | "all" | null;
export const PRIVACY_VERSION = "v1";
export function readPrivacyChoice(value: string | undefined): PrivacyChoice {
  return value === `${PRIVACY_VERSION}.all` ? "all" : value === `${PRIVACY_VERSION}.necessary` ? "necessary" : null;
}
