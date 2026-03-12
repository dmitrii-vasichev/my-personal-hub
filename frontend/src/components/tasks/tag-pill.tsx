import type { TagBrief } from "@/types/tag";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface TagPillProps {
  tag: TagBrief;
  onRemove?: () => void;
}

export function TagPill({ tag, onRemove }: TagPillProps) {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full leading-none whitespace-nowrap"
      style={{
        backgroundColor: hexToRgba(tag.color, 0.15),
        color: tag.color,
        fontSize: "10px",
        padding: "2px 8px",
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70 cursor-pointer"
          style={{ color: tag.color, fontSize: "10px", lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </span>
  );
}

interface TagPillsProps {
  tags: TagBrief[];
  limit?: number;
}

export function TagPills({ tags, limit = 2 }: TagPillsProps) {
  if (!tags || tags.length === 0) return null;

  const visible = tags.slice(0, limit);
  const overflow = tags.length - limit;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <TagPill key={tag.id} tag={tag} />
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center rounded-full text-tertiary bg-surface-hover leading-none"
          style={{ fontSize: "10px", padding: "2px 6px" }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
