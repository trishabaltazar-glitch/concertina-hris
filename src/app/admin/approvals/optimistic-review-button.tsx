"use client";

import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type ReviewStatus = "APPROVED" | "REJECTED";

type OptimisticReviewButtonProps = {
  status: ReviewStatus;
  onReview: (status: ReviewStatus) => Promise<{ success: boolean; error?: string }>;
};

export function OptimisticReviewButton({ status, onReview }: OptimisticReviewButtonProps) {
  const [isPending, startTransition] = React.useTransition();
  const Icon = status === "APPROVED" ? CheckCircle2 : XCircle;

  return (
    <Button
      type="button"
      variant={status === "APPROVED" ? "success" : "destructive-outline"}
      size="sm"
      className="h-8 gap-1.5"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await onReview(status);
        });
      }}
    >
      <Icon className="size-3.5" />
      {status === "APPROVED" ? "Approve" : "Reject"}
    </Button>
  );
}
