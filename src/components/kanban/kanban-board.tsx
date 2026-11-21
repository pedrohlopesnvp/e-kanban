"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mutate } from "@/lib/client";
import { kanbanColumns, priorityLabels, statusLabels, type KanbanColumnId } from "@/lib/labels";
import { formatDateTime, formatQty } from "@/lib/numbers";
import type { BoardCard } from "@/server/kanban/replenishment";

const columnStyle: Record<KanbanColumnId, { badge: "blue" | "green" | "yellow" | "red"; border: string }> = {
  AVAILABLE: { badge: "blue", border: "border-blue-500!" },
  IN_USE: { badge: "green", border: "border-emerald-500!" },
  CRITICAL: { badge: "yellow", border: "border-yellow-400!" },
  EMPTY: { badge: "red", border: "border-red-500!" },
};

export function KanbanBoard({ cards }: { cards: BoardCard[] }) {
  const [history, setHistory] = useState<BoardCard | null>(null);
  const [events, setEvents] = useState<{ id: string; toStatus: string; userName: string; createdAt: string; note: string | null }[]>([]);

  async function openHistory(card: BoardCard) {
    setHistory(card);
    if (!card.requestId) {
      setEvents([]);
      return;
    }
    const data = await mutate<{ events: typeof events }>(`/api/replenishments/${card.requestId}`);
    setEvents(data.events);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {kanbanColumns.map((column) => (
          <Column key={column.id} id={column.id} title={column.title} hint={column.hint} count={cards.filter((card) => card.column === column.id).length}>
            {cards
              .filter((card) => card.column === column.id)
              .map((card) => (
                <KanbanCard key={card.id} card={card} onOpen={() => void openHistory(card)} />
              ))}
          </Column>
        ))}
      </div>
      <Dialog open={Boolean(history)} onOpenChange={(open) => !open && setHistory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{history ? `${history.code} · ${history.name}` : "Cartão"}</DialogTitle>
          </DialogHeader>
          {history ? (
            <div className="space-y-3 text-sm">
              <p>Disponível: {formatQty(history.availableQty, history.unit)}</p>
              <p>Mínimo: {formatQty(history.minStock, history.unit)}</p>
              <p>Localização: {history.locationName}</p>
              {history.note ? <p className="text-muted-foreground">{history.note}</p> : null}
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.id} className="rounded-lg bg-muted px-3 py-2">
                    <p>
                      {statusLabels[event.toStatus as keyof typeof statusLabels] || event.toStatus} · {event.userName}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
                    {event.note ? <p className="mt-1">{event.note}</p> : null}
                  </div>
                ))}
                {events.length === 0 ? <p className="text-muted-foreground">Este cartão ainda não tem histórico de reposição.</p> : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Column({ id, title, hint, count, children }: { id: KanbanColumnId; title: string; hint: string; count: number; children: React.ReactNode }) {
  const style = columnStyle[id];
  return (
    <section className={`w-72 shrink-0 rounded-xl border-2 bg-card/60 ${style.border}`}>
      <header className="border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Badge tone={style.badge}>{count}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </header>
      <div className="flex min-h-48 flex-col gap-3 p-3">{children}</div>
    </section>
  );
}

function KanbanCard({ card, onOpen }: { card: BoardCard; onOpen: () => void }) {
  return (
    <article className={`rounded-xl border-2 bg-card p-3 shadow-sm ${columnStyle[card.column].border}`}>
      <CardBody card={card} />
      <button className="mt-3 text-xs text-primary" onClick={onOpen}>
        Ver histórico
      </button>
    </article>
  );
}

function CardBody({ card }: { card: BoardCard }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xs font-semibold">
          {card.imageUrl ? <img src={card.imageUrl} alt="" className="h-full w-full object-cover" /> : card.code.slice(0, 3)}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{card.code}</p>
          <h3 className="text-sm font-semibold leading-5">{card.name}</h3>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs">
        <span>Disponível</span>
        <span className="text-right">{formatQty(card.availableQty, card.unit)}</span>
        <span>Mínimo</span>
        <span className="text-right">{formatQty(card.minStock, card.unit)}</span>
        <span>Solicitado</span>
        <span className="text-right">
          {card.column === "IN_USE" || card.column === "AVAILABLE" || card.requestedQty == null
            ? "—"
            : formatQty(card.requestedQty, card.unit)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge tone={card.critical ? "red" : "muted"}>{card.locationName}</Badge>
        <Badge tone={card.priority === "CRITICAL" ? "red" : card.priority === "HIGH" ? "yellow" : "blue"}>
          {priorityLabels[card.priority]}
        </Badge>
      </div>
      {card.requestedAt ? <p className="text-xs text-muted-foreground">{formatDateTime(card.requestedAt)}</p> : null}
      {card.assigneeName ? <p className="text-xs">Responsável: {card.assigneeName}</p> : null}
    </div>
  );
}
