/**
 * B6 — функцын тэмдэг (feature flags).
 * ------------------------------------------------------------------
 * Уншлага / Сонсгол хоёр **өгөгдөлгүй** байна (content/reading.json = 0,
 * content/listening.json = 0). Хоосон хуудас харуулахын оронд навигациас
 * нууж, гүнзгий холбоос дээр чин шударга "удахгүй" хуудас үзүүлнэ.
 *
 * Кодыг устгахгүй — зөвхөн хаалганы ард нууна. Энэ **тэмдгийг** нээхийн
 * тулд `features.ts`-д `true` болго, эсвэл хөтөчийн түүхэнд (dev/тест):
 *   localStorage.setItem("nd:features", JSON.stringify({ reading: true }))
 * Дэлгэрэнгүй: docs/FEATURE_GAPS.md
 */

export type FeatureName = "reading" | "listening";

/** Үндсэн утга — одоогоор ХОЁУЛАН ОФФ. Нэмэлт тэмдэг энд нэмнэ. */
const DEFAULTS: Record<FeatureName, boolean> = {
  reading: false,
  listening: false,
};

const OVERRIDE_KEY = "nd:features";

/** Кэшгүй — тест болон dev-д тэмдэг солигдохыг шууд харна (жижиг дуудалт). */
function overrides(): Partial<Record<FeatureName, boolean>> {
  const out: Partial<Record<FeatureName, boolean>> = {};
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const k of Object.keys(DEFAULTS) as FeatureName[]) {
          const v = (parsed as Record<string, unknown>)[k];
          if (typeof v === "boolean") out[k] = v;
        }
      }
    }
  } catch {
    /* private mode / муу JSON → default үлдэнэ */
  }
  return out;
}

/** Функц нээлттэй эсэх (default: уншлага/сонсгол ОФФ). */
export function featureEnabled(name: FeatureName): boolean {
  const o = overrides()[name];
  return o ?? DEFAULTS[name];
}

/** Нээлттэй функцүүдийн жагсаалт (навигаци шүүхэд). */
export function enabledFeatures(): FeatureName[] {
  return (Object.keys(DEFAULTS) as FeatureName[]).filter(featureEnabled);
}
