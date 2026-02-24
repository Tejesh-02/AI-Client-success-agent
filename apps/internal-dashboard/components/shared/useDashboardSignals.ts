"use client";

import { useEffect, useState } from "react";

type PayloadEvent<T> = Event & { detail?: T };

export const useDashboardSignals = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRangeDays, setDateRangeDays] = useState(7);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const onSearch = (event: Event) => {
      const next = ((event as PayloadEvent<{ query?: string }>).detail?.query ?? "").trim();
      setSearchQuery(next);
    };
    const onDateRange = (event: Event) => {
      const next = Number((event as PayloadEvent<{ days?: number }>).detail?.days ?? 7);
      if (Number.isFinite(next) && next > 0) setDateRangeDays(next);
    };
    const onLive = (event: Event) => {
      const next = Boolean((event as PayloadEvent<{ enabled?: boolean }>).detail?.enabled ?? true);
      setLiveEnabled(next);
    };
    const onRefresh = () => {
      setRefreshTick((value) => value + 1);
    };

    window.addEventListener("dashboard:global-search", onSearch as EventListener);
    window.addEventListener("dashboard:date-range", onDateRange as EventListener);
    window.addEventListener("dashboard:live-toggle", onLive as EventListener);
    window.addEventListener("dashboard:refresh", onRefresh);
    return () => {
      window.removeEventListener("dashboard:global-search", onSearch as EventListener);
      window.removeEventListener("dashboard:date-range", onDateRange as EventListener);
      window.removeEventListener("dashboard:live-toggle", onLive as EventListener);
      window.removeEventListener("dashboard:refresh", onRefresh);
    };
  }, []);

  return {
    searchQuery,
    dateRangeDays,
    liveEnabled,
    refreshTick
  };
};

