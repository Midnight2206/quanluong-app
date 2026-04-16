import { z } from "zod";

const loginSchema = z.object({
  identifier: z.string().min(3, "Nhập ít nhất 3 ký tự"),
  password: z.string().min(8, "Mật khẩu ít nhất 8 ký tự"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Mật khẩu ít nhất 8 ký tự"),
    confirmNewPassword: z.string().min(8, "Nhập lại mật khẩu"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmNewPassword"],
  });

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại"),
    newPassword: z.string().min(8, "Mật khẩu mới ít nhất 8 ký tự"),
    confirmNewPassword: z.string().min(8, "Nhập lại mật khẩu mới"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmNewPassword"],
  });

const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Username ít nhất 3 ký tự")
    .max(50, "Username tối đa 50 ký tự"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu ít nhất 8 ký tự"),
  unitId: z
    .string()
    .min(1, "Chọn đơn vị")
    .transform((value) => Number(value))
    .pipe(z.number().int().positive("Chọn đơn vị")),
});

const meProfileFormSchema = z.object({
  fullName: z.string().min(1, "Nhập họ và tên"),
  phoneNumber: z.string().max(30).optional(),
  address: z.string().max(2000).optional(),
  description: z.string().max(2000).optional(),
  jobTitle: z.string().max(255).optional(),
  rank: z.string().max(255).optional(),
  birthday: z.string().optional(),
});

export {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  meProfileFormSchema,
  registerSchema,
  resetPasswordSchema,
};
