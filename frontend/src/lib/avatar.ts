/**
 * Generates 1-2 letter initials from a display name.
 * "John Doe" → "JD", "Alice" → "A", "Jean-Paul" → "JP"
 */
export function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/[\s-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Deterministic color from name string.
 * Returns a Tailwind-compatible background color class.
 */
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-pink-500",
];

export function getAvatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * Returns inline style background color for avatar (hex values for non-Tailwind contexts).
 */
const AVATAR_HEX_COLORS = [
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#f43f5e", // rose-500
  "#06b6d4", // cyan-500
  "#6366f1", // indigo-500
  "#ec4899", // pink-500
];

export function getAvatarHexColor(name: string): string {
  if (!name) return AVATAR_HEX_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_HEX_COLORS[hash % AVATAR_HEX_COLORS.length];
}
