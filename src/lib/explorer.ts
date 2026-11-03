/**
 * EXPLORER-ийн төлөвийн шүүлт.
 * ------------------------------------------------------------------
 * Vocabulary болон Kanji жагсаалт нэг л тодорхойлолт ашиглана:
 * төлөв нь `cardStage()`-аас гарна, «эзэмшсэн» нь `isMastered()`-ээр
 * шийдэгдэнэ. Ингэснээр жагсаалтын шүүлт, Stats, Progress, Home
 * дээрх тоо зөрөхгүй.
 */
import { cardStage, type Card } from "./srs";

export type ExplorerState = "all" | "new" | "learning" | "review" | "mastered" | "fav";

/** Шүүлтийн дараалал — Vocabulary/Kanji хоёулаа ижил. */
export const EXPLORER_STATES: ExplorerState[] = [
  "all", "new", "learning", "review", "mastered", "fav",
];

/** Тухайн id (үг эсвэл ханз) сонгосон төлөвт багтах эсэх. */
export function matchesExplorerState(
  id: string,
  srs: Record<string, Card>,
  favorites: string[],
  state: ExplorerState,
): boolean {
  if (state === "all") return true;
  if (state === "fav") return favorites.includes(id);
  return cardStage(srs[id]).id === state;
}
