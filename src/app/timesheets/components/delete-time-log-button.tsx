"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteOwnTimeLog } from "@/app/actions/time";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type DeleteTimeLogButtonProps = {
  timeLogId: string;
  label: string;
};

export function DeleteTimeLogButton({ timeLogId, label }: DeleteTimeLogButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteOwnTimeLog(timeLogId);
      if (result.success) {
        setIsOpen(false);
      } else {
        alert(result.error);
      }
    } catch {
      alert("Failed to delete time log.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="destructive-subtle"
            size="icon-xs"
            onClick={() => setIsOpen(true)}
            aria-label={`Delete ${label}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Delete time log</TooltipContent>
      </Tooltip>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => !isDeleting && setIsOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-red-500/20 bg-card p-6 text-card-foreground shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-3">
                <div className="rounded-full bg-red-500/10 p-2 text-red-500">
                  <Trash2 className="size-5" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Delete time log?</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete <strong className="text-foreground">{label}</strong>?
              </p>
              <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                This permanently deletes the time log from your timesheets and admin records.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete time log"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
