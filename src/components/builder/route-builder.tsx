"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GlobeIcon,
  GripVerticalIcon,
  MapPinPlusIcon,
  MoreVerticalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { flagEmoji, formatDateRange, plural } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { deleteStop, reorderStops } from "@/server/actions/builder";
import type { BuilderItem, BuilderStop } from "@/server/trips";
import { ItemCard } from "./item-card";
import { ItemSheet, type ItemSheetState } from "./item-sheet";
import { StopSheet, type StopSheetState } from "./stop-sheet";

export function RouteBuilder({
  tripId,
  currency,
  tripStart,
  stops,
  tripItems,
}: {
  tripId: string;
  currency: string;
  tripStart: string | null;
  stops: BuilderStop[];
  tripItems: BuilderItem[];
}) {
  // Local order so drag-and-drop feels instant; reset whenever the server's list changes.
  const serverOrder = stops.map((s) => s.id).join(",");
  const [order, setOrder] = useState(() => stops.map((s) => s.id));
  const [syncedWith, setSyncedWith] = useState(serverOrder);
  if (syncedWith !== serverOrder) {
    setSyncedWith(serverOrder);
    setOrder(stops.map((s) => s.id));
  }
  const byId = new Map(stops.map((s) => [s.id, s]));
  const ordered = order.map((id) => byId.get(id)).filter((s): s is BuilderStop => !!s);

  const [stopSheet, setStopSheet] = useState<StopSheetState>(null);
  const [itemSheet, setItemSheet] = useState<ItemSheetState>(null);
  const [toDelete, setToDelete] = useState<BuilderStop | null>(null);
  const [, startTransition] = useTransition();
  // Stable id so dnd-kit's accessibility ids match between server and client render.
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function commitOrder(next: string[]) {
    const previous = order;
    setOrder(next);
    startTransition(async () => {
      const result = await reorderStops(tripId, next);
      if (!result.ok) {
        setOrder(previous);
        toast.error(result.message ?? "Couldn't save the new order");
      }
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    commitOrder(arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))));
  }

  const move = (id: string, delta: number) => {
    const from = order.indexOf(id);
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    commitOrder(arrayMove(order, from, to));
  };

  const lastDepart = ordered.at(-1)?.departOn ?? ordered.at(-1)?.arriveOn ?? tripStart ?? "";
  const stopOptions = ordered.map(({ id, name }) => ({ id, name }));

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="route-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="route-heading" className="font-heading text-xl font-semibold">
            Route
          </h2>
          {ordered.length ? (
            <span className="text-sm text-muted-foreground">{plural(ordered.length, "stop")}</span>
          ) : null}
        </div>

        {ordered.length === 0 ? (
          <EmptyState
            icon={MapPinPlusIcon}
            title="Add your first stop"
            action={
              <Button size="lg" className="h-12 px-6" onClick={() => setStopSheet({ mode: "add", defaultArrive: tripStart ?? "" })}>
                <PlusIcon aria-hidden /> Add a stop
              </Button>
            }
          >
            Stops are the cities, towns and trailheads on your route. Add them in order; you can drag them around later.
          </EmptyState>
        ) : (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <ol className="space-y-4">
                {ordered.map((stop, index) => (
                  <SortableStop
                    key={stop.id}
                    stop={stop}
                    index={index}
                    total={ordered.length}
                    currency={currency}
                    onEdit={() => setStopSheet({ mode: "edit", stop })}
                    onDelete={() => setToDelete(stop)}
                    onMove={(delta) => move(stop.id, delta)}
                    onAddItem={() => setItemSheet({ mode: "add", stopId: stop.id, defaultDate: stop.arriveOn ?? "" })}
                    onEditItem={(item) => setItemSheet({ mode: "edit", item })}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        {ordered.length ? (
          <Button
            variant="outline"
            size="lg"
            className="h-12 w-full border-dashed"
            onClick={() => setStopSheet({ mode: "add", defaultArrive: lastDepart })}
          >
            <MapPinPlusIcon aria-hidden /> Add next stop
          </Button>
        ) : null}
      </section>

      <section className="space-y-3" aria-labelledby="whole-trip-heading">
        <div>
          <h2 id="whole-trip-heading" className="flex items-center gap-2 font-heading text-xl font-semibold">
            <GlobeIcon className="size-5 text-muted-foreground" aria-hidden /> Whole trip
          </h2>
          <p className="text-sm text-muted-foreground">Things not tied to one stop: insurance, visas, passes, gear.</p>
        </div>
        {tripItems.map((item) => (
          <ItemCard key={item.id} item={item} currency={currency} onEdit={() => setItemSheet({ mode: "edit", item })} />
        ))}
        <Button
          variant="ghost"
          className="h-11 w-full justify-start text-muted-foreground"
          onClick={() => setItemSheet({ mode: "add", stopId: null, defaultDate: "", category: "OTHER" })}
        >
          <PlusIcon aria-hidden /> Add to whole trip
        </Button>
      </section>

      <StopSheet tripId={tripId} state={stopSheet} onClose={() => setStopSheet(null)} />
      <ItemSheet tripId={tripId} currency={currency} stops={stopOptions} state={itemSheet} onClose={() => setItemSheet(null)} />
      <DeleteStopDialog stop={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}

function SortableStop({
  stop,
  index,
  total,
  currency,
  onEdit,
  onDelete,
  onMove,
  onAddItem,
  onEditItem,
}: {
  stop: BuilderStop;
  index: number;
  total: number;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
  onAddItem: () => void;
  onEditItem: (item: BuilderItem) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
  });
  const nights =
    stop.arriveOn && stop.departOn
      ? Math.round((parseDateOnly(stop.departOn).getTime() - parseDateOnly(stop.arriveOn).getTime()) / 86_400_000)
      : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-3xl border bg-card/60 p-3 sm:p-4", isDragging && "relative z-20 shadow-xl ring-2 ring-primary/40")}
    >
      <div className="flex items-center gap-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${stop.name}`}
          className="grid h-11 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground hover:bg-accent active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-5" aria-hidden />
        </button>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground">
          {index + 1}
        </span>
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 rounded-md text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <h3 className="truncate font-heading text-lg font-semibold">
            {stop.countryCode ? <span className="mr-1.5 font-sans">{flagEmoji(stop.countryCode)}</span> : null}
            {stop.name}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {formatDateRange(
              stop.arriveOn ? parseDateOnly(stop.arriveOn) : null,
              stop.departOn ? parseDateOnly(stop.departOn) : null,
            ) ?? "Add dates"}
            {nights !== null && nights > 0 ? ` · ${plural(nights, "night")}` : ""}
          </p>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`More options for ${stop.name}`}>
              <MoreVerticalIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <PencilIcon /> Edit stop
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onMove(-1)} disabled={index === 0}>
              <ArrowUpIcon /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onMove(1)} disabled={index === total - 1}>
              <ArrowDownIcon /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2Icon /> Delete stop
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {stop.notes ? <p className="mt-2 ml-9 text-sm whitespace-pre-line text-muted-foreground sm:ml-[4.5rem]">{stop.notes}</p> : null}

      <div className="mt-3 space-y-2 sm:ml-[4.5rem]">
        {stop.items.map((item) => (
          <ItemCard key={item.id} item={item} currency={currency} onEdit={() => onEditItem(item)} />
        ))}
        <Button variant="ghost" className="h-11 w-full justify-start text-muted-foreground" onClick={onAddItem}>
          <PlusIcon aria-hidden /> Add flight, stay, transport or activity
        </Button>
      </div>
    </li>
  );
}

function DeleteStopDialog({ stop, onClose }: { stop: BuilderStop | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const count = stop?.items.length ?? 0;

  const run = (keepItems: boolean) =>
    startTransition(async () => {
      if (!stop) return;
      const result = await deleteStop(stop.id, keepItems);
      if (result.ok) {
        toast.success(`${stop.name} removed`);
        onClose();
      } else toast.error("Couldn't delete the stop");
    });

  return (
    <AlertDialog open={stop !== null} onOpenChange={(o) => !o && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {stop?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {count
              ? `It has ${plural(count, "item")}. You can delete them too, or keep them under “Whole trip”.`
              : "This stop has nothing in it."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button variant="destructive" className="h-11 w-full" disabled={pending} onClick={() => run(false)}>
            {count ? `Delete stop and ${plural(count, "item")}` : "Delete stop"}
          </Button>
          {count ? (
            <Button variant="outline" className="h-11 w-full" disabled={pending} onClick={() => run(true)}>
              Delete stop, keep its items
            </Button>
          ) : null}
          <AlertDialogCancel className="h-11 w-full" disabled={pending}>
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
