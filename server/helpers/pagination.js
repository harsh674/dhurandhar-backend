exports.parsePagination = (q) => {
  const page = Math.max(1, parseInt(q.page || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(q.limit || "20", 10)));
  return { page, limit, skip: (page - 1) * limit };
};

exports.parseSort = (sortStr, fallback = "-createdAt") => sortStr || fallback;
