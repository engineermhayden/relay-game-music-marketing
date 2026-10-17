import { z } from "zod";
export const greetingSchema = z.object({
  name: z.string().trim().min(1).max(60),
  message: z.string().trim().min(1).max(240),
  city: z.string().trim().min(1).max(80),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export const searchSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).default(39.7392),
  longitude: z.coerce.number().min(-180).max(180).default(-104.9903),
  radius: z.coerce.number().min(1).max(21000).default(21000),
  search: z.string().max(100).default(""),
});
export type Greeting = {
  id: string;
  name: string;
  message: string;
  city: string;
  latitude: number;
  longitude: number;
  distance: number;
  seeded: boolean;
  created_at: string;
};
