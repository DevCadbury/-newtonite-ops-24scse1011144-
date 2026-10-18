"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/components/ui/utils";

// shadcn form + UI
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

import type { WorkItemTypeValue, PriorityValue } from "@/lib/constants";
import { WorkItemTypes } from "@/lib/constants";

/* Priority option config ────────────────────────────────────────────────── */
const PRIORITY_OPTIONS: Array<{
  value: PriorityValue;
  label: string;
  description: string;
  className: string;
  dotClass: string;
}> = [
  {
    value: "LOW",
    label: "Low",
    description: "No rush",
    className: "border-slate-500/30 data-[state=checked]:border-slate-400 data-[state=checked]:bg-slate-500/10",
    dotClass: "bg-slate-400",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    description: "Normal pace",
    className: "border-blue-500/30 data-[state=checked]:border-blue-400 data-[state=checked]:bg-blue-500/10",
    dotClass: "bg-blue-400",
  },
  {
    value: "HIGH",
    label: "High",
    description: "Address soon",
    className: "border-amber-500/30 data-[state=checked]:border-amber-400 data-[state=checked]:bg-amber-500/10",
    dotClass: "bg-amber-400",
  },
  {
    value: "CRITICAL",
    label: "Critical",
    description: "Immediate action",
    className: "border-red-500/30 data-[state=checked]:border-red-400 data-[state=checked]:bg-red-500/10",
    dotClass: "bg-red-400",
  },
];

/* Type icon map ────────────────────────────────────────────────────────── */
const TYPE_ICONS: Record<WorkItemTypeValue, string> = {
  INCIDENT: "🚨",
  CUSTOMER_ISSUE: "👤",
  PAYMENT: "💳",
  COMPLIANCE: "📋",
  TASK: "✅",
};

/* Zod schema ────────────────────────────────────────────────────────────── */
const formSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(255, "Title must be under 255 characters"),
  description: z.string().max(5000, "Description must be under 5,000 characters").optional(),
  type: z.enum(["INCIDENT", "CUSTOMER_ISSUE", "PAYMENT", "COMPLIANCE", "TASK"] as const),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const),
  teamId: z.string().min(1, "Please select a team"),
  dueDate: z.date().optional(),
});

type FormValues = z.infer<typeof formSchema>;

/* UUID helper ─────────────────────────────────────────────────────────── */
function makeUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface Team { id: string; name: string; }
interface Props { teams: Team[]; userId: string; }

/* Form completion progress ────────────────────────────────────────────── */
function useFormProgress(values: Partial<FormValues>): number {
  const fields = [values.title, values.type, values.priority, values.teamId];
  const filled = fields.filter((f) => f && String(f).trim() !== "").length;
  return Math.round((filled / fields.length) * 100);
}

export default function NewItemForm({ teams, userId }: Props) {
  const router = useRouter();
  const [idempKey] = useState(makeUUID);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "TASK",
      priority: "MEDIUM",
      teamId: teams[0]?.id ?? "",
      dueDate: undefined,
    },
  });

  const watchedValues = form.watch();
  const progress = useFormProgress(watchedValues);
  const titleLength = (watchedValues.title ?? "").length;

  const onSubmit = async (values: FormValues) => {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempKey,
      },
      body: JSON.stringify({
        title: values.title,
        description: values.description || undefined,
        type: values.type,
        priority: values.priority,
        teamId: values.teamId,
        dueDate: values.dueDate?.toISOString() ?? undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to create item");
      return;
    }
    toast.success("Work item created");
    router.push(`/items/${data.id}`);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Form completion progress */}
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Form completeness</span>
              <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </CardContent>
        </Card>

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Basic Information</CardTitle>
            <CardDescription className="text-xs">
              Describe the work item clearly and concisely.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">
                    Title <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Brief, clear description of the issue or task"
                      className="text-sm bg-muted/20 border-border/50 focus:border-primary/50"
                    />
                  </FormControl>
                  <div className="flex items-center justify-between">
                    <FormMessage className="text-xs" />
                    <span
                      className={cn(
                        "text-[11px] ml-auto",
                        titleLength > 240
                          ? "text-destructive"
                          : titleLength > 200
                          ? "text-amber-400"
                          : "text-muted-foreground/50"
                      )}
                    >
                      {titleLength}/255
                    </span>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Additional context, steps to reproduce, expected behavior, or acceptance criteria…"
                      className="text-sm min-h-[100px] resize-none bg-muted/20 border-border/50 focus:border-primary/50"
                    />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    Optional — markdown formatting is not supported.
                  </FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ── Priority ──────────────────────────────────────────────────── */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Priority</CardTitle>
            <CardDescription className="text-xs">
              How urgently should this item be addressed?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                    >
                      {PRIORITY_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          htmlFor={`priority-${opt.value}`}
                          className={cn(
                            "flex flex-col gap-1 rounded-lg border-2 p-3 cursor-pointer transition-all",
                            "hover:bg-muted/30",
                            field.value === opt.value
                              ? opt.className.replace("data-[state=checked]:", "")
                              : "border-border/40"
                          )}
                        >
                          <RadioGroupItem
                            value={opt.value}
                            id={`priority-${opt.value}`}
                            className="sr-only"
                          />
                          <div className="flex items-center gap-1.5">
                            <div className={cn("size-2 rounded-full", opt.dotClass)} />
                            <span className="text-xs font-semibold">{opt.label}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{opt.description}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ── Classification & Assignment ─────────────────────────────── */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Classification</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">
                    Type <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-sm bg-muted/20 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WorkItemTypes.map((t) => (
                        <SelectItem key={t} value={t} className="text-sm">
                          <span className="flex items-center gap-2">
                            <span>{TYPE_ICONS[t]}</span>
                            <span>{t.replace(/_/g, " ")}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* Team */}
            <FormField
              control={form.control}
              name="teamId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">
                    Team <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-sm bg-muted/20 border-border/50">
                        <SelectValue placeholder="Select a team" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-sm">
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* Due Date — Calendar popover */}
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2">
                  <FormLabel className="text-xs font-medium">Due Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full h-9 justify-start text-left font-normal text-sm bg-muted/20 border-border/50",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 size-3.5 text-muted-foreground" />
                          {field.value ? (
                            <span>{format(field.value, "PPP")}</span>
                          ) : (
                            <span>Pick a date (optional)</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                      {field.value && (
                        <div className="border-t border-border p-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground h-7"
                            onClick={() => field.onChange(undefined)}
                          >
                            Clear date
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  <FormDescription className="text-[11px]">
                    Items past their due date will be flagged as overdue.
                  </FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* ── Validation summary ───────────────────────────────────────── */}
        {Object.keys(form.formState.errors).length > 0 && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">
              Please fix the errors above before submitting.
            </AlertDescription>
          </Alert>
        )}

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="gap-2"
          >
            {form.formState.isSubmitting ? (
              <><Loader2 className="size-3.5 animate-spin" />Creating…</>
            ) : (
              <><CheckCircle className="size-3.5" />Create Work Item</>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}

