"use client";

import { useEffect, useState } from "react";
import { getNetworkOnline, subscribeNetworkStatus } from "../sync/networkStatus.js";

export function useNetworkStatus() {
  const [online, setOnline] = useState(getNetworkOnline);

  useEffect(() => subscribeNetworkStatus(setOnline), []);

  return { online };
}
