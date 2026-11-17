"use client";

import { useState, useTransition } from "react";
import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteTrip } from "@/server/actions/trips";

export function DeleteTripButton({ tripId, title }: { tripId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-12 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto">
          <Trash2Icon aria-hidden /> Delete trip
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the trip with all its stops, bookings and links. It can&apos;t be undone.
            Copies other people made of this trip are not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep trip</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault(); // keep the dialog open while deleting
              startTransition(() => deleteTrip(tripId));
            }}
          >
            {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : null}
            Delete for good
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
