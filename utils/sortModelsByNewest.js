const toTime = (value) => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
};

/**
 * Newest model first, by the `created_at` GET /api/service/:service returns on
 * each model config. The backend already orders each group newest-first, but
 * groups come in a fixed order (chat, fine-tune, reasoning…), so a new
 * reasoning model would otherwise sit below every chat model.
 *
 * The sort is stable: rows without a date keep their catalogue order, so a
 * backend that does not send `created_at` leaves the list unchanged.
 */
const sortModelsByNewest = (rows, getCreatedAt = (row) => row?.createdAt) =>
  [...rows].sort((a, b) => toTime(getCreatedAt(b)) - toTime(getCreatedAt(a)));

export default sortModelsByNewest;
