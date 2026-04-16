function mapMealRosterEntry(row) {
  return {
    id: row.id,
    unitId: row.unitId,
    yearMonth: row.yearMonth,
    fullName: row.fullName,
    rank: row.rank,
    mealAllowanceRateId: row.mealAllowanceRateId,
    mealAllowanceRate: row.mealAllowanceRate
      ? {
          id: row.mealAllowanceRate.id,
          doiTuong: row.mealAllowanceRate.doiTuong,
          mucTienAn: row.mealAllowanceRate.mucTienAn,
          type: row.mealAllowanceRate.type,
        }
      : null,
    unitDisplay: row.unitDisplay,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  };
}

export { mapMealRosterEntry };
