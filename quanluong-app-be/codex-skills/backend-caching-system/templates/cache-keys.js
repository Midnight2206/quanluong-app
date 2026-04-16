function buildUsersListKey({ page, limit, sort }) {
  return `users:list:page=${page}:limit=${limit}:sort=${sort}`;
}

function buildUserDetailKey(userId) {
  return `users:detail:id=${userId}`;
}

export { buildUsersListKey, buildUserDetailKey };
