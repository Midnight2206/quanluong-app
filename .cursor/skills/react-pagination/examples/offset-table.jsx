import { useEffect } from "react";

import { useOffsetPagination } from "../templates/offset-pagination";

export const UsersTable = ({ fetchPage }) => {
  const {
    page,
    pageSize,
    totalPages,
    setTotal,
    goToNextPage,
    goToPreviousPage,
  } = useOffsetPagination({
    initialPage: 1,
    initialPageSize: 10,
  });

  useEffect(() => {
    const load = async () => {
      const response = await fetchPage({ page, pageSize });
      setTotal(response.total);
    };

    load();
  }, [fetchPage, page, pageSize, setTotal]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button disabled={page === 1} type="button" onClick={goToPreviousPage}>
          Previous
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          type="button"
          onClick={goToNextPage}
        >
          Next
        </button>
      </div>
    </div>
  );
};
