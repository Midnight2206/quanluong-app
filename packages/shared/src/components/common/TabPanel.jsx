import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePersistedNavTabSelection } from "@/hooks/usePersistedNavTab";
import { cn } from "@/utils/cn";

/**
 * @param {{ id: string, label: string, panel: React.ReactNode, badge?: React.ReactNode }[]} tabs
 * @param {string} [defaultTabId]
 * @param {string} [persistId] — nếu có, lưu `sessionStorage` tại khóa `quanluong:navTab:${persistId}`
 * @param {string} [className] — outer wrapper; với `scrollablePanel` bật: thường thêm `min-h-0 flex-1` khi nằm trong flex column.
 * @param {boolean} [scrollablePanel=false] — chỉ bật cho dialog/workspace có chiều cao giới hạn.
 * @param {boolean} [stickyTabList] — neo thanh tab ở đỉnh khung cuộn gần nhất khi cuộn xuống.
 * @param {boolean} [fullBleedInCard] — dùng khi `CardContent` có `p-0`: thanh tab kéo sát mép card; panel có padding ngang/dưới.
 * @param {boolean} [equalWidthTabs] — các nút tab chia đều chiều ngang (`flex-1`).
 * @param {number} [stickyTabListLevel=0] — tầng sticky; tầng sau tự neo dưới tổng chiều cao các tầng trước.
 * @param {boolean} [scrollableTabList] — thanh tab cuộn ngang (nhiều tab trên mobile).
 * @param {string} [forcedActiveTabId] — nếu thuộc `tabs`, ép tab hiển thị (vd. đồng bộ segment URL); khi `undefined` dùng state nội bộ.
 * @param {(id: string) => void} [onTabSelect] — gọi sau khi đổi tab (điều hướng / side-effect ngoài).
 */
export function TabPanel({
  tabs,
  defaultTabId,
  persistId,
  className,
  scrollablePanel = false,
  stickyTabList = false,
  stickyTabListLevel = 0,
  fullBleedInCard = false,
  equalWidthTabs = false,
  scrollableTabList = false,
  forcedActiveTabId,
  onTabSelect,
}) {
  const baseId = useId();
  const tabListRef = useRef(null);
  const [tabFade, setTabFade] = useState({ left: false, right: false });
  const firstId = tabs[0]?.id;
  const validIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  const [activeId, setActiveId] = usePersistedNavTabSelection(
    persistId ? persistId : null,
    validIds,
    defaultTabId ?? firstId,
  );

  if (!tabs.length) {
    return null;
  }

  const safeActive = (() => {
    if (forcedActiveTabId && validIds.includes(forcedActiveTabId)) {
      return forcedActiveTabId;
    }
    return tabs.some((t) => t.id === activeId) && activeId ? activeId : firstId;
  })();
  const activeTab = tabs.find((t) => t.id === safeActive) ?? tabs[0];

  function handleSelectTab(id) {
    setActiveId(id);
    onTabSelect?.(id);
  }

  useEffect(() => {
    if (!scrollableTabList) {
      return undefined;
    }
    const el = tabListRef.current;
    if (!el) {
      return undefined;
    }
    const updateFade = () => {
      setTabFade({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    };
    updateFade();
    el.addEventListener("scroll", updateFade, { passive: true });
    window.addEventListener("resize", updateFade);
    return () => {
      el.removeEventListener("scroll", updateFade);
      window.removeEventListener("resize", updateFade);
    };
  }, [scrollableTabList, tabs]);

  return (
    <div
      className={cn(
        "flex min-w-0 w-full flex-col",
        fullBleedInCard ? "gap-0" : "gap-2",
        scrollablePanel && "min-h-0 flex-1 overflow-hidden",
        className,
      )}
    >
      <div
        data-sticky-level={stickyTabList ? stickyTabListLevel : undefined}
        className={cn(
          "relative shrink-0",
          scrollableTabList && "min-w-0",
          stickyTabList && "unified-sticky-surface",
        )}
      >
        {scrollableTabList && tabFade.left ? (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-30 w-6 bg-gradient-to-r from-background to-transparent"
            aria-hidden
          />
        ) : null}
        {scrollableTabList && tabFade.right ? (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-30 w-8 bg-gradient-to-l from-background to-transparent"
            aria-hidden
          />
        ) : null}
        <div
          ref={tabListRef}
          role="tablist"
          aria-orientation="horizontal"
          className={cn(
            "flex shrink-0 gap-0.5 border-b border-border pb-px",
            scrollableTabList
              ? "overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
              : null,
            scrollableTabList ? "flex-nowrap items-stretch" : equalWidthTabs ? "w-full flex-nowrap sm:flex-wrap" : "flex-wrap items-center",
            !scrollableTabList && equalWidthTabs ? "items-stretch" : null,
            !stickyTabList && fullBleedInCard ? "rounded-t-xl px-4 pt-4 sm:px-5 sm:pt-5" : null,
            !stickyTabList && !fullBleedInCard ? "bg-background/80 backdrop-blur-sm" : null,
            stickyTabList && fullBleedInCard ? "rounded-t-xl px-4 pt-3 sm:px-5 sm:pt-4" : null,
            stickyTabList && !fullBleedInCard ? "px-0 pt-0" : null,
          )}
        >
        {tabs.map((tab) => {
          const isActive = tab.id === safeActive;
          const tabId = `${baseId}-tab-${tab.id}`;
          const panelId = `${baseId}-panel-${tab.id}`;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleSelectTab(tab.id)}
              className={cn(
                "relative gap-1.5 rounded-t-md px-2.5 py-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm sm:gap-2 sm:px-3 sm:py-2.5",
                scrollableTabList ? "shrink-0 whitespace-nowrap" : null,
                equalWidthTabs && !scrollableTabList
                  ? "flex min-h-[2.75rem] min-w-0 flex-1 basis-0 flex-col items-center justify-center sm:min-h-0 sm:flex-row sm:flex-wrap sm:justify-center"
                  : scrollableTabList
                    ? "inline-flex min-h-[2.75rem] items-center px-3"
                    : "inline-flex max-w-full flex-wrap items-center",
                isActive
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/70 after:absolute after:inset-x-1 after:-bottom-px after:z-10 after:h-0.5 after:rounded-full after:bg-primary"
                  : "text-foreground/75 hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <span className={cn(equalWidthTabs ? "text-center leading-tight" : "shrink-0")}>{tab.label}</span>
              {tab.badge != null ? (
                <span className={cn("min-w-0", equalWidthTabs ? "flex justify-center" : "shrink")}>{tab.badge}</span>
              ) : null}
            </button>
          );
        })}
        </div>
      </div>
      <div
        role="tabpanel"
        data-local-scroll={scrollablePanel ? "true" : undefined}
        id={`${baseId}-panel-${activeTab.id}`}
        aria-labelledby={`${baseId}-tab-${activeTab.id}`}
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-col",
          scrollablePanel
            ? "flex-1 overflow-y-auto overflow-x-hidden overscroll-y-auto pr-0.5"
            : null,
          fullBleedInCard && "px-4 pb-5 pt-4 sm:px-5",
        )}
      >
        {activeTab.panel}
      </div>
    </div>
  );
}
