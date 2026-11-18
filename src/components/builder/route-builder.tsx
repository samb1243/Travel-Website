"use client";

import { CategoryFilter, FilteredOutNote } from "@/components/builder/category-tile";
import { countByGroup, inGroups, type ItemGroup } from "@/lib/item-categories";
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
import { formatDateRange, plural } from "@/lib/format";
import { parseDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { deleteStop, reorderStops } from "@/server/actions/builder";
import type { BuilderItem, BuilderStop } from "@/server/trips";
import { ItemCard } from "./item-card";
import { EmailImport } from "@/components/builder/email-import";
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
  // Show only some kinds of item (getting around, stays...). Empty = everything.
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const groupCounts = countByGroup([...stops.flatMap((s) => s.items), ...tripItems]);
  const visibleTripItems = tripItems.filter((i) => inGroups(i.category, groups));
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
          <h2 id="route-heading" className="font-heading text-xl font-extrabold">
            Route
          </h2>
          <div className="flex items-center gap-3">
            {ordered.length ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">{plural(ordered.length, "stop")}</span>
            ) : null}
            <EmailImport tripId={tripId} currency={currency} stops={stopOptions} />
          </div>
        </div>
        {ordered.length ? <CategoryFilter selected={groups} onChange={setGroups} counts={groupCounts} /> : null}

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
              <ol className="space-y-6">
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
                    groups={groups}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        {ordered.length ? (
          <button
            type="button"
            onClick={() => setStopSheet({ mode: "add", defaultArrive: lastDepart })}
            className="group/add grid w-full grid-cols-[2.75rem_1fr] items-center gap-x-3 rounded-2xl text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="grid size-11 place-items-center rounded-full border-4 border-dashed border-foreground/35 bg-background text-muted-foreground transition-colors group-hover/add:border-foreground group-hover/add:text-foreground">
              <PlusIcon className="size-5" aria-hidden />
            </span>
            <span className="font-bold text-muted-foreground group-hover/add:text-foreground">Add next stop</span>
          </button>
        ) : null}
      </section>

      <section className="space-y-3" aria-labelledby="whole-trip-heading">
        <div>
          <h2 id="whole-trip-heading" className="flex items-center gap-2 font-heading text-xl font-extrabold">
            <GlobeIcon className="size-5 text-muted-foreground" aria-hidden /> Whole trip
          </h2>
          <p className="text-sm text-muted-foreground">Things not tied to one stop: insurance, visas, passes, gear.</p>
        </div>
        {groups.length && tripItems.length && !visibleTripItems.length ? <FilteredOutNote groups={groups} /> : null}
        {visibleTripItems.map((item) => (
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
  groups,
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
  /** Kinds of item to show; empty = all */
  groups: ItemGroup[];
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
      className={cn(
        "relative grid grid-cols-[2.75rem_1fr] gap-x-3",
        isDragging && "z-20 rounded-2xl bg-background ring-2 ring-ring/40",
      )}
    >
      {/* The trail line: solid to the next stop, dashed after the last one (towards "Add next stop") */}
      <span
        aria-hidden
        className={cn(
          "absolute top-11 -bottom-6 left-[calc(1.375rem-3px)] w-1.5",
          index === total - 1
            ? "bg-[repeating-linear-gradient(to_bottom,var(--trail)_0_6px,transparent_6px_12px)]"
            : "bg-trail",
          isDragging && "hidden",
        )}
      />
      <span
        className="relative grid size-11 place-items-center rounded-full border-4 border-foreground bg-trail font-heading text-base font-black text-trail-foreground"
        aria-hidden
      >
        {index + 1}
      </span>
      <div className="min-w-0">
        <div className="flex min-h-11 items-center gap-1">
          <button type="button" onClick={onEdit} className="min-w-0 flex-1 rounded-md text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <h3 className="truncate font-heading text-xl leading-tight font-extrabold">
              <span className="sr-only">Stop {index + 1}: </span>
              {stop.name}
            </h3>
            <p className="truncate text-sm text-muted-foreground">
              {formatDateRange(
                stop.arriveOn ? parseDateOnly(stop.arriveOn) : null,
                stop.departOn ? parseDateOnly(stop.departOn) : null,
              ) ?? "Add dates"}
              {nights !== null && nights > 0 ? `, ${plural(nights, "night")}` : ""}
            </p>
          </button>
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Drag to reorder ${stop.name}`}
            className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground hover:bg-accent active:cursor-grabbing"
          >
            <GripVerticalIcon className="size-5" aria-hidden />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 shrink-0 rounded-lg" aria-label={`More options for ${stop.name}`}>
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

        {stop.notes ? <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{stop.notes}</p> : null}

        <div className="mt-3 space-y-2">
          {groups.length && !stop.items.some((i) => inGroups(i.category, groups)) ? <FilteredOutNote groups={groups} /> : null}
          {stop.items.filter((i) => inGroups(i.category, groups)).map((item) => (
            <ItemCard key={item.id} item={item} currency={currency} onEdit={() => onEditItem(item)} />
          ))}
          <Button variant="ghost" className="h-11 w-full justify-start rounded-xl font-semibold text-muted-foreground" onClick={onAddItem}>
            <PlusIcon aria-hidden /> Add flight, stay, transport or activity
          </Button>
        </div>
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
