import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

async function updateOwnProfile(userId, patch) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, profile: { select: { id: true, fullName: true } } },
  });

  if (!user) {
    throw new AppError({
      message: "Không tìm thấy tài khoản.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  const data = { ...patch };

  const fullNameForCreate = (data.fullName ?? user.profile?.fullName ?? user.username) || "User";

  await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      fullName: fullNameForCreate,
      phoneNumber: data.phoneNumber ?? null,
      address: data.address ?? null,
      description: data.description ?? null,
      jobTitle: data.jobTitle ?? null,
      rank: data.rank ?? null,
      birthday: data.birthday ?? null,
    },
    update: {
      ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
      ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
      ...(data.rank !== undefined ? { rank: data.rank } : {}),
      ...(data.birthday !== undefined ? { birthday: data.birthday } : {}),
    },
  });

  return { ok: true };
}

export { updateOwnProfile };
