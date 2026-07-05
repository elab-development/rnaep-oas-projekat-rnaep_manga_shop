"use client";

import type {
  CreateMangaInput,
  JikanSuggestion,
  MangaView,
  UpdateMangaInput,
} from "@workspace/contracts";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useState } from "react";
import {
  createManga,
  ModerationError,
  updateManga,
} from "@/lib/moderation";
import { centsToEuros, eurosToCents } from "@/lib/money";
import { JikanSearch } from "@/components/jikan-search";

type Mode = "create" | "edit";

interface Fields {
  title: string;
  author: string;
  genres: string;
  cover: string;
  description: string;
  price: string;
  quantity: string;
}

type FieldErrors = Partial<Record<keyof Fields, string>>;

/**
 * Add/edit form for a Manga. In create mode it embeds the Jikan search
 * (ADR-0009) — picking a result prefills the fields, then the moderator sets
 * price and stock. In edit mode it patches data/price only; stock has its own
 * control and `jikanId` is never touched, so Jikan can't clobber edits.
 */
export function MangaForm({
  mode,
  initial,
  onSaved,
  onCancel,
}: {
  mode: Mode;
  initial?: MangaView;
  onSaved: (manga: MangaView) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<Fields>(() => fromInitial(initial));
  const [jikanId, setJikanId] = useState<number | undefined>(undefined);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set<K extends keyof Fields>(key: K, value: string): void {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function prefill(s: JikanSuggestion): void {
    setFields((prev) => ({
      ...prev,
      title: s.title,
      author: s.author,
      genres: s.genres.join(", "),
      cover: s.cover,
      description: s.description,
    }));
    setJikanId(s.jikanId);
    setErrors({});
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const { errors: found, price, quantity } = validate(mode, fields);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setPending(true);
    try {
      const genres = parseGenres(fields.genres);
      const saved =
        mode === "create"
          ? await createManga({
              title: fields.title.trim(),
              author: fields.author.trim(),
              genres,
              cover: fields.cover.trim(),
              description: fields.description.trim(),
              price: price!,
              quantity: quantity!,
              jikanId,
            } satisfies CreateMangaInput)
          : await updateManga(initial!.id, {
              title: fields.title.trim(),
              author: fields.author.trim(),
              genres,
              cover: fields.cover.trim(),
              description: fields.description.trim(),
              price: price!,
            } satisfies UpdateMangaInput);
      onSaved(saved);
    } catch (err) {
      setFormError(
        err instanceof ModerationError
          ? err.message
          : "Could not reach the shop.",
      );
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {mode === "create" && <JikanSearch onPick={prefill} />}

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field data-invalid={errors.title ? "true" : undefined}>
          <FieldLabel htmlFor="m-title">Title</FieldLabel>
          <Input
            id="m-title"
            value={fields.title}
            aria-invalid={!!errors.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Manga title"
          />
          <FieldError>{errors.title}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="m-author">Author</FieldLabel>
          <Input
            id="m-author"
            value={fields.author}
            onChange={(e) => set("author", e.target.value)}
            placeholder="Author"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="m-genres">Genres</FieldLabel>
          <Input
            id="m-genres"
            value={fields.genres}
            onChange={(e) => set("genres", e.target.value)}
            placeholder="Comma-separated, e.g. Action, Fantasy"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="m-cover">Cover URL</FieldLabel>
          <Input
            id="m-cover"
            type="url"
            value={fields.cover}
            onChange={(e) => set("cover", e.target.value)}
            placeholder="https://…"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="m-description">Description</FieldLabel>
          <textarea
            id="m-description"
            value={fields.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            placeholder="Synopsis"
            className="border-chip bg-background focus-visible:ring-ring/50 min-h-24 w-full resize-y px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field data-invalid={errors.price ? "true" : undefined}>
            <FieldLabel htmlFor="m-price">Price (EUR)</FieldLabel>
            <Input
              id="m-price"
              inputMode="decimal"
              value={fields.price}
              aria-invalid={!!errors.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="14.99"
            />
            <FieldError>{errors.price}</FieldError>
          </Field>

          {mode === "create" && (
            <Field data-invalid={errors.quantity ? "true" : undefined}>
              <FieldLabel htmlFor="m-quantity">Stock quantity</FieldLabel>
              <Input
                id="m-quantity"
                inputMode="numeric"
                value={fields.quantity}
                aria-invalid={!!errors.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                placeholder="0"
              />
              <FieldError>{errors.quantity}</FieldError>
            </Field>
          )}
        </div>

        {formError && (
          <p
            role="alert"
            className="border-destructive bg-destructive/10 text-destructive border-l-4 px-3 py-2 text-sm font-medium"
          >
            {formError}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="brutal-btn h-11 disabled:opacity-70"
          >
            {pending
              ? "Saving…"
              : mode === "create"
                ? "Add manga"
                : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onCancel}
            className="brutal-btn h-11"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

function fromInitial(initial?: MangaView): Fields {
  return {
    title: initial?.title ?? "",
    author: initial?.author ?? "",
    genres: initial?.genres.join(", ") ?? "",
    cover: initial?.cover ?? "",
    description: initial?.description ?? "",
    price: initial ? centsToEuros(initial.price) : "",
    quantity: initial ? String(initial.stock.quantity) : "",
  };
}

function parseGenres(raw: string): string[] {
  return raw
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

/** Client-side checks; the server re-validates every field (ADR-0012). */
function validate(
  mode: Mode,
  fields: Fields,
): { errors: FieldErrors; price?: number; quantity?: number } {
  const errors: FieldErrors = {};

  if (!fields.title.trim()) errors.title = "Title is required.";

  const price = eurosToCents(fields.price);
  if (price === null) errors.price = "Enter a price like 14.99.";

  let quantity: number | undefined;
  if (mode === "create") {
    const n = Number(fields.quantity.trim());
    if (!fields.quantity.trim() || !Number.isInteger(n) || n < 0) {
      errors.quantity = "Enter a whole number of copies.";
    } else {
      quantity = n;
    }
  }

  return { errors, price: price ?? undefined, quantity };
}
