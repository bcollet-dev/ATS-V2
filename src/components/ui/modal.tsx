"use client";

import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function Modal({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog.Root>
  );
}

function ModalContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
          "data-open:animate-in data-open:fade-in-0",
          "data-closed:animate-out data-closed:fade-out-0",
          "duration-200"
        )}
      />
      <Dialog.Popup
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-lg bg-background shadow-xl flex flex-col max-h-[90vh]",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          "duration-200",
          className
        )}
      >
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

function ModalHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-between border-b px-6 py-4 shrink-0", className)}
      {...props}
    />
  );
}

function ModalTitle({ className, ...props }: React.ComponentProps<typeof Dialog.Title>) {
  return (
    <Dialog.Title className={cn("text-base font-semibold", className)} {...props} />
  );
}

function ModalClose({ className }: { className?: string }) {
  return (
    <Dialog.Close
      className={cn(
        "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className
      )}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Fermer</span>
    </Dialog.Close>
  );
}

function ModalBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("overflow-y-auto px-6 py-5 space-y-4", className)} {...props} />
  );
}

function ModalFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 border-t px-6 py-4 shrink-0", className)}
      {...props}
    />
  );
}

export { Modal, ModalContent, ModalHeader, ModalTitle, ModalClose, ModalBody, ModalFooter };
