import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate as useRouter, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { API_BASE, apiGet, apiPost } from '@/lib/api';
import { getSportInfo, formatPrice, formatSlotTime, DEFAULT_TURF_IMAGES } from '@/lib/constants';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import BookingFindPlayersModal from '@/components/BookingFindPlayersModal';
import { setJsonLd, setPageMeta } from '@/lib/seo';

function parseTimeToMinutes(timeStr) {
  const [timePart, modifier = ''] = String(timeStr || '').trim().split(/\s+/);
  const [rawHours, rawMinutes = '0'] = timePart.split(':');
  let hours = parseInt(rawHours, 10);
  const minutes = parseInt(rawMinutes, 10) || 0;

  if (!Number.isFinite(hours)) return 0;
  // Special case: 24:00 = end-of-day = 1440 minutes
  if (hours === 24 && minutes === 0) return 1440;
  if (/PM/i.test(modifier) && hours !== 12) hours += 12;
  if (/AM/i.test(modifier) && hours === 12) hours = 0;

  return (hours % 24) * 60 + minutes;
}

function getSlotStartMinutes(slot) {
  const [start] = String(slot).split(' - ');
  return parseTimeToMinutes(start || slot);
}

const SLOT_SECTIONS = [
  { key: 'morning', label: 'Morning', range: '6 AM - 12 PM', start_time: '06:00', end_time: '12:00', defaultExpanded: true },
  { key: 'afternoon', label: 'Afternoon', range: '12 PM - 6 PM', start_time: '12:00', end_time: '18:00', defaultExpanded: true },
  { key: 'evening', label: 'Evening', range: '6 PM - 9 PM', start_time: '18:00', end_time: '21:00', defaultExpanded: true },
  { key: 'night', label: 'Night', range: '9 PM - 6 AM', start_time: '21:00', end_time: '06:00', defaultExpanded: true },
];

function isPricingEventRelevant(eventData, selectedDate) {
  if (!selectedDate) return false;
  if (eventData?.specificDate) {
    return String(eventData.specificDate).slice(0, 10) === selectedDate;
  }
  if (eventData?.dayOfWeek === undefined || eventData?.dayOfWeek === null) {
    return true;
  }
  return new Date(`${selectedDate}T00:00:00`).getDay() === Number(eventData.dayOfWeek);
}

function getSlotSection(slotTime, sections) {
  if (!sections || !Array.isArray(sections)) return 'evening-night';
  const start = getSlotStartMinutes(slotTime);
  
  // Find the first matching section
  for (const section of sections) {
    const sStart = parseTimeToMinutes(section.start_time);
    const sEnd = parseTimeToMinutes(section.end_time);
    
    // Handle wrap-around sessions (e.g. 8 PM to 6 AM)
    if (sStart > sEnd) {
      if (start >= sStart || start < sEnd) {
        // console.log(`Slot ${slotTime} (${start}m) matched wrap-around section ${section.label} (${sStart}-${sEnd}m)`);
        return section.key || String(section.id);
      }
    } else {
      if (start >= sStart && start < sEnd) {
        // console.log(`Slot ${slotTime} (${start}m) matched section ${section.label} (${sStart}-${sEnd}m)`);
        return section.key || String(section.id);
      }
    }
  }
  return 'evening-night';
}

function getSlotOrderInSection(slotTime, section) {
  const startMins = getSlotStartMinutes(slotTime);
  const sStart = parseTimeToMinutes(section.start_time);
  const sEnd = parseTimeToMinutes(section.end_time);

  if (sStart > sEnd) {
    if (startMins >= sStart) return startMins;
    return startMins + 24 * 60;
  }
  return startMins;
}

function formatContinuousSlots(slotsList) {
  if (!slotsList || slotsList.length === 0) return 'Select slots';

  const parsedSlots = slotsList.map(slot => {
    const [startStr, endStr] = slot.split(' - ');
    let start = parseTimeToMinutes(startStr);
    let end = parseTimeToMinutes(endStr);
    // Handle midnight boundary: if end is before or equal to start, it wraps to next day
    if (end <= start) end += 24 * 60;
    return {
      slot: slot,
      start,
      end,
      startStr: startStr.trim(),
      endStr: endStr ? endStr.trim() : startStr.trim()
    };
  });

  parsedSlots.sort((a, b) => a.start - b.start);

  const merged = [];
  let currentGroup = { ...parsedSlots[0] };

  for (let i = 1; i < parsedSlots.length; i++) {
    const slot = parsedSlots[i];
    if (slot.start === currentGroup.end) {
      currentGroup.end = slot.end;
      currentGroup.endStr = slot.endStr;
    } else {
      merged.push(currentGroup);
      currentGroup = { ...slot };
    }
  }
  merged.push(currentGroup);

  return merged.map(group => formatSlotTime(`${group.startStr} - ${group.endStr}`)).join(', ');
}


