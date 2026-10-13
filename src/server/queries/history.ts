import { cache } from "react";

import { db } from "@/server/db";
import { HISTORY_DEFAULT_CATEGORIES } from "@/lib/labels";
import { loadEntityCore } from "@/server/queries/entity-core";

export const PAGE_SIZE = 50;

export const loadHistoryData = cache(async (id: string, page: number) => {
  const entity = await loadEntityCore(id);
  if (!entity) return null;

  const take = PAGE_SIZE * page;

  const [events, notes, totalEvents, totalNotes] = await Promise.all([
    db.historyEvent.findMany({
      where: { entityId: id, category: { in: HISTORY_DEFAULT_CATEGORIES } },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.note.findMany({
      where: { entityId: id },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        author: { select: { name: true } },
        participants: {
          include: {
            user: { select: { name: true, active: true } },
            contact: { select: { fullName: true, status: true } },
          },
        },
        actionItems: {
          orderBy: { position: "asc" },
          include: { owner: { select: { name: true } }, statusChangedBy: { select: { name: true } } },
        },
      },
    }),
    db.historyEvent.count({ where: { entityId: id, category: { in: HISTORY_DEFAULT_CATEGORIES } } }),
    db.note.count({ where: { entityId: id } }),
  ]);

  const items = [
    ...events.map((e) => ({ kind: "event" as const, id: e.id, date: e.createdAt, event: e })),
    ...notes.map((n) => ({ kind: "note" as const, id: n.id, date: n.createdAt, note: n })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, take);

  return { entity, items, total: totalEvents + totalNotes, hasMore: totalEvents + totalNotes > take };
});

export type HistoryData = NonNullable<Awaited<ReturnType<typeof loadHistoryData>>>;
export type HistoryItem = HistoryData["items"][number];
