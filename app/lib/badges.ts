// app/lib/badges.ts

export const badgeBase =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

// Exact dezelfde mapping als in projects/page.tsx
export function badgeClassForStatus(status: string) {
  switch (status) {
    case "proposed":
      return "bg-yellow-100 text-yellow-800";
    case "active":
      return "bg-blue-100 text-blue-800";
    case "done":
      return "bg-green-100 text-green-800";
    case "archived":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function badgeClassForPriority(priority: string | null | undefined) {
  switch (priority) {
    case "low":
      return "bg-gray-100 text-gray-700";
    case "medium":
      return "bg-blue-100 text-blue-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "very_high":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// Handige helpers: direct "base + kleur"
export function statusBadgeClass(status: string) {
  return `${badgeBase} ${badgeClassForStatus(status)}`;
}

export function priorityBadgeClass(priority: string | null | undefined) {
  return `${badgeBase} ${badgeClassForPriority(priority)}`;
}

// Voor neutrale badges zoals type/deadline
export function metaBadgeClass() {
  return `${badgeBase} bg-gray-100 text-gray-700`;
}