export default function TurfDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [searchParams] = useSearchParams();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const calendarInputRef = useRef(null);
  const pricingRequestId = useRef(0);
  const resumeBookingDraftRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [turf, setTurf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [slots, setSlots] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedSlotPrice, setSelectedSlotPrice] = useState(null);
  const [serviceFee, setServiceFee] = useState(20);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingData, setBookingData] = useState({ name: '', phone: '', email: '' });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [isGalleryHovered, setIsGalleryHovered] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Coupon state
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');

  useEffect(() => {
    const name = turf?.name || 'Turf Details';
    const city = turf?.location ? ` in ${turf.location}` : '';
    const heroImage = turf?.coverImage || turf?.images?.[0] || turf?.photos?.[0];
    setPageMeta({
      title: `${name}${city} — Book Arena`,
      description: turf
        ? (turf.description || `Book ${name}${city}. View photos, amenities, pricing, and available slots.`)
        : 'View turf details, photos, pricing, and available booking slots on Book Arena.',
      keywords: 'turf details, book turf, sports venue, book arena, slots, sports booking',
      canonicalUrl: turf?.id ? `https://bookarena.in/turfs/${turf.id}` : undefined,
      imageUrl: heroImage ? new URL(resolveMediaUrl(heroImage), window.location.origin).href : undefined
    });

    if (turf?.name) {
      const latitude = Number(turf.latitude);
      const longitude = Number(turf.longitude);
      const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
        && !(latitude === 0 && longitude === 0);
      const imageUrl = heroImage ? new URL(resolveMediaUrl(heroImage), window.location.origin).href : undefined;
      setJsonLd({
        id: `turf-${turf.id || params.id}`,
        data: {
          '@context': 'https://schema.org',
          '@type': 'SportsActivityLocation',
          name: turf.name,
          description: turf.description || undefined,
          image: imageUrl,
          address: turf.address || turf.location || turf.city || undefined,
          url: turf?.id ? `https://bookarena.in/turfs/${turf.id}` : 'https://bookarena.in/turfs',
          geo: hasCoordinates ? {
            '@type': 'GeoCoordinates',
            latitude,
            longitude
          } : undefined
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turf?.id, turf?.name, turf?.location, turf?.address, turf?.latitude, turf?.longitude]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponSuccess, setCouponSuccess] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponShake, setCouponShake] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const [paymentType, setPaymentType] = useState('advance'); // 'advance' or 'full'
  const paymentTypeBeforeMatch = useRef('advance');

  // Court / slot-settings state (populated from API)
  const [selectedCourt, setSelectedCourt] = useState(null); // court object or null
  const [slotDuration, setSlotDuration] = useState(60);
  const [advancePercent, setAdvancePercent] = useState(100);
  const [markupType, setMarkupType] = useState('fixed');
  const [markupValue, setMarkupValue] = useState(0);
  const [activeSection, setActiveSection] = useState('');

  // Integrated social matchmaking states
  const [needPlayersToggle, setNeedPlayersToggle] = useState(false);
  const [matchData, setMatchData] = useState({
    players_needed: 4,
    contribution_amount: 200,
    sport_type: 'Cricket',
    match_type: 'friendly',
    skill_level: 'all',
    contact_phone: '',
    note: ''
  });
  const [contributionManuallySet, setContributionManuallySet] = useState(false);
  // Pricing breakdown must be declared BEFORE any hook dependencies use it,
  // otherwise React will throw "Cannot access 'pricingBreakdown' before initialization".
  const [pricingBreakdown, setPricingBreakdown] = useState(null);
  const [showFindPlayersModal, setShowFindPlayersModal] = useState(false);
  const [matchRequest, setMatchRequest] = useState(null); // { id, share_token, shareUrl }
  const [matchRequestSummary, setMatchRequestSummary] = useState(null); // { match, contribution_total }

  function computeAutoContribution(discountedPrice, playersNeeded) {
    // Use the price AFTER coupon discount (not raw basePrice) so the split is fair
    const price = Math.max(0, Number(discountedPrice || 0));
    const needed = Math.max(1, Number(playersNeeded || 1));
    const totalPeople = needed + 1; // include host
    const perPerson = price > 0 ? Math.round(price / totalPeople) : 0;
    return perPerson;
  }

  function applyPaymentOptionToBreakdown(breakdown, option) {
    if (!breakdown) return breakdown;
    // Find Players on: the backend says there is no advance — the host pays their whole share now, friends pay theirs via the invite link
    if (breakdown.advanceDisabled) {
      return { ...breakdown, paymentType: 'full', advanceAmount: Number(breakdown.finalAmount || 0), pendingBalance: 0 };
    }

    const resolvedAdvancePercent = Number.parseInt(
      breakdown.advancePercent ?? advancePercent ?? 100,
      10
    );
    const finalAmount = Number(breakdown.finalAmount || 0);
    const nextPaymentType = resolvedAdvancePercent === 100
      ? 'full'
      : (String(option || breakdown.paymentType || paymentType).toLowerCase() === 'full' ? 'full' : 'advance');
    const advanceAmount = nextPaymentType === 'advance'
      ? Math.round((finalAmount * (resolvedAdvancePercent / 100)) * 100) / 100
      : finalAmount;
    const pendingBalance = nextPaymentType === 'advance'
      ? Math.round((finalAmount - advanceAmount) * 100) / 100
      : 0;

    return {
      ...breakdown,
      advancePercent: resolvedAdvancePercent,
      paymentType: nextPaymentType,
      advanceAmount,
      pendingBalance
    };
  }

  function handlePaymentTypeChange(nextPaymentType) {
    setPaymentType(nextPaymentType);
    setPricingBreakdown(prev => applyPaymentOptionToBreakdown(prev, nextPaymentType));
  }

  // The per-player share is worked out by the backend from the FINAL (post-coupon) amount; the page only displays it.
  useEffect(() => {
    if (!needPlayersToggle) return;
    const per = Number(pricingBreakdown?.contributionAmount);
    if (!Number.isFinite(per)) return;
    if (Number(matchData.contribution_amount || 0) !== per) setMatchData(prev => ({ ...prev, contribution_amount: per }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needPlayersToggle, pricingBreakdown?.contributionAmount]);

  const SPORT_OPTIONS = [
    'Cricket',
    'Football',
    'Badminton',
    'Tennis',
    'Basketball',
    'Volleyball',
    'Box Cricket',
    'Hockey',
    'Swimming',
    'Other'
  ];
  
  // Subscription plans state
  const [subPlans, setSubPlans] = useState([]);
  const [subLoading, setSubLoading] = useState(false);

  // Generate next 14 days for date selector (fixing UTC off-by-one bug)
  const availableDates = [...Array(14)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    
    // Get local date parts
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const date = d.getDate();
    const month = String(monthIndex + 1).padStart(2, '0');
    const day = String(date).padStart(2, '0');
    const full = `${year}-${month}-${day}`;

    return {
      full: full,
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date,
      month: d.toLocaleDateString('en-US', { month: 'short' })
    };
  });

  const selectedDateIndex = availableDates.findIndex((dateItem) => dateItem.full === selectedDate);
  const maxVisibleDateStart = Math.max(availableDates.length - 3, 0);
  const visibleDateStart = selectedDateIndex > -1
    ? Math.min(Math.max(selectedDateIndex - 1, 0), maxVisibleDateStart)
    : 0;
  const displayedDates = availableDates.slice(visibleDateStart, visibleDateStart + 3);

  const handleDateSelection = (date) => {
    if (!date || !availableDates.some((item) => item.full === date)) return;
    setSelectedDate(date);
  };

  const openCalendarPicker = () => {
    const input = calendarInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.click();
  };

  const activeImagesList = selectedCourt?.images?.length 
    ? selectedCourt.images 
    : ((turf?.photos && turf.photos.length > 0) 
        ? turf.photos 
        : (turf?.images && turf.images.length > 0 ? turf.images : DEFAULT_TURF_IMAGES));

  const images = (turf?.photos && turf.photos.length > 0)
    ? turf.photos
    : (turf?.images && turf.images.length > 0 ? turf.images : DEFAULT_TURF_IMAGES);
  const courts = Array.isArray(turf?.courts) ? turf.courts : [];
  const currentBookable = selectedCourt || turf || {};
  const currentSport = getSportInfo(currentBookable?.sport_type || turf?.sport_type);
  const currentPrice = parseFloat(currentBookable?.price_per_hour || turf?.price_per_hour || 0);
  const headerMarkup = (() => {
    const value = Number(markupValue) || 0;
    if (value <= 0) return { displayPrice: currentPrice, markupAmount: 0 };
    if (markupType === 'percentage') {
      const markupAmount = (currentPrice * value) / 100;
      return { displayPrice: currentPrice + markupAmount, markupAmount };
    }
    return { displayPrice: currentPrice + value, markupAmount: value };
  })();
  const currentImages = activeImagesList;
  
  // Merge amenities - show venue amenities + court specific ones
  const venueAmenities = Array.isArray(turf?.amenities) ? turf.amenities : [];
  const courtAmenities = selectedCourt && Array.isArray(selectedCourt.amenities) ? selectedCourt.amenities : [];
  const combinedAmenities = [...new Set([...venueAmenities, ...courtAmenities])];

  const groupedSlots = SLOT_SECTIONS.reduce((acc, section) => {
    acc[section.key] = slots
      .filter(slot => getSlotSection(slot.time, SLOT_SECTIONS) === section.key)
      .sort((a, b) => getSlotOrderInSection(a.time, section) - getSlotOrderInSection(b.time, section));
    return acc;
  }, {});
  const availableSections = SLOT_SECTIONS.filter(section => (groupedSlots[section.key] || []).length > 0);
  const activeSectionKey = availableSections.some(section => section.key === activeSection)
    ? activeSection
    : (availableSections[0]?.key || '');
  const activeSectionMeta = availableSections.find(section => section.key === activeSectionKey) || null;
  const activeSectionSlots = activeSectionMeta ? (groupedSlots[activeSectionMeta.key] || []) : [];

  useEffect(() => {
    if (activeSectionKey !== activeSection) {
      setActiveSection(activeSectionKey);
    }
  }, [activeSectionKey, activeSection]);

  // Premium Gallery auto carousel effect with hover-pause control
  useEffect(() => {
    if (!turf || activeImagesList.length <= 1) return;
    
    const interval = setInterval(() => {
      if (isGalleryHovered || Date.now() < resumeTime) {
        return;
      }
      setActiveImage(prev => (prev + 1) % activeImagesList.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [turf, activeImagesList, isGalleryHovered, resumeTime]);

  useEffect(() => {
    setActiveImage(0);
  }, [selectedCourt]);

  useEffect(() => {
    let es;

    const handleLiveUpdate = async (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');

        if (payload.turfId != null && Number(payload.turfId) !== Number(turf?.id || params.id)) {
          return;
        }

        if (payload.courtId != null && Number(payload.courtId) !== Number(selectedCourt?.id)) {
          return;
        }

        if ((event.type === 'slot_blocked' || event.type === 'slot_unblocked') && payload.date !== selectedDate) {
          return;
        }

        if ((event.type === 'slot_pricing_updated' || event.type === 'slot_pricing_deleted') && !isPricingEventRelevant(payload, selectedDate)) {
          return;
        }

        await loadSlots({ preserveSelection: true, silent: true });
      } catch (err) {
        console.error('Live slot refresh failed:', err);
      }
    };

    try {
      es = new EventSource(`${API_BASE}/turfs/events`);
      es.addEventListener('slot_blocked', handleLiveUpdate);
      es.addEventListener('slot_unblocked', handleLiveUpdate);
      es.addEventListener('slot_pricing_updated', handleLiveUpdate);
      es.addEventListener('slot_pricing_deleted', handleLiveUpdate);
    } catch (err) {
      console.error('Live slot stream failed:', err);
    }

    return () => {
      try { es?.close(); } catch {}
    };
  }, [
    turf?.id,
    selectedCourt?.id,
    selectedDate,
    selectedSlots,
    appliedCoupon?.code,
    needPlayersToggle,
    matchData.players_needed,
    matchData.contribution_amount,
    paymentType,
    matchRequest?.id
  ]);

  // Load available coupons and subscription plans when turf loads
  useEffect(() => {
    if (turf && turf.id) {
      loadAvailableCoupons();

      // Load subscription plans
      setSubLoading(true);
      apiGet(`/subscriptions/turf/${turf.id}`)
        .then(res => setSubPlans(res.plans || []))
        .catch(err => console.error(err))
        .finally(() => setSubLoading(false));
    }
  }, [turf]);

  async function loadAvailableCoupons() {
    try {
      const data = await apiGet(`/coupons/turf/${turf.id}`);
      setAvailableCoupons(data.coupons || []);
    } catch (err) {
      console.error('Failed to load coupons:', err);
      setAvailableCoupons([]);
    }
  }

  async function calculatePricing(
    currentSlots,
    currentCoupon,
    needPlayers = needPlayersToggle,
    playersNeeded = matchData.players_needed,
    contribution = matchData.contribution_amount,
    paymentOptionOverride
  ) {
    if (!currentSlots || currentSlots.length === 0 || !selectedDate) return;
    const requestId = pricingRequestId.current + 1;
    pricingRequestId.current = requestId;
    try {
      const data = await apiPost('/bookings/calculate-price', {
        turf_id: Number(turf?.id || params.id),
        court_id: selectedCourt ? selectedCourt.id : undefined,
        booking_date: selectedDate,
        time_slots: currentSlots,
        coupon_code: currentCoupon || undefined,
        payment_option: needPlayers ? 'full' : (paymentOptionOverride || paymentType),
        user_id: currentUser?.id || undefined,
        email: currentUser?.email || bookingData?.email || undefined,
        phone: currentUser?.phone || bookingData?.phone || undefined,
        match_request_id: matchRequest?.id || undefined,
        need_players: needPlayers,
        players_needed: Number(playersNeeded || 0),
        contribution_amount: Number(contribution || 0)
      });
      const normalizedData = applyPaymentOptionToBreakdown(data, paymentOptionOverride || data.paymentType);
      if (requestId !== pricingRequestId.current) return undefined;
      setPricingBreakdown(normalizedData);
      setDiscountAmount(normalizedData.discountAmount);
      setServiceFee(normalizedData.serviceFee);
      if (normalizedData.advancePercent !== undefined) setAdvancePercent(normalizedData.advancePercent);
      return normalizedData;
    } catch (err) {
      if (requestId !== pricingRequestId.current) return undefined;
      console.error('Pricing calculation failed:', err);
    }
  }

  async function handleApplyCoupon(codeOverride) {
    const code = (codeOverride || couponCode).trim();
    if (!code) return;
    if (selectedSlots.length === 0) {
      setCouponError('Please select a time slot first');
      triggerCouponShake();
      return;
    }

    setCouponLoading(true);
    setCouponError('');
    if (codeOverride) setCouponCode(codeOverride);

    try {
      const breakdown = await calculatePricing(
        selectedSlots,
        code,
        needPlayersToggle,
        matchData.players_needed,
        matchData.contribution_amount
      );

      if (breakdown && breakdown.coupon) {
        setAppliedCoupon(breakdown.coupon);
        setCouponError('');
        const saved = Number(breakdown.discountAmount || 0).toFixed(0);
        setCouponSuccess(`Coupon applied — you save ₹${saved}!`);
        triggerCelebration();
      } else {
        setCouponError('Invalid coupon code');
        setAppliedCoupon(null);
        triggerCouponShake();
      }
    } catch (err) {
      setCouponError(err.message || 'Invalid coupon code');
      setAppliedCoupon(null);
      triggerCouponShake();
    } finally {
      setCouponLoading(false);
    }
  }

  function triggerCouponShake() {
    setCouponShake(true);
    setTimeout(() => setCouponShake(false), 600);
  }

  function triggerCelebration() {
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 2800);
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    setCouponSuccess('');
    setShowCelebration(false);
    calculatePricing(selectedSlots, null, needPlayersToggle, matchData.players_needed, matchData.contribution_amount);
  }

  // Live updates for player count + contribution offset while on checkout
  useEffect(() => {
    if (!matchRequest?.id) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const data = await apiGet(`/match-requests/${matchRequest.id}/summary`);
        if (cancelled) return;
        setMatchRequestSummary(data);
        // Recalculate so host payable updates as players join & pay
        if (selectedSlots.length > 0) {
          calculatePricing(selectedSlots, appliedCoupon?.code || null);
        }
      } catch {
        // ignore
      }
    };

    refresh();
    const id = setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchRequest?.id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('userData');
      if (localStorage.getItem('userToken') && raw) {
        const user = JSON.parse(raw);
        setCurrentUser(user);
        setBookingData({ name: user.name || '', phone: user.phone || '', email: user.email || '' });
      }
    } catch {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setTurf(null);
    setSelectedCourt(null);
    setSelectedSlots([]);
    setSlots([]);
    setActiveSection('');
    setShowBookingForm(false);
    setPricingBreakdown(null);
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    setCouponSuccess('');
    setDiscountAmount(0);
    setMatchRequest(null);
    setMatchRequestSummary(null);
    loadTurf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (!params.id || !selectedDate) return;
    const draft = resumeBookingDraftRef.current;
    const shouldPreserve = draft &&
      draft.selectedDate === selectedDate &&
      Number(draft.courtId || 0) === Number(selectedCourt?.id || 0);
    if (shouldPreserve) resumeBookingDraftRef.current = null;
    loadSlots({ preserveSelection: Boolean(shouldPreserve) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, selectedDate, selectedCourt?.id]);

  useEffect(() => {
    if (!turf?.id || searchParams.get('resumeBooking') !== '1') return;
    try {
      const raw = sessionStorage.getItem(`turf-booking:${turf.id}`);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.selectedSlots) || !saved.selectedDate) return;
      const restoredCourt = turf.courts?.find((court) => Number(court.id) === Number(saved.courtId)) || null;
      const draft = {
        selectedDate: saved.selectedDate,
        selectedSlots: saved.selectedSlots.filter((slot) => typeof slot === 'string'),
        courtId: restoredCourt?.id || null
      };
      resumeBookingDraftRef.current = draft;
      setSelectedDate(draft.selectedDate);
      setSelectedSlots(draft.selectedSlots);
      setSelectedCourt(restoredCourt);
      setShowBookingForm(draft.selectedSlots.length > 0);
      sessionStorage.removeItem(`turf-booking:${turf.id}`);
    } catch (err) {
      console.error('Could not restore the turf booking selection:', err);
      sessionStorage.removeItem(`turf-booking:${turf.id}`);
    }
  }, [turf?.id, searchParams]);

  async function openFindPlayersModal() {
    if (selectedSlots.length === 0) return;
    if (!pricingBreakdown) {
      await calculatePricing(selectedSlots, appliedCoupon?.code || null);
    }
    setShowFindPlayersModal(true);
  }

  async function loadTurf() {
    try {
      const data = await apiGet(`/turfs/${params.id}`);
      setTurf(data.turf);
      setSelectedCourt(null); // Default to main turf-level settings
    } catch (err) {
      console.error(err);
      setTurf(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadSlots(options = {}) {
    const { preserveSelection = false, silent = false } = options;
    if (!silent) setSlotsLoading(true);

    let nextSelectedSlots = selectedSlots;
    if (!preserveSelection) {
      nextSelectedSlots = [];
      setSelectedSlots([]);
      setShowBookingForm(false);
      setPricingBreakdown(null);
      setAppliedCoupon(null);
      setCouponCode('');
      setCouponError('');
      setCouponSuccess('');
      setDiscountAmount(0);
    }

    try {
      const courtParam = selectedCourt ? `&court_id=${selectedCourt.id}` : '';
      const data = await apiGet(`/turfs/${params.id}/slots?date=${selectedDate}${courtParam}`);
      const nextSlots = data.slots || [];
      console.log(`Loaded ${nextSlots.length} slots for turf ${params.id}`);
      setSlots(nextSlots);

      if (preserveSelection) {
        nextSelectedSlots = selectedSlots.filter(slotTime =>
          nextSlots.some(slot => slot.time === slotTime && slot.status === 'available')
        );
        if (nextSelectedSlots.length !== selectedSlots.length) {
          setSelectedSlots(nextSelectedSlots);
        }

        if (nextSelectedSlots.length > 0) {
          setShowBookingForm(true);
          await calculatePricing(
            nextSelectedSlots,
            appliedCoupon?.code || null,
            needPlayersToggle,
            matchData.players_needed,
            matchData.contribution_amount,
            paymentType
          );
        } else if (selectedSlots.length > 0) {
          setShowBookingForm(false);
          setPricingBreakdown(null);
        }
      }

      if (data.serviceFeeValue !== undefined) setServiceFee(data.serviceFeeValue);
      if (data.slotDuration) setSlotDuration(data.slotDuration);
      if (data.advancePercent !== undefined) setAdvancePercent(data.advancePercent);
      if (data.markupType) setMarkupType(data.markupType);
      if (data.markupValue !== undefined) setMarkupValue(Number(data.markupValue) || 0);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setSlotsLoading(false);
    }
  }

  async function handleBooking(e) {
    e.preventDefault();
    if (selectedSlots.length === 0 || !bookingData.name || !bookingData.phone) return;

    const loadRazorpay = () => {
      return new Promise((resolve) => {
        if (typeof window !== 'undefined' && window.Razorpay) return resolve(true);
        const script = document.createElement('script');
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
    };

    setBookingLoading(true);
    try {
      const isLoaded = await loadRazorpay();
      if (!isLoaded) {
        alert("Razorpay SDK could not be loaded. Please DISABLE YOUR AD-BLOCKER and try again.");
        setBookingLoading(false);
        return;
      }
      const data = await apiPost('/bookings', {
        turf_id: Number(turf?.id || params.id),
        court_id: selectedCourt ? selectedCourt.id : undefined,
        customer_name: bookingData.name,
        customer_phone: bookingData.phone,
        customer_email: bookingData.email,
        booking_date: selectedDate,
        time_slots: selectedSlots,
        coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
        user_id: currentUser ? currentUser.id : null,
        payment_option: needPlayersToggle ? 'full' : paymentType,
        match_request_id: matchRequest?.id || undefined,
        // Matchmaking columns
        need_players: needPlayersToggle,
        players_needed: needPlayersToggle ? Number(matchData.players_needed || 0) : 0,
        contribution_amount: needPlayersToggle ? Number(matchData.contribution_amount || 0) : 0,
        sport_type: needPlayersToggle ? matchData.sport_type : undefined,
        match_type: needPlayersToggle ? matchData.match_type : undefined,
        skill_level: needPlayersToggle ? matchData.skill_level : undefined,
        contact_phone: needPlayersToggle ? (matchData.contact_phone || bookingData.phone) : undefined,
        note: needPlayersToggle ? matchData.note : undefined
      });

      // Helper: always send confirmation (non-critical)
      const sendConfirmation = async () => {
        try {
          await fetch(`${API_BASE}/notify/booking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_email: bookingData.email,
              customer_name: bookingData.name,
              turf_name: turf.name,
              booking_date: selectedDate,
              time_slot: selectedSlots.join(', '),
              amount: data.amount,
            }),
          });
        } catch (emailErr) {
          console.warn('Email notification failed (non-critical):', emailErr.message);
        }
      };

      // Initialize Razorpay if keys are not placeholders
      // Initialize Razorpay
      console.log('📦 API Response:', data);

      // No-charge bookings still need an authenticated server-side confirmation.
      if (Number(data.amount || 0) <= 0) {
        await apiPost('/bookings/confirm-demo', { booking_id: data.booking_id });
        await sendConfirmation();
        router(`/booking/success?id=${data.booking_id}`);
        return;
      }

      if (!data.order_id || !data.key_id) {
        throw new Error('Payment could not be initialized. Please try again later.');
      }
      if (typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay could not be initialized. Please refresh and try again.');
      }

      const options = {
          key: data.key_id,
          // amount is already set correctly in the Razorpay order by the server;
          // we don't override it here. Razorpay uses the order's amount.
          currency: data.currency,
          name: 'Book Arena',
          description: `Booking at ${turf.name}`,
          order_id: data.order_id,
          handler: async function (response) {
            setVerifying(true);
            try {
              console.log('✅ Payment success, verifying signature...');
              const verification = await apiPost('/bookings/verify', {
                booking_id: data.booking_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (!verification?.success) {
                router(`/payment-pending?booking_id=${encodeURIComponent(data.booking_id)}&order_id=${encodeURIComponent(data.order_id)}`);
                return;
              }
              await sendConfirmation();
              router(`/payment-success?booking_id=${encodeURIComponent(data.booking_id)}&order_id=${encodeURIComponent(data.order_id)}&payment_id=${encodeURIComponent(response.razorpay_payment_id)}`);
            } catch (err) {
              console.error('❌ Verification Error:', err);
              const pending = !!err?.response?.data?.pending || err?.response?.status >= 500;
              router(`${pending ? '/payment-pending' : '/payment-failed'}?booking_id=${encodeURIComponent(data.booking_id)}&order_id=${encodeURIComponent(data.order_id)}&payment_id=${encodeURIComponent(response.razorpay_payment_id)}`);
              setVerifying(false);
            }
          },
          prefill: {
            name: bookingData.name,
            contact: bookingData.phone,
            email: bookingData.email,
          },
          theme: { color: '#10b981' }, // Emerald-500
          modal: {
            ondismiss: async function() {
              console.log('👋 Checkout modal closed — reconciling payment status...');
              setBookingLoading(false);
              // Call cancel-pending to reconcile with Razorpay; it may confirm the booking if captured
              try {
                await apiPost('/bookings/cancel-pending', { booking_id: data.booking_id });
              } catch (e) { /* non-critical — the cleanup job handles stragglers */ }
              router(`/payment-cancelled?booking_id=${encodeURIComponent(data.booking_id)}&order_id=${encodeURIComponent(data.order_id)}`);
            }
          }
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', async function(response) {
        setBookingLoading(false);
        try { await apiPost('/bookings/cancel-pending', { booking_id: data.booking_id }); } catch (e) { /* non-critical */ }
        router(`/payment-failed?booking_id=${encodeURIComponent(data.booking_id)}&order_id=${encodeURIComponent(data.order_id)}&payment_id=${encodeURIComponent(response?.error?.metadata?.payment_id || '')}`);
      });
      rzp.open();
    } catch (err) {
      alert(err.message || 'Booking failed. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  }

  if (verifying) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div className="loading-page" style={{ background: 'rgba(0,0,0,0.8)', position: 'fixed', inset: 0, zIndex: 9999 }}>
          <div className="loading-spinner" />
          <h2 style={{ color: '#fff', marginTop: '1rem' }}>Verifying Payment...</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>Please do not close this window</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <section style={{ paddingTop: '100px', paddingBottom: '3rem' }}>
          <div className="container">
            {/* Title Skeleton */}
            <div className="skeleton-card" style={{ height: '40px', width: '60%', marginBottom: '1rem', borderRadius: '8px' }}></div>
            {/* Image Gallery Skeleton */}
            <div className="skeleton-card" style={{ height: isMobile ? '280px' : '460px', borderRadius: '16px', marginBottom: '2rem' }}></div>
            
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: isMobile ? '1.5rem' : '3rem' }}>
              <div>
                <div className="skeleton-card" style={{ height: '20px', width: '80%', marginBottom: '0.5rem', borderRadius: '4px' }}></div>
                <div className="skeleton-card" style={{ height: '20px', width: '40%', marginBottom: '2rem', borderRadius: '4px' }}></div>
                
                <div className="skeleton-card" style={{ height: '200px', borderRadius: '12px', marginBottom: '2rem' }}></div>
              </div>
              <div>
                <div className="skeleton-card" style={{ height: '400px', borderRadius: '16px' }}></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!turf) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div className="loading-page">
          <div style={{ fontSize: '4rem' }}>😕</div>
          <h2 style={{ color: 'var(--text-primary)' }}>Turf Not Found</h2>
          <Link to="/turfs" className="btn btn-primary">Browse All Turfs</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <Navbar />

      <section style={{ paddingTop: '100px', paddingBottom: '3rem' }}>
        <div className="container">
          {/* Breadcrumb */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
            color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem'
          }}>
            <Link to="/" style={{ color: 'var(--text-muted)' }}>Home</Link>
            <span>›</span>
            <Link to="/turfs" style={{ color: 'var(--text-muted)' }}>Turfs</Link>
            <span>›</span>
            <span style={{ color: selectedCourt ? 'var(--text-muted)' : 'var(--emerald-400)' }}>{turf.name}</span>
            {selectedCourt && (
              <>
                <span>›</span>
                <span style={{ color: 'var(--emerald-400)' }}>{selectedCourt.name}</span>
              </>
            )}
          </div>

          {/* Premium Airbnb-Style Photo Gallery */}
          <div 
            className="detail-gallery-container" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1rem',
              marginBottom: '2rem'
            }}
          >
            {/* Large Main Photo Frame with Left/Right arrows */}
            <div 
              className="gallery-main-frame"
              style={{
                position: 'relative',
                height: isMobile ? '280px' : '460px',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid var(--border-color, #334155)',
                backgroundColor: 'var(--bg-secondary, #0f172a)'
              }}
              onMouseEnter={() => setIsGalleryHovered(true)}
              onMouseLeave={() => {
                setIsGalleryHovered(false);
                setResumeTime(Date.now() + 3000); // Resume 3 seconds after hover exit
              }}
            >
              {currentImages.map((img, idx) => (
                <img 
                  key={idx}
                  src={resolveMediaUrl(img)}
                  alt={`${currentBookable.name || turf.name} photo ${idx + 1}`}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { e.target.onerror = null; e.target.src = '/images/default-turf.jpg'; }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: activeImage === idx ? 1 : 0,
                    transition: 'opacity 0.8s ease-in-out',
                    zIndex: activeImage === idx ? 1 : 0
                  }}
                />
              ))}

              {/* Manual Left/Right arrows */}
              {currentImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImage(prev => (prev - 1 + currentImages.length) % currentImages.length);
                      setResumeTime(Date.now() + 3000); // defer auto-cycle
                    }}
                    style={{
                      position: 'absolute',
                      left: isMobile ? '10px' : '20px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 3,
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      backdropFilter: 'blur(4px)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '50%',
                      width: isMobile ? '40px' : '46px',
                      height: isMobile ? '40px' : '46px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--emerald-500)';
                      e.currentTarget.style.borderColor = 'var(--emerald-400)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    }}
                  >
                    ⟨
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImage(prev => (prev + 1) % currentImages.length);
                      setResumeTime(Date.now() + 3000); // defer auto-cycle
                    }}
                    style={{
                      position: 'absolute',
                      right: isMobile ? '10px' : '20px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 3,
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      backdropFilter: 'blur(4px)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '50%',
                      width: isMobile ? '40px' : '46px',
                      height: isMobile ? '40px' : '46px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--emerald-500)';
                      e.currentTarget.style.borderColor = 'var(--emerald-400)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    }}
                  >
                    ⟩
                  </button>
                </>
              )}

              {/* Photo Count badge */}
              <div
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  backdropFilter: 'blur(6px)',
                  color: 'white',
                  padding: '6px 14px',
                  borderRadius: '30px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  zIndex: 2,
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                {activeImage + 1} / {currentImages.length}
              </div>
            </div>

            {/* Horizontal scrollable preview strip of thumbnails */}
            {currentImages.length > 1 && (
              <div 
                className="gallery-thumbnail-strip-wrapper"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div
                  className="gallery-thumbnail-strip"
                  style={{
                    display: 'flex',
                    gap: '10px',
                    overflowX: 'auto',
                    paddingBottom: '8px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--emerald-500) var(--bg-secondary)'
                  }}
                >
                  {currentImages.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setActiveImage(idx);
                        setResumeTime(Date.now() + 3000);
                      }}
                      style={{
                        flex: '0 0 90px',
                        aspectRatio: '4/3',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: activeImage === idx ? '2.5px solid var(--emerald-400)' : '1.5px solid transparent',
                        boxShadow: activeImage === idx ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none',
                        transition: 'all 0.25s ease',
                        backgroundColor: 'var(--bg-secondary)'
                      }}
                    >
                      <img 
                        src={resolveMediaUrl(img)} 
                        alt={`Thumb ${idx + 1}`} 
                        loading="lazy"
                        decoding="async"
                        onError={(e) => { e.target.onerror = null; e.target.src = '/images/default-turf.jpg'; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    </div>
                  ))}
                </div>

                {/* Indicator dots */}
                <div
                  className="gallery-indicator-dots"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '4px'
                  }}
                >
                  {currentImages.map((_, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setActiveImage(idx);
                        setResumeTime(Date.now() + 3000);
                      }}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: activeImage === idx ? 'var(--emerald-400)' : 'transparent',
                        border: activeImage === idx ? '1px solid var(--emerald-400)' : '1px solid var(--text-muted, #64748b)',
                        boxShadow: activeImage === idx ? '0 0 6px var(--emerald-400)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Turf Info + Booking Section */}
          <div className="booking-layout">
            {/* Left: Details */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <span className="card-badge badge-sport" style={{ position: 'static' }}>
                  {currentSport.emoji} {currentSport.label}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>⭐ 4.{5 + (parseInt(params.id) % 5)}</span>
              </div>

              <h1 style={{
                fontFamily: 'var(--font-display)', fontSize: isMobile ? '1.45rem' : '1.8rem',
                fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)'
              }}>
                {selectedCourt ? `${turf.name} — ${selectedCourt.name}` : turf.name}
              </h1>

              <p style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
                color: 'var(--text-secondary)', fontSize: isMobile ? '0.95rem' : '1.1rem', marginBottom: '1.5rem'
              }}>
                📍 {turf.location}
                {turf.address && ` — ${turf.address}`}
              </p>

              <div className="card-price" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span className="amount" style={{ fontSize: isMobile ? '2rem' : '2.5rem' }}>{formatPrice(currentPrice)}</span>
                <span className="period" style={{ fontSize: '1rem' }}>per hour</span>
              </div>

              {courts.length > 0 && (
                <div className="court-selector">
                  <div className="court-selector-header">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Choose Court / Game</h3>
                    <span style={{ background: 'var(--emerald-500)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>{courts.length} available</span>
                  </div>
                   <div className="court-grid">
                     {/* Always provide option for Main Venue if there are other courts */}
                     <button
                       type="button"
                       className={`court-option ${!selectedCourt ? 'active' : ''}`}
                       onClick={() => setSelectedCourt(null)}
                     >
                       <div className="court-icon">🏟️</div>
                       <div className="court-info">
                         <span className="court-name">Main Venue ({turf.name})</span>
                         <span className="court-type">{getSportInfo(turf.sport_type).label} • {turf.slot_duration || 60} min slots</span>
                       </div>
                       <div className="court-status">
                         <div className="court-option-price">{formatPrice(turf.price_per_hour)}</div>
                       </div>
                     </button>

                     {courts.map(court => {
                       const courtSport = getSportInfo(court.sport_type || turf.sport_type);
                       const isSelected = selectedCourt?.id === court.id;

                      return (
                        <button
                          key={court.id}
                          type="button"
                          className={`court-option ${isSelected ? 'active' : ''}`}
                          onClick={() => setSelectedCourt(court)}
                        >
                          {court.images?.length > 0 && (
                            <img src={resolveMediaUrl(court.images[0])} alt={court.name} loading="lazy" decoding="async" />
                          )}
                          <span className="court-option-main">
                            <strong>{court.name}</strong>
                            <small>{courtSport.label} · {court.slot_duration || 60} min slots · {court.time_format || '12h'}</small>
                          </span>
                          <span className="court-option-price">{formatPrice(court.price_per_hour)}/hr</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Monthly Subscription Section */}
              {subPlans.length > 0 && (
                <div style={{ marginBottom: '3rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      💎 Monthly Fixed Slots
                    </h3>
                    <span className="badge-exclusive" style={{ fontSize: '0.7rem' }}>TRAIN DAILY</span>
                  </div>
                  
                  <div className="grid-2" style={{ gap: '1.25rem' }}>
                    {subPlans.map(plan => (
                      <div key={plan.id} className="card" style={{ 
                        background: 'var(--bg-surface)', 
                        border: plan.popular_badge ? '2px solid var(--emerald-500)' : '1px solid var(--border-subtle)',
                        position: 'relative',
                        padding: '1.25rem'
                      }}>
                        {plan.popular_badge && (
                          <div style={{ 
                            position: 'absolute', top: '-12px', right: '20px', 
                            background: 'var(--emerald-500)', color: '#fff', 
                            padding: '4px 12px', borderRadius: '20px', 
                            fontSize: '0.65rem', fontWeight: 900, boxShadow: '0 4px 12px rgba(16,185,129,0.3)' 
                          }}>POPULAR</div>
                        )}
                        
                        <div style={{ marginBottom: '1rem' }}>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{plan.name}</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{plan.description || `Fixed ${plan.start_time.substring(0,5)} - ${plan.end_time.substring(0,5)} slot every day`}</p>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time Range</span>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--emerald-400)' }}>{plan.start_time.substring(0,5)} - {plan.end_time.substring(0,5)}</span>
                          </div>
                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monthly</span>
                            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>{formatPrice(plan.price)}</span>
                          </div>
                        </div>

                        <button 
                          className="btn btn-primary btn-sm" 
                          style={{ width: '100%', borderRadius: '8px' }}
                          onClick={() => {
                            if (!currentUser) {
                              alert('Please login to subscribe');
                              router('/login');
                              return;
                            }
                            (async () => {
                              try {
                                const purRes = await apiPost('/subscriptions/purchase', { subscription_offer_id: plan.id });
                                if (purRes.skipPayment) {
                                  alert('Subscription activated! Your slots are reserved.');
                                  window.location.reload();
                                  return;
                                }
                                const { loadRazorpay: loadRzp } = await import('../lib/razorpay').catch(() => ({
                                  loadRazorpay: () => new Promise((res, rej) => {
                                    if (window.Razorpay) return res(true);
                                    const s = document.createElement('script');
                                    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
                                    s.onload = () => res(true); s.onerror = () => rej(new Error('Failed to load Razorpay'));
                                    document.body.appendChild(s);
                                  })
                                }));
                                await (typeof loadRzp === 'function' ? loadRzp() : new Promise((res, rej) => {
                                  if (window.Razorpay) return res(true);
                                  const s = document.createElement('script');
                                  s.src = 'https://checkout.razorpay.com/v1/checkout.js';
                                  s.onload = () => res(true); s.onerror = () => rej(new Error('Failed to load Razorpay'));
                                  document.body.appendChild(s);
                                }));
                                await new Promise((resolve, reject) => {
                                  const rzp = new window.Razorpay({
                                    key: purRes.key_id || process.env.REACT_APP_RAZORPAY_KEY_ID,
                                    amount: purRes.amount,
                                    currency: purRes.currency || 'INR',
                                    name: 'Book Arena',
                                    description: `Subscription: ${plan.name}`,
                                    order_id: purRes.order_id,
                                    handler: async function(response) {
                                      try {
                                        await apiPost('/subscriptions/verify', {
                                          razorpay_order_id: response.razorpay_order_id,
                                          razorpay_payment_id: response.razorpay_payment_id,
                                          razorpay_signature: response.razorpay_signature,
                                        });
                                        alert('Subscription activated! Your slots are reserved. Check My Subscriptions.');
                                        window.location.reload();
                                        resolve();
                                      } catch (e) { reject(e); }
                                    },
                                    prefill: { name: user?.name || '', email: user?.email || '' },
                                    theme: { color: '#10b981' },
                                    modal: {
                                      ondismiss: async () => {
                                        try { await apiPost('/subscriptions/cancel-payment', { razorpay_order_id: purRes.order_id }); } catch (_) {}
                                        resolve();
                                      }
                                    }
                                  });
                                  rzp.on('payment.failed', async () => {
                                    try { await apiPost('/subscriptions/cancel-payment', { razorpay_order_id: purRes.order_id, failed: true }); } catch (_) {}
                                    alert('Payment failed. Your subscription was not activated. Please try again.');
                                    resolve();
                                  });
                                  rzp.open();
                                });
                              } catch (err) {
                                alert(err?.response?.data?.error || err.message || 'Could not start subscription. Please try again.');
                              }
                            })();
                          }}
                        >
                          Book Fixed Slot
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {turf.description && (
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                    About This Turf
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{turf.description}</p>
                </div>
              )}

              {/* Amenities */}
              {combinedAmenities.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                    Amenities & Features
                  </h3>
                  <div className="amenity-tags">
                    {combinedAmenities.map((a, i) => (
                      <span key={i} className="amenity-tag" style={{ fontSize: '0.9rem', padding: '8px 16px' }}>
                        ✓ {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Slot Selection */}
              <div id="slot-selection">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ⏰ Select Time Slot
                        </h3>
                        <button 
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ 
                            borderRadius: 'var(--radius-full)', 
                            padding: '6px 14px', 
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onClick={openCalendarPicker}
                        >
                          <><span>📅</span> Choose Date</>
                        </button>
                    </div>
                    
                    {/* Date Capsule Picker */}
                    <div className="date-picker-container">
                        <div className="date-picker-scroll">
                            {displayedDates.map((d) => (
                                <div 
                                    key={d.full}
                                    id={`date-capsule-${d.full}`}
                                    className={`date-capsule ${selectedDate === d.full ? 'active' : ''}`}
                                    onClick={() => handleDateSelection(d.full)}
                                >
                                    <span className="day">{d.day}</span>
                                    <span className="date">{d.date}</span>
                                    <span className="month">{d.month}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <input
                      ref={calendarInputRef}
                      type="date"
                      className="booking-calendar-input"
                      aria-label="Choose booking date"
                      min={availableDates[0]?.full}
                      max={availableDates[availableDates.length - 1]?.full}
                      value={selectedDate}
                      onChange={(e) => handleDateSelection(e.target.value)}
                    />
                </div>

                 {slotsLoading ? (
                   <div className="flex-center" style={{ padding: '2rem' }}>
                     <div className="loading-spinner" />
                   </div>
                 ) : slots.length > 0 ? (
                   <>
                    {availableSections.length > 0 && (
                      <>
                        <div className="slot-section-tabs">
                          {availableSections.map(section => {
                            const sectionSlots = groupedSlots[section.key] || [];
                            return (
                              <button
                                key={section.key}
                                type="button"
                                className={`slot-section-tab ${activeSectionKey === section.key ? 'active' : ''}`}
                                onClick={() => setActiveSection(section.key)}
                                aria-pressed={activeSectionKey === section.key}
                              >
                                <span>{section.label}</span>
                                <b>{sectionSlots.length}</b>
                              </button>
                            );
                          })}
                        </div>

                        {activeSectionMeta && (
                          <div className="slots-container-compact">
                            <div style={{ marginBottom: '0.85rem' }}>
                              <div style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 800, marginBottom: '0.15rem' }}>
                                {activeSectionMeta.label}
                              </div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                {activeSectionMeta.range}
                              </div>
                            </div>

                            <div className="slot-grid-compact">
                              {activeSectionSlots.map((slot) => {
                                const [rawStartTime, rawEndTime] = slot.time.split(' - ');
                                const startTime = formatSlotTime(rawStartTime);
                                const endTime = formatSlotTime(rawEndTime);
                                const isAvailable = slot.status === 'available';
                                const isSelected = selectedSlots.includes(slot.time);
                                const statusLabel = slot.status === 'blocked' ? 'Blocked' : slot.status === 'booked' ? 'Booked' : 'Available';

                                return (
                                  <button
                                    key={slot.time}
                                    type="button"
                                    disabled={!isAvailable}
                                    aria-disabled={!isAvailable}
                                    className={`slot-card-compact ${
                                      isAvailable
                                        ? isSelected ? 'available selected' : 'available'
                                        : slot.status === 'booked' ? 'booked' : 'blocked'
                                    }`}
                                    onClick={() => {
                                      let newSlots = [...selectedSlots];
                                      if (newSlots.includes(slot.time)) {
                                        newSlots = newSlots.filter(t => t !== slot.time);
                                      } else {
                                        newSlots.push(slot.time);
                                      }
                                      setSelectedSlots(newSlots);
                                      if (newSlots.length > 0) {
                                        setShowBookingForm(true);
                                        calculatePricing(newSlots, appliedCoupon?.code, needPlayersToggle, matchData.players_needed, matchData.contribution_amount);
                                      } else {
                                        setShowBookingForm(false);
                                        setPricingBreakdown(null);
                                      }
                                    }}
                                  >
                                    {slot.offerLabel || slot.offerPercentage ? (
                                      <div className="slot-mini-badge">
                                        {slot.offerLabel ? 'OFFER' : `${slot.offerPercentage}%`}
                                      </div>
                                    ) : null}

                                    <div className="slot-card-content">
                                      <div className="slot-time-side">
                                        <div className="time-val">{startTime}</div>
                                        <div className="time-sep">-</div>
                                        <div className="time-val">{endTime}</div>
                                      </div>

                                      <div className="slot-price-side">
                                        {slot.hasSpecialPrice ? (
                                          <>
                                            <span className="old">{formatPrice(slot.basePrice)}</span>
                                            <span className="new special">{formatPrice(slot.price)}</span>
                                          </>
                                        ) : (
                                          <span className="new">{formatPrice(slot.price)}</span>
                                        )}
                                      </div>
                                    </div>

                                    <div className={`slot-status-label ${slot.status}`}>
                                      {statusLabel}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                   </>
                 ) : (
                   <div className="empty-state-small">
                     <p style={{ color: 'var(--text-muted)' }}>No slots available for this date</p>
                   </div>
                 )}
              </div>
            </div>

            {/* Right: Booking Card */}
            <div>
              <div className="card" style={{ padding: '1.5rem', position: isMobile ? 'static' : 'sticky', top: isMobile ? 'auto' : '100px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                  🎯 Complete Your Booking
                </h3>

                {/* Available Coupons Banner (Restored & Improved) */}
                {availableCoupons.length > 0 && (
                  <div style={{ 
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.1))', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '1rem', 
                    marginBottom: '1.5rem',
                    border: '1px dashed var(--emerald-500)'
                  }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                      🎁 Available Coupons
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {availableCoupons.map((coupon, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            if (selectedSlots.length === 0) {
                              setCouponError('Please select a time slot first');
                              return;
                            }
                            setCouponCode(coupon.code);
                            // Auto-trigger calculation (includes any match_request_id offset)
                            calculatePricing(selectedSlots, coupon.code).then((data) => {
                              if (!data) return;
                              setAppliedCoupon(data.coupon);
                              setCouponError('');
                              setCouponSuccess('applied coupoun successfully');
                            });
                          }}
                          style={{ 
                            background: 'var(--bg-surface)', 
                            border: '1px solid var(--emerald-500)', 
                            padding: '6px 12px', 
                            borderRadius: '6px', 
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                        >
                          <span style={{ fontWeight: 800, color: 'var(--emerald-400)', fontFamily: 'monospace' }}>{coupon.code}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{coupon.displayText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Selected Turf</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{turf.name}</span>
                  </div>
                  {selectedCourt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Court / Game</span>
                      <span style={{ color: 'var(--emerald-400)', fontWeight: 700, fontSize: '0.9rem' }}>{selectedCourt.name}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Booking Date</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                      {selectedDate ? new Date(selectedDate + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Time Slot</span>
                    <span style={{ color: selectedSlots.length > 0 ? 'var(--emerald-400)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem' }}>
                      {formatContinuousSlots(selectedSlots)}
                    </span>
                  </div>

                  {/* Integrated Need Players for This Slot Toggle */}
                  {selectedSlots.length > 0 && !matchRequest && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      background: 'rgba(16,185,129,0.06)',
                      border: '1px solid rgba(16,185,129,0.15)',
                      borderRadius: '12px',
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        <input
                          type="checkbox"
                          checked={needPlayersToggle}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setNeedPlayersToggle(val);
                            if (!val) setContributionManuallySet(false);
                            // Find Players has no advance option; switching it off brings back the venue's normal payment options
                            if (val) { paymentTypeBeforeMatch.current = paymentType; setPaymentType('full'); }
                            else { setPaymentType(paymentTypeBeforeMatch.current || 'advance'); }
                            calculatePricing(selectedSlots, appliedCoupon?.code, val, matchData.players_needed, matchData.contribution_amount, val ? 'full' : (paymentTypeBeforeMatch.current || paymentType));
                          }}
                          style={{ width: '18px', height: '18px', accentColor: 'var(--emerald-500)' }}
                        />
                        <span>Need Players for This Slot?</span>
                      </label>

                      {needPlayersToggle && (
                        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem' }}>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Players Needed</label>
                              <input
                                type="number"
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                min={1}
                                value={matchData.players_needed}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const nextPlayers = Math.min(50, Math.max(1, val || 1));
                                  // the backend recomputes everyone's share from the final amount and returns it
                                  setMatchData({ ...matchData, players_needed: nextPlayers });
                                  calculatePricing(selectedSlots, appliedCoupon?.code, true, nextPlayers, matchData.contribution_amount, 'full');
                                }}
                              />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Each player's share (₹)</label>
                              <input
                                type="number"
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '0.85rem', opacity: 0.85 }}
                                value={matchData.contribution_amount}
                                readOnly
                                title="Final booking amount ÷ (you + players). Calculated automatically."
                              />
                            </div>
                          </div>

                          {/* Live summary */}
                          <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '10px',
                            padding: '0.75rem'
                          }}>
                            {(() => {
                              // Use discounted price (after coupon) for host-pays calculation
                              const discountedBase = Number(pricingBreakdown?.originalFinalAmount || pricingBreakdown?.basePrice || 0);
                              const needed = Math.max(1, Number(matchData.players_needed || 1));
                              const per = Math.max(0, Number(matchData.contribution_amount || 0));
                              const collected = per * needed;
                              const hostPays = Number(pricingBreakdown?.hostSplitShare ?? Math.max(0, discountedBase - collected));
                              return (
                                <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.85rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Players needed:</span>
                                    <span style={{ fontWeight: 700 }}>{needed}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Each player pays (final amount ÷ {needed + 1}):</span>
                                    <span style={{ fontWeight: 700 }}>₹{per}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Total collected from players:</span>
                                    <span style={{ fontWeight: 800, color: 'var(--emerald-400)' }}>₹{collected}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>You pay now (your share):</span>
                                    <span style={{ fontWeight: 800 }}>₹{hostPays}</span>
                                  </div>
                                  <div style={{ marginTop: '0.35rem', color: '#fbbf24', fontWeight: 700, fontSize: '0.8rem' }}>
                                    ⚠️ If no players join you pay full ₹{discountedBase || 0}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Sport Type</label>
                            <select
                              className="form-input"
                              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                              value={matchData.sport_type}
                              onChange={(e) => setMatchData({ ...matchData, sport_type: e.target.value })}
                            >
                              {SPORT_OPTIONS.filter(s => s !== 'All').map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem' }}>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Match Type</label>
                              <select
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                value={matchData.match_type}
                                onChange={(e) => setMatchData({ ...matchData, match_type: e.target.value })}
                              >
                                <option value="friendly">Friendly</option>
                                <option value="competitive">Competitive</option>
                              </select>
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Skill Level</label>
                              <select
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                value={matchData.skill_level}
                                onChange={(e) => setMatchData({ ...matchData, skill_level: e.target.value })}
                              >
                                <option value="all">All Levels</option>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '2px' }}>Optional Note</label>
                            <textarea
                              className="form-input"
                              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                              placeholder="e.g. Bring own bat / racket"
                              rows={2}
                              value={matchData.note}
                              onChange={(e) => setMatchData({ ...matchData, note: e.target.value })}
                            />
                          </div>

                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.25' }}>
                            💡 <strong>Liability note:</strong> If players do not join, you will need to pay the remaining ₹{Number(matchData.players_needed || 0) * Number(matchData.contribution_amount || 0)} rupees at the venue.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedSlots.length > 0 && matchRequest && (
                    <div style={{ marginTop: '0.75rem', display: 'grid', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: '100%' }}
                        onClick={() => window.open(matchRequest.shareUrl, '_blank', 'noopener,noreferrer')}
                      >
                        Open Player Request
                      </button>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(matchRequest.shareUrl);
                              alert('Link copied');
                            } catch {
                              alert(matchRequest.shareUrl);
                            }
                          }}
                        >
                          Copy Link
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ background: '#25D366', borderColor: '#25D366' }}
                          onClick={() => {
                            const msg =
                              `Need players for this slot at ${turf.name}\n` +
                              `Date: ${selectedDate}\n` +
                              `Time: ${formatContinuousSlots(selectedSlots)}\n` +
                              `Join: ${matchRequest.shareUrl}`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          WhatsApp
                        </button>
                      </div>
                      {matchRequestSummary?.match && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          Players: {matchRequestSummary.match.filled_slots}/{matchRequestSummary.match.total_slots} • Collected: ₹{Math.round(matchRequestSummary.contribution_total || 0)}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {pricingBreakdown && (
                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', padding: '8px 0', borderBottom: '1px dashed var(--border-subtle)' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                          Slot Price
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem' }}>
                          {formatPrice(pricingBreakdown.basePrice)}
                        </span>
                      </div>

                      {appliedCoupon && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: 'var(--emerald-400)', fontSize: '0.85rem' }}>Applied Coupon ({appliedCoupon.code})</span>
                          <span style={{ color: 'var(--emerald-400)', fontWeight: 600, fontSize: '0.9rem' }}>
                            -{formatPrice(pricingBreakdown.discountAmount)} OFF
                          </span>
                        </div>
                      )}

                      {pricingBreakdown.showFeeAtCheckout !== false && (pricingBreakdown.serviceFee > 0 || pricingBreakdown.serviceFeeTax > 0) && (
                        <>
                          {pricingBreakdown.serviceFee > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Customer Service Fee</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                                {formatPrice(pricingBreakdown.serviceFee)}
                              </span>
                            </div>
                          )}
                          {pricingBreakdown.serviceFeeTax > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Tax on Service Fee</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                                {formatPrice(pricingBreakdown.serviceFeeTax)}
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      {pricingBreakdown.contributionOffset > 0 && (
                        <div style={{ marginTop: '0.75rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px', padding: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Original total</span>
                            <span style={{ fontWeight: 700 }}>{formatPrice(pricingBreakdown.originalFinalAmount || 0)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Contributions offset</span>
                            <span style={{ color: 'var(--emerald-400)', fontWeight: 800 }}>-{formatPrice(pricingBreakdown.contributionOffset || 0)}</span>
                          </div>
                        </div>
                      )}

                      {needPlayersToggle && pricingBreakdown.hostSplitShare != null && (
                        <div style={{ marginTop: '0.75rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '10px', padding: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Full slot price</span>
                            <span style={{ fontWeight: 700 }}>{formatPrice(pricingBreakdown.originalFinalAmount || 0)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Split among</span>
                            <span style={{ fontWeight: 700 }}>{pricingBreakdown.totalPeople} people</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#818cf8', fontSize: '0.85rem', fontWeight: 600 }}>Your share (1 of {pricingBreakdown.totalPeople})</span>
                            <span style={{ color: '#818cf8', fontWeight: 800 }}>{formatPrice(pricingBreakdown.hostSplitShare)}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Find Players: the advance option is not offered — explain what happens instead */}
                      {needPlayersToggle && pricingBreakdown.advancePercent < 100 && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          With Find Players there is no advance payment: you pay your share now and each friend pays theirs through your invite link.
                        </div>
                      )}

                      {/* Payment Option Selection — only show if advance is available */}
                      {pricingBreakdown.advancePercent < 100 && !needPlayersToggle && !pricingBreakdown.advanceDisabled && (
                        <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                          <p style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem' }}>Select Payment Option:</p>
                          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                            <label className={`payment-option-label ${paymentType === 'advance' ? 'active' : ''}`} style={{ 
                              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', 
                              border: `1px solid ${paymentType === 'advance' ? 'var(--emerald-500)' : 'var(--border-subtle)'}`, 
                              borderRadius: '8px', cursor: 'pointer', background: paymentType === 'advance' ? 'rgba(16,185,129,0.05)' : 'transparent' 
                            }}>
                              <input 
                                type="radio" 
                                name="payment_type" 
                                value="advance" 
                                checked={paymentType === 'advance'} 
                                onChange={(e) => {
                                  handlePaymentTypeChange('advance');
                                }}
                                style={{ accentColor: 'var(--emerald-500)', width: '18px', height: '18px' }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>Pay Advance ({pricingBreakdown.advancePercent}%)</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pay now, rest at venue</div>
                              </div>
                            </label>

                            <label className={`payment-option-label ${paymentType === 'full' ? 'active' : ''}`} style={{ 
                              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', 
                              border: `1px solid ${paymentType === 'full' ? 'var(--emerald-500)' : 'var(--border-subtle)'}`, 
                              borderRadius: '8px', cursor: 'pointer', background: paymentType === 'full' ? 'rgba(16,185,129,0.05)' : 'transparent' 
                            }}>
                              <input 
                                type="radio" 
                                name="payment_type" 
                                value="full" 
                                checked={paymentType === 'full'} 
                                onChange={(e) => {
                                  handlePaymentTypeChange('full');
                                }}
                                style={{ accentColor: 'var(--emerald-500)', width: '18px', height: '18px' }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>Pay Full Amount</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hassle-free entry</div>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* ── SINGLE SOURCE OF TRUTH: Final payment breakdown ── */}
                      {pricingBreakdown.paymentType === 'advance' ? (
                        <div style={{ marginTop: '0.75rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>💳 You Pay Now ({pricingBreakdown.advancePercent}%)</span>
                            <span style={{ color: 'var(--gold-400)', fontWeight: 800, fontSize: '1.15rem' }}>{formatPrice(pricingBreakdown.advanceAmount)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Due at Venue</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatPrice(pricingBreakdown.pendingBalance)}</span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: '0.75rem', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--emerald-500)', borderRadius: '10px', padding: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>💳 You Pay Now (100%)</span>
                            <span style={{ color: 'var(--emerald-400)', fontWeight: 800, fontSize: '1.15rem' }}>{formatPrice(pricingBreakdown.finalAmount)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Coupon Section ── */}
                {showBookingForm && selectedSlots.length > 0 && (
                  <div style={{ marginBottom: '1.5rem', position: 'relative' }}>

                    {/* Celebration burst */}
                    {showCelebration && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        pointerEvents: 'none', zIndex: 10, overflow: 'hidden',
                        borderRadius: 'var(--radius-md)'
                      }}>
                        {Array.from({ length: 18 }).map((_, i) => (
                          <span key={i} style={{
                            position: 'absolute',
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 60}%`,
                            fontSize: `${0.8 + Math.random() * 1.2}rem`,
                            animation: `confettiFall ${0.6 + Math.random() * 1.2}s ease-out forwards`,
                            animationDelay: `${Math.random() * 0.4}s`,
                            opacity: 0
                          }}>
                            {['🎉','✨','🎊','💚','⭐','🌟'][i % 6]}
                          </span>
                        ))}
                      </div>
                    )}

                    <label className="form-label">🎟️ Have a Coupon?</label>

                    {appliedCoupon ? (
                      /* ── Applied State ── */
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(16,185,129,0.12)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.85rem 1rem',
                        border: '1.5px solid var(--emerald-500)',
                        animation: 'couponSuccessPop 0.35s cubic-bezier(0.34,1.56,0.64,1)'
                      }}>
                        <div>
                          <span style={{ fontWeight: 800, fontFamily: 'monospace', color: 'var(--emerald-400)', letterSpacing: '0.05em' }}>
                            {appliedCoupon.code}
                          </span>
                          <span style={{ marginLeft: '0.6rem', color: 'var(--emerald-400)', fontSize: '0.85rem', fontWeight: 600 }}>
                            – {appliedCoupon.discountType === 'flat' ? `₹${appliedCoupon.discountValue}` : `${appliedCoupon.discountValue}%`} OFF
                          </span>
                          <div style={{ fontSize: '0.78rem', marginTop: '3px', color: 'var(--emerald-400)', fontWeight: 500 }}>
                            ✅ {couponSuccess || 'Coupon applied successfully'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={removeCoupon}
                          title="Remove coupon"
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      /* ── Input + suggestions ── */
                      <>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Enter coupon code"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                            style={{
                              flex: 1,
                              textTransform: 'uppercase',
                              fontFamily: 'monospace',
                              letterSpacing: '0.05em',
                              animation: couponShake ? 'couponShake 0.5s ease' : 'none'
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleApplyCoupon()}
                            disabled={couponLoading || !couponCode.trim()}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {couponLoading ? '⏳' : 'Apply'}
                          </button>
                        </div>

                        {/* Error message */}
                        {couponError && (
                          <p style={{
                            color: '#f87171', fontSize: '0.8rem', marginTop: '0.4rem',
                            animation: 'couponShake 0.5s ease'
                          }}>
                            ⚠️ {couponError}
                          </p>
                        )}

                        {/* Suggestion chips */}
                        {availableCoupons.length > 0 && (
                          <div style={{ marginTop: '0.85rem' }}>
                            <p style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              marginBottom: '0.5rem',
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}>
                              <span style={{ color: 'var(--emerald-400)' }}>🏷️</span>
                              Available offers — tap to apply
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {availableCoupons.map((c) => (
                                <div
                                  key={c.code}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px dashed rgba(16,185,129,0.35)',
                                    borderRadius: '10px',
                                    padding: '0.6rem 0.85rem',
                                    gap: '0.75rem'
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <span style={{
                                        fontFamily: 'monospace',
                                        fontWeight: 800,
                                        fontSize: '0.88rem',
                                        color: 'var(--emerald-400)',
                                        background: 'rgba(16,185,129,0.12)',
                                        padding: '1px 8px',
                                        borderRadius: '5px',
                                        letterSpacing: '0.06em'
                                      }}>
                                        {c.code}
                                      </span>
                                      <span style={{
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        color: 'var(--emerald-300)'
                                      }}>
                                        {c.displayText}
                                      </span>
                                      {c.source === 'admin' && (
                                        <span style={{
                                          fontSize: '0.65rem',
                                          background: 'rgba(99,102,241,0.18)',
                                          color: '#a5b4fc',
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                          fontWeight: 600
                                        }}>
                                          PLATFORM OFFER
                                        </span>
                                      )}
                                    </div>
                                    {(c.minBookingAmount > 0 || c.maxDiscountCap || c.validUntil) && (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                        {c.minBookingAmount > 0 && `Min booking ₹${c.minBookingAmount}`}
                                        {c.minBookingAmount > 0 && (c.maxDiscountCap || c.validUntil) && ' · '}
                                        {c.maxDiscountCap && `Max discount ₹${c.maxDiscountCap}`}
                                        {c.maxDiscountCap && c.validUntil && ' · '}
                                        {c.validUntil && `Valid till ${c.validUntil}`}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleApplyCoupon(c.code)}
                                    disabled={couponLoading}
                                    style={{
                                      flexShrink: 0,
                                      padding: '0.3rem 0.75rem',
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      background: 'transparent',
                                      border: '1.5px solid var(--emerald-500)',
                                      color: 'var(--emerald-400)',
                                      borderRadius: '7px',
                                      cursor: couponLoading ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.18s',
                                      whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.background = 'rgba(16,185,129,0.15)';
                                      e.target.style.color = '#fff';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.background = 'transparent';
                                      e.target.style.color = 'var(--emerald-400)';
                                    }}
                                  >
                                    Apply
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                  

                {/* Booking Form */}
                {showBookingForm && selectedSlots.length > 0 ? (
                  !currentUser ? (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                      <p role="status" style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Please log in to continue with your booking.</p>
                      <Link
                        to={`/login?redirect=${encodeURIComponent(`/turfs/${params.id}?resumeBooking=1`)}&reason=booking`}
                        onClick={() => {
                          sessionStorage.setItem(`turf-booking:${turf.id}`, JSON.stringify({
                            selectedDate,
                            selectedSlots,
                            courtId: selectedCourt?.id || null
                          }));
                        }}
                        className="btn btn-primary"
                        style={{ width: '100%', display: 'inline-block' }}
                      >
                        Login to Continue
                      </Link>
                    </div>
                  ) : (
                  <form onSubmit={handleBooking} id="booking-form">
                    <div className="form-group">
                      <label className="form-label">Your Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Enter your full name"
                        value={bookingData.name}
                        onChange={(e) => setBookingData({ ...bookingData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number *</label>
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="Enter 10-digit mobile number"
                        value={bookingData.phone}
                        onChange={(e) => setBookingData({ ...bookingData, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email Address (Optional)</label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="For booking confirmation"
                        value={bookingData.email}
                        onChange={(e) => setBookingData({ ...bookingData, email: e.target.value })}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary btn-lg"
                      style={{ width: '100%', marginTop: '1rem' }}
                      disabled={bookingLoading}
                    >
                      {bookingLoading ? 'Processing...' : 'Pay Now & Confirm 🏟️'}
                    </button>
                  </form>
                  )
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📅</div>
                    <p>Select a date and time slot to start booking</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <BookingFindPlayersModal
        isOpen={showFindPlayersModal}
        onClose={() => setShowFindPlayersModal(false)}
        onCreated={(created) => {
          setMatchRequest(created);
          setShowFindPlayersModal(false);
        }}
        turf={turf}
        court={selectedCourt}
        bookingDate={selectedDate}
        bookingTimeSlot={formatContinuousSlots(selectedSlots)}
        bookingTotalAmount={pricingBreakdown?.originalFinalAmount ?? pricingBreakdown?.finalAmount ?? 0}
      />

      <Footer />
    </div>
  );
}
