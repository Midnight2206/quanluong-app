import { z } from "zod";

export const userFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must have at least 2 characters."),
  email: z.email("Please enter a valid email address."),
  role: z.string().min(1, "Please select a role."),
  isActive: z.boolean().default(true),
});

export const userFormDefaultValues = {
  fullName: "",
  email: "",
  role: "",
  isActive: true,
};
