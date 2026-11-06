// Polish translations, keyed by the English source text.
import { COMMON } from "./pl/common";
import { PUBLIC } from "./pl/public";
import { PORTAL } from "./pl/portal";
import { ADMIN } from "./pl/admin";
import { PLATFORM } from "./pl/platform";
import { HOME } from "./pl/home";

export const PL: Record<string, string> = { ...COMMON, ...PUBLIC, ...PORTAL, ...ADMIN, ...PLATFORM, ...HOME };
