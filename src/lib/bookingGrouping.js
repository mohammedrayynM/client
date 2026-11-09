/**
 * Group continuous bookings for the Owner Panel UI.
 * 
 * Grouping conditions:
 * - Same customer (customer_name + optional customer_phone)
 * - Same venue (turf_id)
 * - Same court (court_id)
 * - Same booking_date
 * - Same status & payment context (status, payment_status, payment_type, need_players)
 * - Slots are continuously connected (e.g. 18:00-19:00, 19:00-20:00 -> 18:00-20:00)
 */

export function parseSlotTimeRange(slotStr) {
  if (!slotStr) return null;
  const parts = String(slotStr).split('-');
  if (parts.length !== 2) return null;

  const parseTimeStr = (str) => {
    let s = str.trim();
    const isPm = /pm/i.test(s);
    const isAm = /am/i.test(s);
    const hasAmpm = isPm || isAm;
    
    s = s.replace(/am|pm/i, '').trim();
    const [hStr, mStr] = s.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr || '0', 10);
    if (isNaN(h) || isNaN(m)) return null;

    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;

    return {
      totalMins: h * 60 + m,
      hasAmpm,
      rawText: str.trim()
    };
  };

  const start = parseTimeStr(parts[0]);
  const end = parseTimeStr(parts[1]);
  if (!start || !end) return null;

  let endMins = end.totalMins;
  if (endMins <= start.totalMins && endMins === 0) {
    endMins = 24 * 60; // midnight 00:00
  }

  return {
    startMins: start.totalMins,
    endMins,
    startText: parts[0].trim(),
    endText: parts[1].trim(),
    hasAmpm: start.hasAmpm || end.hasAmpm
  };
}

export function groupContinuousBookings(bookings = []) {
  if (!Array.isArray(bookings) || bookings.length === 0) return [];

  // 1. Group bookings by matching context key
  const bucketMap = new Map();

  bookings.forEach((b) => {
    const custKey = String(b.customer_name || b.customer_phone || b.user_id || 'guest').trim().toLowerCase();
    const turfKey = String(b.turf_id || b.turf_name || '').trim();
    const courtKey = String(b.court_id || b.court_name || 'default').trim();
    const dateKey = String(b.booking_date || '').slice(0, 10);
    const statusKey = `${b.status}_${b.payment_status}_${b.payment_type}_${b.need_players}`;

    const key = `${custKey}__${turfKey}__${courtKey}__${dateKey}__${statusKey}`;

    if (!bucketMap.has(key)) {
      bucketMap.set(key, []);
    }
    bucketMap.get(key).push(b);
  });

  const finalGroupedList = [];

  // 2. Within each bucket, sort by slot start time and merge continuous slots
  bucketMap.forEach((bucketItems) => {
    // Parse time for each booking
    const itemsWithTime = bucketItems.map((item) => {
      const parsed = parseSlotTimeRange(item.time_slot);
      return {
        booking: item,
        parsed
      };
    });

    // Separate items with valid parsed time from unparseable items
    const validItems = itemsWithTime.filter((it) => it.parsed !== null);
    const invalidItems = itemsWithTime.filter((it) => it.parsed === null);

    // Push unparseable items as-is
    invalidItems.forEach((it) => finalGroupedList.push(it.booking));

    if (validItems.length === 0) return;

    // Sort valid items chronologically
    validItems.sort((a, b) => a.parsed.startMins - b.parsed.startMins);

    // Merge continuous segments
    let currentGroup = [validItems[0]];

    for (let i = 1; i < validItems.length; i++) {
      const prev = currentGroup[currentGroup.length - 1];
      const curr = validItems[i];

      // Check if curr start time matches prev end time (strictly continuous, no gap)
      if (curr.parsed.startMins === prev.parsed.endMins) {
        currentGroup.push(curr);
      } else {
        // Gap exists: output currentGroup and start new group
        finalGroupedList.push(mergeGroupedBookingSegment(currentGroup));
        currentGroup = [curr];
      }
    }

    if (currentGroup.length > 0) {
      finalGroupedList.push(mergeGroupedBookingSegment(currentGroup));
    }
  });

  // Sort overall grouped list by booking date descending or original order
  return finalGroupedList.sort((a, b) => {
    const dateA = new Date(a.booking_date || 0).getTime();
    const dateB = new Date(b.booking_date || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return (b.id || 0) - (a.id || 0);
  });
}

function mergeGroupedBookingSegment(segmentItems) {
  if (segmentItems.length === 1) {
    return {
      ...segmentItems[0].booking,
      isGrouped: false,
      slotCount: 1,
      groupedIds: [segmentItems[0].booking.id],
      displayBookingId: `#${segmentItems[0].booking.id}`
    };
  }

  const first = segmentItems[0];
  const last = segmentItems[segmentItems.length - 1];
  const baseBooking = first.booking;

  // Format combined time slot string (e.g. 18:00 - 22:00 or 06:00 PM - 10:00 PM)
  const startTimeText = first.parsed.startText;
  const endTimeText = last.parsed.endText;
  const combinedTimeSlot = `${startTimeText} - ${endTimeText}`;

  // Sum financial totals
  let totalSlotValue = 0;
  let totalDiscount = 0;
  let totalAdvancePaid = 0;
  let totalPendingBal = 0;
  let totalPlayersCollected = 0;
  let totalNetAmount = 0;

  const ids = [];

  segmentItems.forEach(({ booking }) => {
    ids.push(booking.id);
    totalSlotValue += parseFloat(booking.original_price || booking.amount || 0);
    totalDiscount += parseFloat(booking.discount_amount || 0);
    totalAdvancePaid += parseFloat(booking.advance_amount || booking.amount || 0);
    totalPendingBal += parseFloat(booking.pending_balance || 0);
    totalPlayersCollected += parseFloat(booking.players_collected || 0);
    totalNetAmount += parseFloat(booking.netAmount || 0);
  });

  const displayBookingId = ids.length > 1 ? `#${ids[0]} - #${ids[ids.length - 1]}` : `#${ids[0]}`;

  return {
    ...baseBooking,
    id: ids[0], // primary reference ID
    isGrouped: true,
    slotCount: segmentItems.length,
    groupedIds: ids,
    displayBookingId,
    time_slot: combinedTimeSlot,
    original_price: totalSlotValue,
    amount: totalSlotValue,
    discount_amount: totalDiscount,
    advance_amount: totalAdvancePaid,
    pending_balance: totalPendingBal,
    players_collected: totalPlayersCollected,
    netAmount: totalNetAmount
  };
}
