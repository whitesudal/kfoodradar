// src/lib/menu-dictionary.ts
// MVP용 표준 메뉴 사전. 이후 DB의 Menu/MenuAlias로 이전한다.

export type MenuDictionaryEntry = {
  canonicalName: string;
  englishName?: string;
  category: string;
  aliases: string[];
};

export const STANDARD_MENU_DICTIONARY: Record<string, MenuDictionaryEntry> = {
  kongguksu: {
    canonicalName: "콩국수",
    englishName: "cold soy milk noodles",
    category: "여름면",
    aliases: [
      "콩국수",
      "kongguksu",
      "soybean noodles",
      "cold soy milk noodles",
    ],
  },
  naengmyeon: {
    canonicalName: "냉면",
    englishName: "cold noodles",
    category: "여름면",
    aliases: [
      "냉면",
      "naengmyeon",
      "cold noodles",
      "korean cold noodles",
    ],
  },
  jjukkumi: {
    canonicalName: "쭈꾸미",
    englishName: "spicy baby octopus",
    category: "볶음/주점",
    aliases: [
      "쭈꾸미",
      "주꾸미",
      "jjukkumi",
      "jukkumi",
      "spicy baby octopus",
    ],
  },
  sundae_guk: {
    canonicalName: "순대국",
    englishName: "blood sausage soup",
    category: "국밥",
    aliases: [
      "순대국",
      "순댓국",
      "sundaeguk",
      "sundae soup",
      "blood sausage soup",
    ],
  },
  mala_tang: {
    canonicalName: "마라탕",
    englishName: "mala soup",
    category: "중식",
    aliases: [
      "마라탕",
      "malatang",
      "mala tang",
      "mala soup",
    ],
  },
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeMenuCandidate(candidate: string): MenuDictionaryEntry | null {
  const normalizedCandidate = normalizeToken(candidate);

  for (const entry of Object.values(STANDARD_MENU_DICTIONARY)) {
    if (entry.aliases.some((alias) => normalizeToken(alias) === normalizedCandidate)) {
      return entry;
    }
  }

  return null;
}

