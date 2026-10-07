import "server-only";
import { baseMessages } from "./base";
import { interactiveMessages } from "./interactive-messages";
import { publicMessages } from "./public-messages";
import { extraMessages } from "./extra-messages";
import { reviewedMessages } from "./reviewed-messages";
import type { Locale, Messages } from "./config";

export function getMessages(locale: Locale): Messages {
  return { ...extraMessages[locale], ...baseMessages[locale], ...interactiveMessages[locale], ...publicMessages[locale], ...reviewedMessages[locale] };
}
