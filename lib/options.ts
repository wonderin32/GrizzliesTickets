export const OPTIONS = ["Jeff", "Marla", "Riley", "Eitan", "Sell", "Sold"] as const;
export type Option = (typeof OPTIONS)[number];

// Tag colors for each person / status.
export const OPTION_COLORS: Record<Option, { bg: string; fg: string }> = {
  Jeff: { bg: "#5D76A9", fg: "#FFFFFF" },
  Marla: { bg: "#C2457F", fg: "#FFFFFF" },
  Riley: { bg: "#1F9C8F", fg: "#FFFFFF" },
  Eitan: { bg: "#E8742A", fg: "#FFFFFF" },
  Sell: { bg: "#F5B112", fg: "#12173F" },
  Sold: { bg: "#3A9D50", fg: "#FFFFFF" },
};

export const NOTES_MAX = 200;

export function isOption(v: unknown): v is Option {
  return typeof v === "string" && (OPTIONS as readonly string[]).includes(v);
}

export type Game = {
  id: number;
  game_id: string;
  game_date: string; // YYYY-MM-DD (Memphis local date)
  tipoff: string | null; // ISO timestamp, null when time is TBD
  opponent: string;
  opponent_code: string | null;
  label: string | null; // e.g. "NBA Cup"
  slot1: Option | null;
  slot2: Option | null;
  notes: string;
};
