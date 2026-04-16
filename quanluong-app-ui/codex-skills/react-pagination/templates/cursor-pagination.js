import { useState } from "react";

export const useCursorPagination = ({
  initialCursor = null,
  initialItems = [],
} = {}) => {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const applyPage = ({ newItems, newNextCursor, newHasMore }) => {
    setItems(newItems);
    setNextCursor(newNextCursor ?? null);
    setHasMore(Boolean(newHasMore));
  };

  const advanceCursor = () => {
    setCursor(nextCursor);
  };

  return {
    items,
    cursor,
    nextCursor,
    hasMore,
    setCursor,
    setItems,
    applyPage,
    advanceCursor,
  };
};
