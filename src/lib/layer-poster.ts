import { z } from "zod";

export const posterPlanSchema = z.object({
  concept: z.string().min(1).max(1200),
  style: z.string().min(1).max(1600),
  background: z.string().min(1).max(1600),
  ink: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  elements: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        prompt: z.string().min(1).max(1600),
        x: z.number().min(0).max(0.85),
        y: z.number().min(0.35).max(0.85),
        width: z.number().min(0.1).max(0.75),
      }),
    )
    .min(1)
    .max(3),
});
export type PosterPlan = z.infer<typeof posterPlanSchema>;

// The model must return coordinates, but older/nonconforming responses may omit them.
export const posterPlanResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "layer_poster_plan",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["concept", "style", "background", "ink", "elements"],
      properties: {
        concept: { type: "string" },
        style: { type: "string" },
        background: { type: "string" },
        ink: { type: "string" },
        elements: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "prompt", "x", "y", "width"],
            properties: {
              name: { type: "string" },
              prompt: { type: "string" },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
            },
          },
        },
      },
    },
  },
} as const;

export function parsePosterPlan(value: unknown): PosterPlan {
  if (!value || typeof value !== "object" || !("elements" in value))
    return posterPlanSchema.parse(value);
  if (!Array.isArray(value.elements)) return posterPlanSchema.parse(value);
  const defaults = [
    { x: 0.15, y: 0.35, width: 0.7 },
    { x: 0.05, y: 0.57, width: 0.35 },
    { x: 0.6, y: 0.56, width: 0.32 },
  ];
  const finite = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return posterPlanSchema.parse({
    ...value,
    elements: value.elements.map((element, index) => {
      if (!element || typeof element !== "object") return element;
      const fallback = defaults[index % defaults.length];
      const y = Math.min(0.8, Math.max(0.35, finite(element.y, fallback.y)));
      const width = Math.min(
        0.75,
        (0.87 - y) * 1.5,
        Math.max(0.1, finite(element.width, fallback.width)),
      );
      const x = Math.min(1 - width, Math.max(0, finite(element.x, fallback.x)));
      return { ...element, x: Math.min(0.85, x), y, width };
    }),
  });
}
export interface PosterContext {
  projectId: string;
  title: string;
  date: string;
  venue: string;
  brief: string;
  plan: PosterPlan;
  role: "background" | "element";
  name: string;
}
