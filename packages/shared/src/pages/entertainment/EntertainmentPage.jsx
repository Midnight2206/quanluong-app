"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  useCurrentUser,
  useIsAuthenticated,
} from "@/features/auth/model/authSlice";
import {
  useClaimEntertainmentCoinMutation,
  useFlipEntertainmentCoinMutation,
} from "@/features/auth/api/authApi";
import { apiRequest } from "@/services/apiRequest";
import { notifyError } from "@/services/notify";

const GUEST_COINS_KEY = "entertainment_guest_coins_v1";
const GUEST_FLIP_STATS_KEY = "entertainment_guest_flip_stats_v1";
const GUEST_DEFAULT_COINS = 100;
const USER_DEFAULT_COINS = 1000;

const GAME_TABS = [{ key: "coin", label: "Tung dong xu", icon: "🪙" }];

export function EntertainmentPage() {
  const user = useCurrentUser();
  const isAuthenticated = useIsAuthenticated();
  const [flipCoin, { isLoading: flipping }] =
    useFlipEntertainmentCoinMutation();
  const [claimCoins, { isLoading: claiming }] = useClaimEntertainmentCoinMutation();
  const [activeTab] = useState("coin");
  const [coins, setCoins] = useState(null);
  const [flipStats, setFlipStats] = useState({ headsCount: 0, tailsCount: 0 });
  const [coinSide, setCoinSide] = useState("heads");
  const [flipResult, setFlipResult] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const loadedStateRef = useRef(null);

  const coinTransform = useMemo(() => {
    if (isAnimating) {
      return "rotateY(1260deg)";
    }
    return coinSide === "heads" ? "rotateY(0deg)" : "rotateY(180deg)";
  }, [coinSide, isAnimating]);

  const flipRatio = useMemo(() => {
    const total = flipStats.headsCount + flipStats.tailsCount;
    if (total <= 0) {
      return { total: 0, headsPercent: 0, tailsPercent: 0 };
    }
    return {
      total,
      headsPercent: Math.round((flipStats.headsCount / total) * 100),
      tailsPercent: Math.round((flipStats.tailsCount / total) * 100),
    };
  }, [flipStats]);

  useEffect(() => {
    const key = isAuthenticated ? `user:${user?.id ?? "unknown"}` : "guest";
    if (loadedStateRef.current === key) {
      return;
    }
    loadedStateRef.current = key;

    let cancelled = false;
    async function loadCoins() {
      if (isAuthenticated) {
        if (!user?.id) {
          return;
        }
        try {
          const data = await apiRequest({
            url: "/auth/entertainment/coin-state",
            method: "get",
          });
          if (!cancelled) {
            setCoins(data?.coins ?? USER_DEFAULT_COINS);
            setFlipStats({
              headsCount: data?.headsCount ?? 0,
              tailsCount: data?.tailsCount ?? 0,
            });
          }
        } catch {
          if (!cancelled) {
            notifyError("Khong tai duoc so xu tai khoan.");
          }
        }
        return;
      }
      const raw = localStorage.getItem(GUEST_COINS_KEY);
      const rawStats = localStorage.getItem(GUEST_FLIP_STATS_KEY);
      let nextStats = { headsCount: 0, tailsCount: 0 };
      if (rawStats) {
        try {
          const parsedStats = JSON.parse(rawStats);
          nextStats = {
            headsCount: Number.isFinite(parsedStats?.headsCount)
              ? parsedStats.headsCount
              : 0,
            tailsCount: Number.isFinite(parsedStats?.tailsCount)
              ? parsedStats.tailsCount
              : 0,
          };
        } catch {
          nextStats = { headsCount: 0, tailsCount: 0 };
        }
      }
      localStorage.setItem(GUEST_FLIP_STATS_KEY, JSON.stringify(nextStats));
      if (!raw) {
        localStorage.setItem(GUEST_COINS_KEY, String(GUEST_DEFAULT_COINS));
        if (!cancelled) {
          setCoins(GUEST_DEFAULT_COINS);
          setFlipStats(nextStats);
        }
        return;
      }
      const parsed = Number.parseInt(raw, 10);
      const next =
        Number.isFinite(parsed) && parsed >= 0 ? parsed : GUEST_DEFAULT_COINS;
      localStorage.setItem(GUEST_COINS_KEY, String(next));
      if (!cancelled) {
        setCoins(next);
        setFlipStats(nextStats);
      }
    }
    void loadCoins();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  async function handleFlip() {
    if (coins == null || isAnimating || flipping) {
      return;
    }
    setIsAnimating(true);
    setFlipResult(null);

    if (isAuthenticated) {
      try {
        const result = await flipCoin().unwrap();
        setTimeout(() => {
          setCoinSide(result?.side === "tails" ? "tails" : "heads");
          setCoins(result?.afterCoins ?? coins);
          setFlipStats({
            headsCount: result?.headsCount ?? 0,
            tailsCount: result?.tailsCount ?? 0,
          });
          setFlipResult(result);
          setIsAnimating(false);
        }, 1000);
      } catch {
        setIsAnimating(false);
        notifyError("Khong tung duoc dong xu, vui long thu lai.");
      }
      return;
    }

    const side = Math.random() < 0.5 ? "heads" : "tails";
    const beforeCoins = coins;
    const afterCoins =
      side === "heads"
        ? Math.floor(beforeCoins * 1.8)
        : Math.floor(beforeCoins * 0.5);
    const nextStats = {
      headsCount: flipStats.headsCount + (side === "heads" ? 1 : 0),
      tailsCount: flipStats.tailsCount + (side === "tails" ? 1 : 0),
    };
    setTimeout(() => {
      setCoinSide(side);
      setCoins(afterCoins);
      setFlipStats(nextStats);
      localStorage.setItem(GUEST_COINS_KEY, String(afterCoins));
      localStorage.setItem(GUEST_FLIP_STATS_KEY, JSON.stringify(nextStats));
      setFlipResult({
        side,
        beforeCoins,
        afterCoins,
        headsCount: nextStats.headsCount,
        tailsCount: nextStats.tailsCount,
        ratio: side === "heads" ? 1.8 : 0.5,
      });
      setIsAnimating(false);
    }, 1000);
  }

  async function handleClaimCoins() {
    if (!isAuthenticated || claiming) {
      return;
    }
    try {
      const result = await claimCoins().unwrap();
      setCoins(result?.coins ?? USER_DEFAULT_COINS);
      setFlipStats({
        headsCount: result?.headsCount ?? flipStats.headsCount,
        tailsCount: result?.tailsCount ?? flipStats.tailsCount,
      });
      setFlipResult(null);
    } catch {
      notifyError("Không lấy được 1000 xu, vui lòng thử lại.");
    }
  }

  return (
    <div className="space-y-6 pb-4">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Giai tri</h1>
      </section>

      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-2">
            {GAME_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium"
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {activeTab === "coin" ? (
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Game 1: Tung dong xu</h2>
                <p className="text-sm text-muted-foreground">
                  Ket qua ngau nhien 50:50. Mat ngua +80% xu, mat sap -50% xu.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-2 text-sm">
                <span className="text-muted-foreground">So xu hien tai: </span>
                <span className="font-semibold text-foreground">
                  {coins ?? "..."}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({isAuthenticated ? "Tai khoan" : "Khach"})
                </span>
              </div>
            </div>
            {isAuthenticated ? (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClaimCoins}
                  disabled={claiming}
                >
                  {claiming ? "Dang lay xu..." : "Lay xu (1000)"}
                </Button>
              </div>
            ) : null}

            <div className="flex flex-col items-center gap-4">
              <div className="[perspective:1000px]">
                <div
                  className="relative h-40 w-40 transition-transform duration-1000 [transform-style:preserve-3d]"
                  style={{ transform: coinTransform }}
                >
                  <div className="absolute inset-0 [backface-visibility:hidden]">
                    <Image
                      src="/images/coin-heads.svg"
                      alt="Dong xu mat ngua"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <Image
                      src="/images/coin-tails.svg"
                      alt="Dong xu mat sap"
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleFlip}
                disabled={coins == null || isAnimating || flipping}
              >
                {isAnimating || flipping ? "Đang tung..." : "Tung đồng xu"}
              </Button>

              {flipResult ? (
                <p className="text-sm text-muted-foreground">
                  Kết quả:{" "}
                  <span className="font-semibold text-foreground">
                    {flipResult.side === "heads" ? "Mặt ngửa" : "Mặt sấp"}
                  </span>{" "}
                  | Truoc: {flipResult.beforeCoins} xu | Sau:{" "}
                  <span className="font-semibold text-foreground">
                    {flipResult.afterCoins} xu
                  </span>
                </p>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground">
              Tổng số lần: Mặt ngửa {flipStats.headsCount} | Mặt sấp{" "}
              {flipStats.tailsCount}
            </p>
            <p className="text-xs text-muted-foreground">
              Tỉ lệ hiện tại: Mặt ngửa {flipRatio.headsPercent}% | Mặt sấp{" "}
              {flipRatio.tailsPercent}% (tổng {flipRatio.total} lần)
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
