import { useMemo, useState } from "react";

export const useOffsetPagination = ({
  initialPage = 1,
  initialPageSize = 10,
  initialTotal = 0,
} = {}) => {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(initialTotal);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / pageSize));
  }, [pageSize, total]);

  const offset = useMemo(() => {
    return (page - 1) * pageSize;
  }, [page, pageSize]);

  const goToNextPage = () => {
    setPage((currentPage) => Math.min(currentPage + 1, totalPages));
  };

  const goToPreviousPage = () => {
    setPage((currentPage) => Math.max(currentPage - 1, 1));
  };

  const resetToFirstPage = () => {
    setPage(1);
  };

  return {
    page,
    pageSize,
    total,
    totalPages,
    offset,
    setPage,
    setPageSize,
    setTotal,
    goToNextPage,
    goToPreviousPage,
    resetToFirstPage,
  };
};
