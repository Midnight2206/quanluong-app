import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { config } from "../../config/config.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { logger } from "../../shared/utils/logger.js";

/**
 * Chuyển URL public (/media/avatars/...) → đường dẫn tuyệt đối an toàn dưới MEDIA_ROOT/avatars.
 */
function resolveAvatarDiskPath(publicUrl) {
  if (!publicUrl || typeof publicUrl !== "string") {
    return null;
  }
  const prefix = config.media.publicPath;
  if (!publicUrl.startsWith(`${prefix}/avatars/`)) {
    return null;
  }
  const rel = publicUrl.slice(prefix.length + 1);
  const full = path.resolve(path.join(config.media.root, rel));
  const avatarsRoot = path.resolve(path.join(config.media.root, "avatars"));
  if (!full.startsWith(avatarsRoot + path.sep) && full !== avatarsRoot) {
    return null;
  }
  return full;
}

async function tryUnlinkPublicAvatar(publicUrl) {
  const disk = resolveAvatarDiskPath(publicUrl);
  if (!disk) {
    return;
  }
  try {
    await fs.unlink(disk);
  } catch (e) {
    if (e?.code !== "ENOENT") {
      logger.warn({ err: e, disk }, "Không xóa được file avatar cũ");
    }
  }
}

/**
 * Gán avatarUrl mới; xóa file cũ nếu thuộc thư mục avatars của hệ thống.
 */
async function setOwnAvatarPublicUrl(userId, publicUrl) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      profile: { select: { avatarUrl: true } },
    },
  });

  if (!user) {
    throw new AppError({
      message: "Không tìm thấy tài khoản.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  const oldUrl = user.profile?.avatarUrl ?? null;

  await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      fullName: user.username || "User",
      avatarUrl: publicUrl,
    },
    update: {
      avatarUrl: publicUrl,
    },
  });

  if (oldUrl && oldUrl !== publicUrl) {
    await tryUnlinkPublicAvatar(oldUrl);
  }

  return { publicUrl };
}

async function removeOwnAvatar(userId) {
  const row = await prisma.profile.findUnique({
    where: { userId },
    select: { avatarUrl: true },
  });
  const url = row?.avatarUrl;
  if (!url) {
    return { removed: false };
  }

  await prisma.profile.update({
    where: { userId },
    data: { avatarUrl: null },
  });

  await tryUnlinkPublicAvatar(url);
  return { removed: true };
}

export { removeOwnAvatar, resolveAvatarDiskPath, setOwnAvatarPublicUrl, tryUnlinkPublicAvatar };
