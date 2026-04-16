import { z } from "zod";

const loginBodySchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8),
});

const registerBodySchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  unitId: z.coerce.number().int().positive(),
});

const requestVerificationEmailPublicBodySchema = z.object({
  email: z.string().email(),
});

const forgotPasswordBodySchema = z.object({
  email: z.string().email(),
});

const resetPasswordBodySchema = z
  .object({
    token: z.string().min(16),
    newPassword: z.string().min(8),
    confirmNewPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmNewPassword"],
  });

const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmNewPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmNewPassword"],
  });

/** Crop theo pixel trên ảnh gốc (multipart field `crop` JSON). */
const avatarPixelCropSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const meProfilePatchSchema = z
  .object({
    fullName: z.string().min(1).max(255).optional(),
    phoneNumber: z.string().max(30).optional().nullable(),
    address: z.string().max(2000).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    jobTitle: z.string().max(255).optional().nullable(),
    rank: z.string().max(255).optional().nullable(),
    birthday: z.union([z.coerce.date(), z.null()]).optional(),
  })
  .refine((data) => Object.keys(data).some((key) => data[key] !== undefined), {
    message: "Cần ít nhất một trường để cập nhật.",
  });

const avatarJobParamsSchema = z.object({
  jobId: z.string().min(1).max(80),
});

export {
  avatarJobParamsSchema,
  avatarPixelCropSchema,
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  meProfilePatchSchema,
  registerBodySchema,
  requestVerificationEmailPublicBodySchema,
  resetPasswordBodySchema,
};
