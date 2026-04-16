import { useEffect } from "react";

import { useCursorPagination } from "../templates/cursor-pagination";

export const ActivityFeed = ({ fetchPage }) => {
  const { items, cursor, hasMore, applyPage, advanceCursor } =
    useCursorPagination();

  useEffect(() => {
    const load = async () => {
      const response = await fetchPage({ cursor, limit: 20 });

      applyPage({
        newItems: response.items,
        newNextCursor: response.nextCursor,
        newHasMore: response.hasMore,
      });
    };

    load();
  }, [applyPage, cursor, fetchPage]);

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>

      {hasMore ? (
        <button type="button" onClick={advanceCursor}>
          Load more
        </button>
      ) : null}
    </div>
  );
};
