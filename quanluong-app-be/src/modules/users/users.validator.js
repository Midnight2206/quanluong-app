import { z } from "zod";

const userProfileSchema = z.object({
  fullName: z.string().min(1),
  birthday: z.coerce.date().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  jobTitle: z.string().max(255).optional().nullable(),
  rank: z.string().max(255).optional().nullable(),
  phoneNumber: z.string().max(30).optional().nullable(),
  address: z.string().max(2000).optional().nullable(),
});

const createUserBodySchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  typeId: z.number().int().positive(),
  unitId: z.number().int().positive().optional().nullable(),
  assignedUnitId: z.number().int().positive().optional().nullable(),
  jobTitleId: z.number().int().positive().optional().nullable(),
  profile: userProfileSchema,
});

const patchUserBodySchema = createUserBodySchema
  .omit({
    password: true,
  })
  .partial()
  .extend({
    password: z.string().min(8).optional(),
    profile: userProfileSchema.partial().optional(),
  });

const replaceUserBodySchema = createUserBodySchema;

const userParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export { createUserBodySchema, patchUserBodySchema, replaceUserBodySchema, userParamsSchema };
