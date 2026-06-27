"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCursus } from "@/app/(app)/cursus/actions";
import { createCursusSchema, type CreateCursusInput } from "@/app/(app)/cursus/schemas";

interface CursusDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CursusDrawer({ open, onOpenChange }: CursusDrawerProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCursusInput>({
    resolver: zodResolver(createCursusSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
    },
  });

  function onSubmit(data: CreateCursusInput) {
    startTransition(async () => {
      const result = await createCursus(data);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Cursus « ${result.data.name} » créé`);
      reset();
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nouveau cursus</SheetTitle>
          <SheetClose />
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <SheetBody>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom du cursus</Label>
              <Input id="name" {...register("name")} autoFocus placeholder="ex : Bachelor RH" />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">
                Code <span className="text-muted-foreground text-xs">(optionnel)</span>
              </Label>
              <Input id="code" {...register("code")} placeholder="ex : BACH-RH" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Description <span className="text-muted-foreground text-xs">(optionnel)</span>
              </Label>
              <Textarea
                id="description"
                {...register("description")}
                rows={3}
                placeholder="Présentation courte du cursus…"
                className="resize-none"
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onOpenChange(false); }}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Création…" : "Créer le cursus"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
