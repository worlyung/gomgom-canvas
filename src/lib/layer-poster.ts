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
