import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";

const HEADS = "heads";
const TAILS = "tails";
const CLAIM_COINS_AMOUNT = 1000;

function computeNextCoins({ currentCoins, side }) {
  if (side === HEADS) {
    return Math.floor(currentCoins * 1.8);
  }
  return Math.floor(currentCoins * 0.5);
}

async function getEntertainmentCoinStateForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      entertainmentCoins: true,
      entertainmentHeadsCount: true,
      entertainmentTailsCount: true,
    },
  });
  if (!user) {
    throw new AppError({
      message: "Không tìm thấy người dùng.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  return {
    coins: user.entertainmentCoins,
    headsCount: user.entertainmentHeadsCount,
    tailsCount: user.entertainmentTailsCount,
  };
}

async function flipEntertainmentCoinForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      entertainmentCoins: true,
      entertainmentHeadsCount: true,
      entertainmentTailsCount: true,
    },
  });
  if (!user) {
    throw new AppError({
      message: "Không tìm thấy người dùng.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  const side = Math.random() < 0.5 ? HEADS : TAILS;
  const beforeCoins = user.entertainmentCoins;
  const afterCoins = computeNextCoins({ currentCoins: beforeCoins, side });

  const nextHeads = user.entertainmentHeadsCount + (side === HEADS ? 1 : 0);
  const nextTails = user.entertainmentTailsCount + (side === TAILS ? 1 : 0);

  await prisma.user.update({
    where: { id: userId },
    data: {
      entertainmentCoins: afterCoins,
      entertainmentHeadsCount: nextHeads,
      entertainmentTailsCount: nextTails,
    },
  });

  return {
    side,
    beforeCoins,
    afterCoins,
    headsCount: nextHeads,
    tailsCount: nextTails,
    ratio: side === HEADS ? 1.8 : 0.5,
  };
}

async function claimEntertainmentCoinsForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      entertainmentHeadsCount: true,
      entertainmentTailsCount: true,
    },
  });
  if (!user) {
    throw new AppError({
      message: "Không tìm thấy người dùng.",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { entertainmentCoins: CLAIM_COINS_AMOUNT },
  });

  return {
    coins: CLAIM_COINS_AMOUNT,
    headsCount: user.entertainmentHeadsCount,
    tailsCount: user.entertainmentTailsCount,
  };
}

export {
  claimEntertainmentCoinsForUser,
  flipEntertainmentCoinForUser,
  getEntertainmentCoinStateForUser,
  HEADS,
  TAILS,
};
