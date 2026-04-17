import type { ActivityCategory } from "@/lib/api-client";

export function CategoryBadge({ category }: { category: Pick<ActivityCategory, "name" | "color"> }) {
  const bg = category.color ?? "#6B7280";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: bg }}
    >
      {category.name}
    </span>
  );
}
