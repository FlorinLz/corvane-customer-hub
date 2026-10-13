import { z } from "zod";

// Brief 3.8.2 "Set group" / "Unlink entity". M5 R1 scope links a
// currently standalone (or group-not-set) entity only; moving an already
// grouped entity (confirmMove, M4 AC4) is R2.
export const linkEntitySchema = z.object({
  groupId: z.string().min(1),
  version: z.number().int(),
});

export const unlinkEntitySchema = z.object({
  version: z.number().int(),
});

export type LinkEntityInput = z.infer<typeof linkEntitySchema>;
