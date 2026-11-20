
import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate as useRouter } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { formatPrice, formatCompactNumber, formatDate, formatSlotTime, getSportInfo, AMENITIES_LIST, VENUE_CATEGORIES } from '@/lib/constants';
import TurfImageUpload from '@/components/TurfImageUpload';
import VenueRegistrationWizard from '@/components/owner/VenueRegistrationWizard';
import HostTournaments from './HostTournaments';
import { setPageMeta } from '@/lib/seo';
import { normalizePhotoList, resolveMediaUrl } from '@/lib/mediaUrl';
import { groupContinuousBookings } from '@/lib/bookingGrouping';

const OWNER_EARNINGS_HISTORY_DAYS = 90;

function formatDashboardInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDashboardTodayInputDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return formatDashboardInputDate(today);
}

function getDashboardDaysAgoInputDate(daysAgo) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return formatDashboardInputDate(date);
}

function formatSettlementMoney(minor, currency) {
  const digits = { KWD: 3, OMR: 3, BHD: 3, JPY: 0 }[currency] ?? 2;
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: digits
    }).format(Number(minor || 0) / (10 ** digits));
  } catch {
    return `${currency} ${(Number(minor || 0) / (10 ** digits)).toFixed(digits)}`;
  }
}

function getDashboardDateDiffInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

export default function OwnerDashboard() {
  const router = useRouter();
  const [owner, setOwner] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [turfs, setTurfs] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [ownerBilling, setOwnerBilling] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [billingBusyCycle, setBillingBusyCycle] = useState('');
  const [earningsTurfId, setEarningsTurfId] = useState('');
  const [earningsRangeType, setEarningsRangeType] = useState('30');
  const [earningsStartDate, setEarningsStartDate] = useState(() => getDashboardDaysAgoInputDate(29));
  const [earningsEndDate, setEarningsEndDate] = useState(() => getDashboardTodayInputDate());
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardWarning, setDashboardWarning] = useState('');
  const [activityStats, setActivityStats] = useState(null);
  const [activityBookings, setActivityBookings] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityRefresh, setActivityRefresh] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Venue summary & onboarding state
  const [venueSummary, setVenueSummary] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardDraft, setWizardDraft] = useState(null);
  const [selectedVenueId, setSelectedVenueId] = useState('');

  // Turf form state
  const [showTurfForm, setShowTurfForm] = useState(false);
  const [editingTurf, setEditingTurf] = useState(null);
  const [turfUploadKey, setTurfUploadKey] = useState(0);
  const [turfForm, setTurfForm] = useState({
    name: '', location: '', address: '', sport_type: 'cricket',
    price_per_hour: '', description: '', images: [], amenities: [],
    open_time: '06:00', close_time: '23:00',
    markup_type: 'fixed', markup_value: '0',
    latitude: '', longitude: '',
    slot_duration: 60, time_format: '12h', advance_percent: 100, is_24_hours: false,
    photos: [], coverImage: '', photosCount: 0,
    default_price: '', early_morning_price: '', morning_price: '', afternoon_price: '', evening_price: '',
    owner_email: ''
  });

  // Google Places address search (for owner add/edit turf)
  const addressInputRef = useRef(null);
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const mapPickerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const leafletMarkerRef = useRef(null);
  const addressRequestIdRef = useRef(0);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [pickerSelection, setPickerSelection] = useState({ address: '', latitude: '', longitude: '' });
  const [locationPickerError, setLocationPickerError] = useState('');

  useEffect(() => {
    // The Google Maps script is included in index.html. We initialize Places services
    // once it becomes available (async script).
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      if (typeof window !== 'undefined' && window.google?.maps?.places) {
        try {
          if (!autocompleteServiceRef.current) {
            autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
          }
          if (!placesServiceRef.current) {
            placesServiceRef.current = new window.google.maps.places.PlacesService(document.createElement('div'));
          }
          clearInterval(t);
        } catch (e) {
          // keep trying a few times; script may still be initializing
        }
      }
      if (tries >= 30) clearInterval(t);
    }, 400);
    return () => clearInterval(t);
  }, []);

  const extractCityFromPlace = (components = []) => {
    const get = (type) => components.find(c => (c.types || []).includes(type))?.long_name;
    return (
      get('locality') ||
      get('administrative_area_level_3') ||
      get('administrative_area_level_2') ||
      get('administrative_area_level_1') ||
      ''
    );
  };

  const handleAddressChange = (value) => {
    setTurfForm(prev => ({ ...prev, address: value }));

    const input = String(value || '').trim();
    if (!input || input.length < 2) {
      setAddressSuggestions([]);
      setAddressDropdownOpen(false);
      return;
    }

    if (!autocompleteServiceRef.current) {
      setAddressSuggestions([]);
      setAddressDropdownOpen(false);
      return;
    }

    const requestId = ++addressRequestIdRef.current;
    autocompleteServiceRef.current.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'in' }
      },
      (predictions) => {
        if (requestId !== addressRequestIdRef.current) return;
        const list = Array.isArray(predictions) ? predictions : [];
        setAddressSuggestions(list);
        setAddressDropdownOpen(list.length > 0);
      }
    );
  };

  const handleAddressSelect = (prediction) => {
    if (!prediction?.place_id || !placesServiceRef.current) return;

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['formatted_address', 'geometry', 'name', 'address_components']
      },
      (place, status) => {
        if (status !== window.google?.maps?.places?.PlacesServiceStatus?.OK || !place?.geometry?.location) {
          return;
        }

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const city = extractCityFromPlace(place.address_components || []);
        const fullAddress = place.formatted_address || prediction.description || '';

        setTurfForm(prev => ({
          ...prev,
          address: fullAddress || prev.address,
          latitude: Number.isFinite(lat) ? lat.toFixed(6) : prev.latitude,
          longitude: Number.isFinite(lng) ? lng.toFixed(6) : prev.longitude,
          location: prev.location || city || place.name || prev.location
        }));

        setAddressDropdownOpen(false);
        setAddressSuggestions([]);
      }
    );
  };

  const applyPickedLocation = ({ address, latitude, longitude, city, name }) => {
    const latNum = Number(latitude);
    const lngNum = Number(longitude);
    const latText = Number.isFinite(latNum) ? latNum.toFixed(6) : '';
    const lngText = Number.isFinite(lngNum) ? lngNum.toFixed(6) : '';

    setPickerSelection({
      address: address || '',
      latitude: latText,
      longitude: lngText
    });

    setTurfForm(prev => ({
      ...prev,
      address: address || prev.address,
      latitude: latText || prev.latitude,
      longitude: lngText || prev.longitude,
      location: city || prev.location || name || prev.location
    }));
  };

  const updatePickerMarker = (latitude, longitude, zoom = 17) => {
    if (!leafletMapRef.current) return;

    const position = [Number(latitude), Number(longitude)];
    const pinIcon = L.divIcon({
      className: 'owner-location-pin',
      html: '<div style="width:18px;height:18px;border-radius:50%;background:#10b981;border:3px solid #ecfdf5;box-shadow:0 0 0 4px rgba(16,185,129,0.22);"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    leafletMapRef.current.setView(position, zoom);

    if (!leafletMarkerRef.current) {
      leafletMarkerRef.current = L.marker(position, {
        draggable: true,
        icon: pinIcon
      }).addTo(leafletMapRef.current);

      leafletMarkerRef.current.on('dragend', () => {
        const markerPos = leafletMarkerRef.current.getLatLng();
        reverseGeocodePickerLocation(markerPos.lat, markerPos.lng);
      });
    } else {
      leafletMarkerRef.current.setLatLng(position);
    }
  };

  const reverseGeocodePickerLocation = async (latitude, longitude) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (!res.ok) throw new Error('Reverse geocoding failed');

      const result = await res.json();
      const addr = result.address || {};
      const city = addr.city || addr.town || addr.village || addr.state_district || addr.state || '';

      updatePickerMarker(latitude, longitude);
      applyPickedLocation({
        address: result.display_name || '',
        latitude,
        longitude,
        city
      });
      setMapSearchQuery(result.display_name || '');
      setLocationPickerError('');
    } catch (err) {
      setLocationPickerError('Could not read that map point. Try another point or search again.');
    }
  };

  const searchLocationOnMap = async () => {
    const query = String(mapSearchQuery || '').trim();
    if (!query) {
      setLocationPickerError('Paste or type a venue name, area, landmark, or full address first.');
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (!res.ok) throw new Error('Search failed');

      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) {
        setLocationPickerError('No location found. Try a fuller address or click directly on the map.');
        return;
      }

      const result = results[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      const addr = result.address || {};
      const city = addr.city || addr.town || addr.village || addr.state_district || addr.state || '';

      updatePickerMarker(lat, lng);
      applyPickedLocation({
        address: result.display_name || query,
        latitude: lat,
        longitude: lng,
        city
      });
      setMapSearchQuery(result.display_name || query);
      setLocationPickerError('');
    } catch (err) {
      setLocationPickerError('No location found. Try a fuller address or click directly on the map.');
    }
  };

  const handleBrowseLocation = () => {
    setMapSearchQuery(String(turfForm.address || turfForm.location || turfForm.name || '').trim());
    setPickerSelection({
      address: turfForm.address || '',
      latitude: turfForm.latitude || '',
      longitude: turfForm.longitude || ''
    });
    setLocationPickerError('');
    setShowLocationPicker(true);
  };

  useEffect(() => {
    if (!showLocationPicker) {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        leafletMarkerRef.current = null;
      }
      return;
    }

    const initMap = () => {
      if (!mapPickerRef.current) {
        setLocationPickerError('Map container is not ready yet. Please try again.');
        return;
      }

      const existingLat = parseFloat(turfForm.latitude);
      const existingLng = parseFloat(turfForm.longitude);
      const hasSavedCoords = Number.isFinite(existingLat) && Number.isFinite(existingLng);
      const center = hasSavedCoords ? [existingLat, existingLng] : [20.5937, 78.9629];

      leafletMapRef.current = L.map(mapPickerRef.current, {
        zoomControl: true,
        attributionControl: true
      }).setView(center, hasSavedCoords ? 17 : 5);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMapRef.current);

      leafletMapRef.current.on('click', (event) => {
        reverseGeocodePickerLocation(event.latlng.lat, event.latlng.lng);
      });

      if (hasSavedCoords) {
        updatePickerMarker(existingLat, existingLng);
      }

      setTimeout(() => {
        try {
          leafletMapRef.current.invalidateSize();
          leafletMapRef.current.setView(center, hasSavedCoords ? 17 : 5);
        } catch {}
      }, 150);
    };

    const timer = setTimeout(initMap, 80);
    return () => clearTimeout(timer);
  }, [showLocationPicker, turfForm.latitude, turfForm.longitude]);

  // Courts state
  const [courts, setCourts] = useState([]);
  const [courtsLoading, setCourtsLoading] = useState(false);
  const [courtsTurfId, setCourtsTurfId] = useState('');
  const [showCourtForm, setShowCourtForm] = useState(false);
  const [editingCourt, setEditingCourt] = useState(null);
  const [courtForm, setCourtForm] = useState({
    name: '', sport_type: 'cricket', price_per_hour: '',
    description: '', images: [], amenities: [],
    open_time: '06:00', close_time: '23:00',
    markup_type: 'fixed', markup_value: '0',
    slot_duration: 60, time_format: '12h', advance_percent: 100, is_24_hours: false,
    default_price: '', early_morning_price: '', morning_price: '', afternoon_price: '', evening_price: ''
  });

  const getLocalTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Slot blocking
  const [blockForm, setBlockForm] = useState({ turf_id: '', court_id: '', block_date: getLocalTodayDate(), time_slot: '', reason: '' });
  const [slotCourts, setSlotCourts] = useState([]);
  const [slotCourtsLoading, setSlotCourtsLoading] = useState(false);

  // Special pricing
  const [specialPricingMode, setSpecialPricingMode] = useState('day'); // 'day', 'date'
  const [specialPricingTurf, setSpecialPricingTurf] = useState('');
  const [specialPricingCourtId, setSpecialPricingCourtId] = useState('');
  const [specialPricingDay, setSpecialPricingDay] = useState('');
  const [specialPricingDate, setSpecialPricingDate] = useState('');
  const [specialPricingTimeSlot, setSpecialPricingTimeSlot] = useState('');
  const [specialPricingPrice, setSpecialPricingPrice] = useState('');
  const [specialPricingList, setSpecialPricingList] = useState([]);
  const [specialPricingLoading, setSpecialPricingLoading] = useState(false);

  // Period-based base pricing
  const [periodPricingTurf, setPeriodPricingTurf] = useState('');
  const [periodPricingCourtId, setPeriodPricingCourtId] = useState('');
  const [periodPricingForm, setPeriodPricingForm] = useState({
    default_price: '',
    early_morning_price: '',
    morning_price: '',
    afternoon_price: '',
    evening_price: ''
  });
  const [periodPricingLoading, setPeriodPricingLoading] = useState(false);
  const [periodPricingSaving, setPeriodPricingSaving] = useState(false);

  // Day-Wise Pricing
  const [dayWiseTurf, setDayWiseTurf] = useState('');
  const [dayWiseCourtId, setDayWiseCourtId] = useState('');
  const [dayWiseDay, setDayWiseDay] = useState('');
  const [dayWiseForm, setDayWiseForm] = useState({
    early_morning_price: '',
    morning_price: '',
    afternoon_price: '',
    evening_price: ''
  });
  const [dayWiseLoading, setDayWiseLoading] = useState(false);
  const [dayWiseSaving, setDayWiseSaving] = useState(false);

  // Bulk Slot Management
  const [managedSlots, setManagedSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState([]);

  useEffect(() => {
    setPageMeta({
      title: 'Owner Dashboard — Book Arena',
      description: 'Owner dashboard for managing turfs, courts, slots, bookings, and pricing on Book Arena.',
      keywords: 'book arena owner dashboard, manage turfs, manage bookings',
      robots: 'noindex, nofollow',
      canonicalUrl: 'https://bookarena.in/owner/dashboard'
    });
  }, []);

  // Coupon management
  const [coupons, setCoupons] = useState([]);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'flat',
    discount_value: '',
    valid_from: '',
    valid_until: '',
    expiry_date: '',
    turf_id: '',
    court_id: '',
    max_uses: '',
    per_user_limit: '',
    min_booking_amount: '',
    max_discount_cap: '',
    offer_percentage: '',
    offer_label: ''
  });
  const [couponLoading, setCouponLoading] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  // Subscription State
  const [subPlans, setSubPlans] = useState([]);
  const [activeSubscribers, setActiveSubscribers] = useState([]);
  const [subForm, setSubForm] = useState({
    turf_id: '', court_id: '', name: '', description: '', price: '',
    duration_months: 1, start_time: '06:00', end_time: '07:00',
    max_subscribers: 1, popular_badge: false, time_format: '12h'
  });
  const [subLoading, setSubLoading] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState({
    plan_id: '', name: '', phone: '', email: '', amount_paid: '', payment_type: 'offline'
  });
  const [addingMember, setAddingMember] = useState(false);

  // Match Requests State
  const [matchRequests, setMatchRequests] = useState([]);
  const [matchLoading, setMatchLoading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router('/owner/login');
      return;
    }
    let active = true;
    apiGet('/owners/profile')
      .then(({ owner: authenticatedOwner }) => {
        if (!active) return;
        if (!authenticatedOwner?.id) throw new Error('Owner profile could not be verified.');
        setOwner(authenticatedOwner);
        localStorage.setItem('owner', JSON.stringify(authenticatedOwner));
        return loadData();
      })
      .catch((err) => {
        if (active) {
          setDashboardError(err.message || 'Could not verify the owner account.');
          setLoading(false);
        }
      });

    window.__loadCoupons = loadCoupons;
    return () => { active = false; };
  }, []);

  // Load coupons when switching to coupons tab
  useEffect(() => {
    if (activeTab === 'coupons') {
      loadCoupons();
    }
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    setDashboardError('');
    setDashboardWarning('');
    try {
      const [turfsData, bookingsData, summaryData] = await Promise.all([
        apiGet('/owners/turfs'),
        apiGet('/owners/bookings'),
        apiGet('/owners/venues/summary'),
      ]);
      const fetchedTurfs = turfsData.turfs || [];
      setTurfs(fetchedTurfs);
      setBookings(bookingsData.bookings || []);
      setVenueSummary(summaryData);

      let initialTurfId = earningsTurfId;
      if (fetchedTurfs.length > 0 && !initialTurfId) {
        initialTurfId = String(fetchedTurfs[0].id);
        setEarningsTurfId(initialTurfId);
      }

      let earningsData = null;
      if (initialTurfId) {
        try {
          earningsData = await apiGet(buildOwnerEarningsUrl(initialTurfId));
        } catch (err) {
          setDashboardWarning(err.message || 'Earnings are temporarily unavailable.');
        }
      }
      setEarnings(earningsData);
    } catch (err) {
      setDashboardError(err.message || 'Could not load owner dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'earnings') {
      loadEarnings();
    }
  }, [activeTab, earningsTurfId, earningsRangeType]);

  useEffect(() => {
    if (activeTab === 'billing') loadOwnerBilling();
  }, [activeTab]);

  async function loadOwnerBilling() {
    setBillingLoading(true);
    setBillingError('');
    try {
      const data = await apiGet('/owner-billing/overview');
      setOwnerBilling(data.venues || []);
    } catch (err) {
      setBillingError(err.message || 'Could not load venue billing.');
    } finally {
      setBillingLoading(false);
    }
  }

  async function payVenueBilling(venue, cycle) {
    const busyKey = `${venue.id}:${cycle.id}`;
    setBillingBusyCycle(busyKey);
    setBillingError('');
    try {
      const order = await apiPost(`/owner-billing/turfs/${venue.id}/subscription/cycles/${cycle.id}/order`, {});
      const payment = await openRazorpayCheckout({
        orderId: order.order_id,
        currency: order.currency,
        name: owner?.name || 'Venue owner',
        email: owner?.email || '',
        description: `${venue.name} subscription`,
      });
      if (payment.status !== 'success') throw new Error('Payment was not completed. Your billing status is unchanged.');
      const verified = await apiPost('/owner-billing/payments/verify', {
        booking_id: cycle.id,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_signature: payment.razorpay_signature,
      });
      if (!verified.success) throw new Error('Payment is not verified yet. Refresh billing in a moment.');
      await loadOwnerBilling();
    } catch (err) {
      if (err.message === 'PAYMENT_DISMISSED') setBillingError('Checkout was closed. No payment was confirmed.');
      else setBillingError(err.message || 'Payment could not be completed.');
      await loadOwnerBilling();
    } finally {
      setBillingBusyCycle('');
    }
  }

  function buildOwnerEarningsUrl(turfId = earningsTurfId, rangeType = earningsRangeType, startDate = earningsStartDate, endDate = earningsEndDate) {
    if (!turfId) return '/owners/earnings';

    const params = new URLSearchParams();
    params.set('turf_id', turfId);

    if (rangeType === 'custom') {
      params.set('start_date', startDate);
      params.set('end_date', endDate);
    } else {
      params.set('range_days', rangeType || '30');
    }

    return `/owners/earnings?${params.toString()}`;
  }

  async function loadEarnings(options = {}) {
    const turfId = options.turfId ?? earningsTurfId;
    const rangeType = options.rangeType ?? earningsRangeType;
    const startDate = options.startDate ?? earningsStartDate;
    const endDate = options.endDate ?? earningsEndDate;

    if (!turfId) return; // turf_id is required by the API
    try {
      const data = await apiGet(buildOwnerEarningsUrl(turfId, rangeType, startDate, endDate));
      setEarnings(data);
    } catch (err) {
      console.error('Earnings load failed:', err);
    }
  }

  function handleOwnerRangeChange(value) {
    setEarningsRangeType(value);
    if (value !== 'custom') {
      const days = Math.max(1, parseInt(value, 10) || 30);
      setEarningsStartDate(getDashboardDaysAgoInputDate(days - 1));
      setEarningsEndDate(getDashboardTodayInputDate());
    }
  }

  function applyOwnerCustomRange() {
    if (!earningsStartDate || !earningsEndDate) {
      alert('Please select both start and end dates.');
      return;
    }
    if (earningsStartDate > earningsEndDate) {
      alert('Start date cannot be after end date.');
      return;
    }
    if (getDashboardDateDiffInclusive(earningsStartDate, earningsEndDate) > OWNER_EARNINGS_HISTORY_DAYS) {
      alert('Please select a range within 90 days.');
      return;
    }
    loadEarnings({
      turfId: earningsTurfId,
      rangeType: 'custom',
      startDate: earningsStartDate,
      endDate: earningsEndDate
    });
  }

  // Session Management State
  const [sessionForm, setSessionForm] = useState({ turf_id: '', name: '', start_time: '06:00', end_time: '12:00', is_enabled: true });
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'sessions' && sessionForm.turf_id) {
      loadSessions(sessionForm.turf_id);
    }
  }, [activeTab, sessionForm.turf_id]);

  async function loadSessions(turfId) {
    setSessionsLoading(true);
    try {
      const data = await apiGet(`/owners/turfs/${turfId}/sessions`);
      setSessions(data.sessions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  }

  const ownerDateInputMin = getDashboardDaysAgoInputDate(OWNER_EARNINGS_HISTORY_DAYS - 1);
  const ownerDateInputMax = getDashboardTodayInputDate();
  const ownerRangeSummary = earnings?.summary || null;
  const ownerRangeLabel = ownerRangeSummary
    ? `${formatDate(ownerRangeSummary.start_date)} to ${formatDate(ownerRangeSummary.end_date)}`
    : 'Selected range';
  const ownerDailyMax = Math.max(1, ...(earnings?.daily || []).map(item => Number(item.earnings || 0)));

  // --- Subscriptions Functions ---
  async function loadSubscriptionData() {
    if (!owner) return;
    setSubLoading(true);
    try {
      const [plansData, subscribersData] = await Promise.all([
        apiGet(`/subscriptions/owner/plans?owner_id=${owner.id}`),
        apiGet(`/subscriptions/owner/subscribers?owner_id=${owner.id}`)
      ]);
      setSubPlans(plansData.plans || []);
      setActiveSubscribers(subscribersData.subscribers || []);
    } catch (err) {
      console.error('Subscription data load failed:', err);
    } finally {
      setSubLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'subscriptions') {
      loadSubscriptionData();
    }
  }, [activeTab]);

  async function handleSaveSubPlan(e) {
    e.preventDefault();
    try {
      const payload = {
        ...subForm,
        owner_id: owner.id,
        turf_id: parseInt(subForm.turf_id),
        court_id: subForm.court_id ? parseInt(subForm.court_id) : null,
        price: parseFloat(subForm.price)
      };
      
      await apiPost('/subscriptions/owner/plans', payload);
      alert('Subscription plan created!');
      setSubForm({ ...subForm, name: '', description: '', price: '' });
      loadSubscriptionData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!memberForm.plan_id) return alert('Please select a subscription plan');
    if (!memberForm.name.trim()) return alert('Member name is required');
    setAddingMember(true);
    try {
      await apiPost('/subscriptions/owner/members', {
        plan_id: parseInt(memberForm.plan_id),
        name: memberForm.name.trim(),
        phone: memberForm.phone.trim() || undefined,
        email: memberForm.email.trim() || undefined,
        amount_paid: memberForm.amount_paid ? parseFloat(memberForm.amount_paid) : 0,
        payment_type: memberForm.payment_type || 'offline'
      });
      alert('Member added successfully and slots reserved!');
      setShowAddMemberModal(false);
      setMemberForm({ plan_id: '', name: '', phone: '', email: '', amount_paid: '', payment_type: 'offline' });
      loadSubscriptionData();
    } catch (err) {
      alert(err.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  }

  async function handleAddSession(e) {
    e.preventDefault();
    try {
      await apiPost(`/owners/turfs/${sessionForm.turf_id}/sessions`, sessionForm);
      loadSessions(sessionForm.turf_id);
      setSessionForm({ ...sessionForm, name: '' });
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDeleteSession(id) {
    if (!confirm('Delete this session?')) return;
    try {
      await apiDelete(`/owners/turfs/${sessionForm.turf_id}/sessions/${id}`);
      loadSessions(sessionForm.turf_id);
    } catch (err) {
      alert(err.message);
    }
  }

  // MATCH REQUESTS FUNCTIONS
  async function loadMatchRequests() {
    if (!owner) return;
    setMatchLoading(true);
    try {
      const data = await apiGet(`/match-requests/host/${owner.id}`);
      setMatchRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to load match requests:', err);
      setMatchRequests([]);
    } finally {
      setMatchLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'matches') {
      loadMatchRequests();
    }
  }, [activeTab]);

  async function handleCancelMatch(matchId) {
    if (!confirm('Cancel this match request? Players will be notified.')) return;
    try {
      await apiDelete(`/match-requests/${matchId}`, { host_id: owner.id });
      alert('Match cancelled and players notified');
      loadMatchRequests();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleApprovePlayer(matchId, playerId) {
    try {
      await apiPut(`/match-requests/${matchId}/approve-player`, {
        player_id: playerId,
        host_id: owner.id
      });
      alert('Player approved');
      loadMatchRequests();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleRejectPlayer(matchId, playerId) {
    if (!confirm('Reject this player? They will be notified.')) return;
    try {
      await apiPut(`/match-requests/${matchId}/reject-player`, {
        player_id: playerId,
        host_id: owner.id
      });
      alert('Player rejected');
      loadMatchRequests();
    } catch (err) {
      alert(err.message);
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('owner');
    router('/owner/login');
  }

  function isEntityOpen24Hours(entity) {
    const openTime = String(entity?.open_time || '').trim();
    const closeTime = String(entity?.close_time || '').trim();
    return openTime === '00:00' && (closeTime === '00:00' || closeTime === '24:00');
  }

  function buildAvailabilityPayload(form) {
    const is24Hours = Boolean(form?.is_24_hours);
    return {
      ...form,
      open_time: is24Hours ? '00:00' : (form.open_time || '06:00'),
      close_time: is24Hours ? '00:00' : (form.close_time || '23:00')
    };
  }

  async function handleSaveTurf(e) {
    e.preventDefault();
    try {
      const payload = buildAvailabilityPayload(turfForm);
      if (editingTurf) {
        await apiPut(`/owners/turfs/${editingTurf.id}`, payload);
      } else {
        await apiPost('/owners/turfs', payload);
      }
      setShowTurfForm(false);
      setEditingTurf(null);
      resetTurfForm();
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDeleteTurf(id) {
    if (!confirm('Are you sure you want to delete this turf?')) return;
    try {
      await apiDelete(`/owners/turfs/${id}`);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleBlockSlot(e) {
    e.preventDefault();
    try {
      await apiPost(`/owners/turfs/${blockForm.turf_id}/block-slot`, {
        court_id: blockForm.court_id || undefined,
        block_date: blockForm.block_date,
        time_slot: blockForm.time_slot,
        reason: blockForm.reason,
      });
      alert('Slot blocked successfully!');
      setBlockForm({ turf_id: '', court_id: '', block_date: getLocalTodayDate(), time_slot: '', reason: '' });
      setSlotCourts([]);
    } catch (err) {
      alert(err.message);
    }
  }

  // Day-Wise Pricing Hooks & Handlers
  useEffect(() => {
    async function loadDayWisePricing() {
      if (!dayWiseTurf || !dayWiseDay) {
        setDayWiseForm({ early_morning_price: '', morning_price: '', afternoon_price: '', evening_price: '' });
        return;
      }
      setDayWiseLoading(true);
      try {
        const courtQuery = dayWiseCourtId ? `?court_id=${dayWiseCourtId}` : '';
        const data = await apiGet(`/owners/turfs/${dayWiseTurf}/day-wise-pricing${courtQuery}`);
        const list = data.dayWisePricing || [];
        const matched = list.find(item => item.day_of_week === dayWiseDay);
        if (matched) {
          setDayWiseForm({
            early_morning_price: matched.early_morning_price ?? '',
            morning_price: matched.morning_price ?? '',
            afternoon_price: matched.afternoon_price ?? '',
            evening_price: matched.evening_price ?? ''
          });
        } else {
          setDayWiseForm({ early_morning_price: '', morning_price: '', afternoon_price: '', evening_price: '' });
        }
      } catch (err) {
        console.error('Error fetching day-wise pricing:', err);
        setDayWiseForm({ early_morning_price: '', morning_price: '', afternoon_price: '', evening_price: '' });
      } finally {
        setDayWiseLoading(false);
      }
    }

    loadDayWisePricing();
  }, [dayWiseTurf, dayWiseCourtId, dayWiseDay]);

  async function handleSaveDayWisePricing(e) {
    e.preventDefault();
    if (!dayWiseTurf || !dayWiseDay) {
      alert('Turf and Day are required');
      return;
    }
    setDayWiseSaving(true);
    try {
      await apiPut(`/owners/turfs/${dayWiseTurf}/day-wise-pricing`, {
        court_id: dayWiseCourtId || undefined,
        day_of_week: dayWiseDay,
        early_morning_price: dayWiseForm.early_morning_price === '' ? null : parseFloat(dayWiseForm.early_morning_price),
        morning_price: dayWiseForm.morning_price === '' ? null : parseFloat(dayWiseForm.morning_price),
        afternoon_price: dayWiseForm.afternoon_price === '' ? null : parseFloat(dayWiseForm.afternoon_price),
        evening_price: dayWiseForm.evening_price === '' ? null : parseFloat(dayWiseForm.evening_price),
      });
      alert('Day-wise pricing saved successfully!');
    } catch (err) {
      alert(err.message || 'Failed to save day-wise pricing');
    } finally {
      setDayWiseSaving(false);
    }
  }

  // Bulk Slot Management Helpers & Handlers
  function convertSlotTo12Hour(slotStr) {
    if (!slotStr) return '';
    const parts = slotStr.split('-');
    if (parts.length !== 2) return slotStr;
    
    const formatTime = (timeStr) => {
      timeStr = timeStr.trim();
      if (/am|pm/i.test(timeStr)) {
        return timeStr.toUpperCase();
      }
      const [hStr, mStr] = timeStr.split(':');
      const h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (isNaN(h) || isNaN(m)) return timeStr;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    return `${formatTime(parts[0])} - ${formatTime(parts[1])}`;
  }

  function getSlotStartMinutes(slotStr) {
    if (!slotStr) return 0;
    const parts = slotStr.split('-');
    const startTime = parts[0].trim();
    
    let hours = 0;
    let minutes = 0;
    
    if (/am|pm/i.test(startTime)) {
      const ampm = startTime.slice(-2).toUpperCase();
      const timePart = startTime.slice(0, -2).trim();
      const [hStr, mStr] = timePart.split(':');
      let h = parseInt(hStr, 10);
      const m = parseInt(mStr, 10);
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      hours = h;
      minutes = m;
    } else {
      const [hStr, mStr] = startTime.split(':');
      hours = parseInt(hStr, 10);
      minutes = parseInt(mStr, 10);
    }
    
    return hours * 60 + minutes;
  }

  async function fetchManagedSlots() {
    if (!blockForm.turf_id || !blockForm.block_date) {
      setManagedSlots([]);
      return;
    }
    setSlotsLoading(true);
    try {
      const courtQuery = blockForm.court_id ? `&court_id=${blockForm.court_id}` : '';
      const data = await apiGet(`/turfs/${blockForm.turf_id}/slots?date=${blockForm.block_date}${courtQuery}`);
      setManagedSlots(data.slots || []);
      setSelectedSlots([]); // Reset selection on fetch
    } catch (err) {
      console.error('Error fetching managed slots:', err);
      alert(err.message || 'Failed to fetch slots');
      setManagedSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  useEffect(() => {
    fetchManagedSlots();
  }, [blockForm.turf_id, blockForm.court_id, blockForm.block_date]);

  async function handleBulkBlock() {
    if (selectedSlots.length === 0) return;
    const turf = turfs.find(t => String(t.id) === String(blockForm.turf_id));
    const court = slotCourts.find(c => String(c.id) === String(blockForm.court_id));
    const turfName = turf?.name || 'Selected Venue';
    const courtName = court?.name || 'All courts / whole venue';
    const formattedSlots = selectedSlots.map(convertSlotTo12Hour).join('\n• ');

    const confirmMsg = `CONFIRM BLOCK:
• Venue: ${turfName}
• Court: ${courtName}
• Date: ${blockForm.block_date}
• Slots (${selectedSlots.length}):
• ${formattedSlots}

Customers will NOT be able to book these slots while blocked.
Do you want to proceed?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await apiPost(`/owners/turfs/${blockForm.turf_id}/block-slots/bulk`, {
        court_id: blockForm.court_id || undefined,
        block_date: blockForm.block_date,
        time_slots: selectedSlots,
        reason: blockForm.reason || 'Maintenance'
      });
      alert(`${selectedSlots.length} slot(s) blocked successfully!`);
      setSelectedSlots([]);
      fetchManagedSlots();
    } catch (err) {
      alert(err.message || 'Failed to block slots');
    }
  }

  async function handleBulkUnblock() {
    if (selectedSlots.length === 0) return;
    const turf = turfs.find(t => String(t.id) === String(blockForm.turf_id));
    const court = slotCourts.find(c => String(c.id) === String(blockForm.court_id));
    const turfName = turf?.name || 'Selected Venue';
    const courtName = court?.name || 'All courts / whole venue';
    const formattedSlots = selectedSlots.map(convertSlotTo12Hour).join('\n• ');

    const confirmMsg = `CONFIRM UNBLOCK:
• Venue: ${turfName}
• Court: ${courtName}
• Date: ${blockForm.block_date}
• Slots (${selectedSlots.length}):
• ${formattedSlots}

These slots will immediately open for customer booking.
Do you want to proceed?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await apiPost(`/owners/turfs/${blockForm.turf_id}/unblock-slots/bulk`, {
        court_id: blockForm.court_id || undefined,
        block_date: blockForm.block_date,
        time_slots: selectedSlots
      });
      alert(`${selectedSlots.length} slot(s) unblocked successfully!`);
      setSelectedSlots([]);
      fetchManagedSlots();
    } catch (err) {
      alert(err.message || 'Failed to unblock slots');
    }
  }

  async function loadSpecialPricing(turfId, courtId = '') {
    if (!turfId) {
      setSpecialPricingList([]);
      return;
    }
    setSpecialPricingLoading(true);
    try {
      const query = courtId ? `?court_id=${courtId}` : '';
      const data = await apiGet(`/owners/turfs/${turfId}/special-pricing${query}`);
      setSpecialPricingList(data.specialPricing || []);
    } catch (err) {
      console.error(err);
      setSpecialPricingList([]);
    } finally {
      setSpecialPricingLoading(false);
    }
  }

  async function handleSaveSpecialPricing(e) {
    e.preventDefault();
    if (!specialPricingTurf || !specialPricingTimeSlot || !specialPricingPrice) {
      alert('Please fill all required fields');
      return;
    }

    const dayOfWeek = specialPricingMode === 'day' ? parseInt(specialPricingDay) : null;
    const specificDate = specialPricingMode === 'date' ? specialPricingDate : null;

    try {
      await apiPost(`/owners/turfs/${specialPricingTurf}/special-pricing`, {
        court_id: specialPricingCourtId || undefined,
        day_of_week: dayOfWeek,
        specific_date: specificDate,
        time_slot: specialPricingTimeSlot,
        special_price: parseFloat(specialPricingPrice),
        offer_percentage: couponForm.offer_percentage ? parseInt(couponForm.offer_percentage) : null,
        offer_label: couponForm.offer_label || null
      });
      alert('Special pricing saved successfully!');
      setSpecialPricingPrice('');
      loadSpecialPricing(specialPricingTurf, specialPricingCourtId);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDeleteSpecialPricing(id) {
    if (!confirm('Delete this special pricing?')) return;
    try {
      await apiDelete(`/owners/turfs/${specialPricingTurf}/special-pricing/${id}`);
      alert('Special pricing deleted!');
      loadSpecialPricing(specialPricingTurf, specialPricingCourtId);
    } catch (err) {
      alert(err.message);
    }
  }

  async function loadCoupons() {
    try {
      const data = await apiGet('/coupons');
      setCoupons(data.coupons || []);
    } catch (err) {
      console.error('Failed to load coupons:', err);
      setCoupons([]);
    }
  }

  const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  function parseClockToMinutes(value, fallback = '06:00') {
    const [hours = '0', minutes = '0'] = String(value || fallback).split(':');
    return (parseInt(hours, 10) * 60) + (parseInt(minutes, 10) || 0);
  }

  function formatSlotClock(totalMinutes, timeFormat = '12h') {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    if (timeFormat === '24h') {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
  }

  function generateSlotsForEntity(entity) {
    if (!entity) return [];
    const duration = Number(entity.slot_duration) || 60;
    const timeFormat = entity.time_format || '12h';
    const startMinutes = parseClockToMinutes(entity.open_time, '06:00');
    let endMinutes = parseClockToMinutes(entity.close_time, '23:00');
    if (startMinutes === 0 && endMinutes === 0) {
      endMinutes = 24 * 60;
    } else if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60;
    }

    const slots = [];
    for (let total = startMinutes; total < endMinutes; total += duration) {
      slots.push(`${formatSlotClock(total, timeFormat)} - ${formatSlotClock(total + duration, timeFormat)}`);
    }
    return slots;
  }

  const getSpecialPricingSlots = (turfId, courtId = '') => {
    const turf = turfs.find(t => t.id == turfId);
    const court = slotCourts.find(c => c.id == courtId);
    return generateSlotsForEntity(court || turf);
  };

  const specialPricingSlots = specialPricingTurf ? getSpecialPricingSlots(specialPricingTurf, specialPricingCourtId) : [];

  const periodPricingFields = [
    { key: 'default_price', label: 'Default / Fallback Price', period: 'Fallback' },
    { key: 'early_morning_price', label: 'Early Morning (12 AM to 6 AM)', period: 'earlyMorning' },
    { key: 'morning_price', label: 'Morning (6 AM to 12 PM)', period: 'morning' },
    { key: 'afternoon_price', label: 'Afternoon (12 PM to 6 PM)', period: 'afternoon' },
    { key: 'evening_price', label: 'Evening and Night (6 PM to 12 AM)', period: 'evening' },
  ];

  function periodPricingHasValue(form = periodPricingForm) {
    return Object.values(form).some(value => String(value ?? '').trim() !== '');
  }

  function normalizePeriodPricingForm(data = {}) {
    return periodPricingFields.reduce((acc, field) => {
      acc[field.key] = data[field.key] ?? '';
      return acc;
    }, {
      default_price: '',
      early_morning_price: '',
      morning_price: '',
      afternoon_price: '',
      evening_price: ''
    });
  }

  async function loadPeriodPricing(turfId, courtId = '') {
    if (!turfId) {
      setPeriodPricingForm(normalizePeriodPricingForm());
      return;
    }

    setPeriodPricingLoading(true);
    try {
      const query = courtId ? `?court_id=${courtId}` : '';
      const data = await apiGet(`/owners/turfs/${turfId}/base-pricing${query}`);
      setPeriodPricingForm(normalizePeriodPricingForm(data.basePricing || {}));
    } catch (err) {
      console.error(err);
      setPeriodPricingForm(normalizePeriodPricingForm());
    } finally {
      setPeriodPricingLoading(false);
    }
  }

  async function handleSavePeriodPricing(e) {
    e.preventDefault();
    if (!periodPricingTurf) {
      alert('Please select a turf');
      return;
    }
    if (!periodPricingHasValue()) {
      alert('Please enter at least one period-based price');
      return;
    }

    setPeriodPricingSaving(true);
    try {
      await apiPut(`/owners/turfs/${periodPricingTurf}/base-pricing`, {
        court_id: periodPricingCourtId || undefined,
        ...periodPricingForm
      });
      alert('Base pricing saved successfully!');
      loadPeriodPricing(periodPricingTurf, periodPricingCourtId);
    } catch (err) {
      alert(err.message);
    } finally {
      setPeriodPricingSaving(false);
    }
  }

  function resetTurfForm() {
    setTurfForm({ 
      name: '', location: '', address: '', sport_type: 'cricket', price_per_hour: '', 
      description: '', images: [], amenities: [], open_time: '06:00', close_time: '23:00',
      markup_type: 'fixed', markup_value: '0', latitude: '', longitude: '',
      slot_duration: 60, time_format: '12h', advance_percent: 100, is_24_hours: false,
      photos: [], coverImage: '', photosCount: 0,
      default_price: '', early_morning_price: '', morning_price: '', afternoon_price: '', evening_price: '',
      owner_email: ''
    });
    setTurfUploadKey((prev) => prev + 1);
  }

  function closeTurfForm() {
    setShowTurfForm(false);
    setEditingTurf(null);
    resetTurfForm();
  }

  async function loadCourts(turfId) {
    if (!turfId) { setCourts([]); return; }
    setCourtsLoading(true);
    try {
      const data = await apiGet(`/owners/turfs/${turfId}/courts`);
      setCourts(data.courts || []);
    } catch { setCourts([]); } finally { setCourtsLoading(false); }
  }

  async function loadSlotCourts(turfId) {
    if (!turfId) { setSlotCourts([]); return; }
    setSlotCourtsLoading(true);
    try {
      const data = await apiGet(`/owners/turfs/${turfId}/courts`);
      setSlotCourts(data.courts || []);
    } catch {
      setSlotCourts([]);
    } finally {
      setSlotCourtsLoading(false);
    }
  }

  async function handleSaveCourt(e) {
    e.preventDefault();
    try {
      const payload = buildAvailabilityPayload(courtForm);
      if (editingCourt) {
        await apiPut(`/owners/turfs/${courtsTurfId}/courts/${editingCourt.id}`, payload);
      } else {
        await apiPost(`/owners/turfs/${courtsTurfId}/courts`, payload);
      }
      setShowCourtForm(false); setEditingCourt(null);
      setCourtForm({ name: '', sport_type: 'cricket', price_per_hour: '', description: '', images: [], amenities: [], open_time: '06:00', close_time: '23:00', markup_type: 'fixed', markup_value: '0', slot_duration: 60, time_format: '12h', advance_percent: 100, is_24_hours: false, default_price: '', early_morning_price: '', morning_price: '', afternoon_price: '', evening_price: '' });
      loadCourts(courtsTurfId);
    } catch (err) { alert(err.message); }
  }

  async function handleDeleteCourt(courtId) {
    if (!confirm('Delete this court?')) return;
    try {
      await apiDelete(`/owners/turfs/${courtsTurfId}/courts/${courtId}`);
      loadCourts(courtsTurfId);
    } catch (err) { alert(err.message); }
  }

  function editTurf(turf) {
    const resolvedPhotos = normalizePhotoList(
      Array.isArray(turf.photos) && turf.photos.length > 0 ? turf.photos : turf.images
    );
    setEditingTurf(turf);
    setTurfForm({
      name: turf.name, location: turf.location, address: turf.address || '',
      sport_type: turf.sport_type, price_per_hour: turf.price_per_hour,
      description: turf.description || '', images: resolvedPhotos, amenities: turf.amenities || [],
      open_time: turf.open_time || '06:00', close_time: turf.close_time || '23:00',
      markup_type: turf.markup_type || 'fixed', markup_value: turf.markup_value || 0,
      latitude: turf.latitude || '', longitude: turf.longitude || '',
      slot_duration: turf.slot_duration || 60, time_format: turf.time_format || '12h',
      advance_percent: turf.advance_percent || 100, is_24_hours: isEntityOpen24Hours(turf),
      photos: resolvedPhotos, coverImage: turf.coverImage || resolvedPhotos[0] || '', photosCount: turf.photosCount || resolvedPhotos.length,
      default_price: turf.default_price || '', early_morning_price: turf.early_morning_price || '',
      morning_price: turf.morning_price || '', afternoon_price: turf.afternoon_price || '',
      evening_price: turf.evening_price || '',
      owner_email: turf.owner_email || ''
    });
    setTurfUploadKey((prev) => prev + 1);
    setShowTurfForm(true);
  }

  function toggleAmenity(amenity) {
    setTurfForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  }

  const selectedCourtsTurf = turfs.find(t => t.id == courtsTurfId);
  const selectedBlockTurf = turfs.find(t => t.id == blockForm.turf_id);
  const selectedBlockCourt = slotCourts.find(c => c.id == blockForm.court_id);
  const allSlots = blockForm.turf_id ? generateSlotsForEntity(selectedBlockCourt || selectedBlockTurf) : [];

  // Multi-Category & Onboarding Status
  const hasApprovedVenue = venueSummary?.hasApprovedVenue ?? turfs.some(t => (t.approval_status || 'APPROVED') === 'APPROVED');
  const allOwnerVenues = venueSummary?.venues && venueSummary.venues.length > 0 ? venueSummary.venues : turfs;
  const getVenueKey = (venue) => `${venue?.is_activity ? 'activity' : 'turf'}:${venue?.id}`;
  const activeVenue = allOwnerVenues.find(v => getVenueKey(v) === selectedVenueId)
    || (venueSummary?.primaryVenue ? allOwnerVenues.find(v => getVenueKey(v) === getVenueKey(venueSummary.primaryVenue)) : null)
    || allOwnerVenues[0];
  const rawVenueCategory = activeVenue?.category || activeVenue?.categories?.[0] || 'sports_court';
  const categoryAliases = {
    AMUSEMENT_PARK: 'amusement_park',
    WATER_PARK: 'amusement_park',
    TRAMPOLINE: 'amusement_park',
    ADVENTURE: 'amusement_park',
    GO_KARTING: 'amusement_park',
    KIDS_PLAY: 'amusement_park',
    swimming_pool: 'swimming_recreation',
  };
  const activeVenueCategory = categoryAliases[rawVenueCategory] || rawVenueCategory;
  const categoryConfig = VENUE_CATEGORIES[activeVenueCategory] || VENUE_CATEGORIES.sports_court;

  useEffect(() => {
    if (!activeVenue?.is_activity) {
      setActivityStats(null);
      setActivityBookings([]);
      return;
    }
    let active = true;
    setActivityLoading(true);
    const activityId = encodeURIComponent(activeVenue.id);
    Promise.all([
      apiGet(`/owner-activities/today?activity_id=${activityId}`),
      apiGet(`/owner-activities/bookings?activity_id=${activityId}&range=today`),
    ]).then(([stats, bookingData]) => {
      if (!active) return;
      setDashboardError('');
      setActivityStats(stats);
      setActivityBookings(bookingData.bookings || []);
    }).catch((err) => {
      if (active) setDashboardError(err.message || 'Could not load activity dashboard data.');
    }).finally(() => {
      if (active) setActivityLoading(false);
    });
    return () => { active = false; };
  }, [activeVenue?.id, activeVenue?.is_activity, activityRefresh]);

  const tabs = [
    { key: 'dashboard', label: '📊 Dashboard', icon: '📊' },
    { key: 'turfs', label: '🏟️ My Turfs', icon: '🏟️' },
    { key: 'courts', label: '🎾 Courts', icon: '🎾' },
    { key: 'bookings', label: '📋 Bookings', icon: '📋' },
    { key: 'slots', label: '🔒 Slot Control', icon: '🔒' },
    { key: 'pricing', label: '💲 Special Pricing', icon: '💲' },
    { key: 'coupons', label: '🎟️ Coupons', icon: '🎟️' },
    { key: 'sessions', label: '⏰ Sessions', icon: '⏰' },
    { key: 'subscriptions', label: '💳 Monthly Plans', icon: '💳' },
    { key: 'billing', label: '🧾 Venue Billing', icon: '🧾' },
    { key: 'matches', label: '🤝 Match Management', icon: '🤝' },
    { key: 'tournaments', label: '🏆 Tournaments', icon: '🏆' },
    { key: 'earnings', label: '💰 Earnings', icon: '💰' },
  ];

  if (loading) return <div className="loading-container"><div className="loader"></div></div>;

  return (
    <div className="dashboard">
      {/* ═══════ ONBOARDING / VENUE REGISTRATION WIZARD MODAL ═══════ */}
      {showWizard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 10, 24, 0.88)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
          overflowY: 'auto',
          padding: '2rem 1rem'
        }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <VenueRegistrationWizard
              initialDraft={wizardDraft}
              owner={owner}
              onCancel={() => { setShowWizard(false); setWizardDraft(null); }}
              onComplete={(newTurf) => {
                setShowWizard(false);
                setWizardDraft(null);
                loadData();
              }}
            />
          </div>
        </div>
      )}

      {showLocationPicker && (
        <div className="modal-overlay" onClick={() => setShowLocationPicker(false)}>
          <div className="modal" style={{ maxWidth: '920px', padding: '1.5rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h3 className="modal-title" style={{ marginBottom: '0.25rem' }}>Select Venue Location</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Paste an address or venue name, search it on the map, or click directly on the map to auto-fill the form.
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowLocationPicker(false)}>
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.75rem', marginBottom: '1rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Paste venue name, landmark, area, or full address"
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    searchLocationOnMap();
                  }
                }}
              />
              <button type="button" className="btn btn-primary" onClick={searchLocationOnMap}>
                Search on Map
              </button>
            </div>

            <div
              ref={mapPickerRef}
              style={{
                width: '100%',
                height: '420px',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid var(--border-default)',
                background: 'rgba(255,255,255,0.04)',
                marginBottom: '1rem'
              }}
            />

            {locationPickerError && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                border: '1px solid rgba(248, 113, 113, 0.35)',
                background: 'rgba(248, 113, 113, 0.08)',
                color: '#fca5a5',
                fontSize: '0.9rem'
              }}>
                {locationPickerError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <input type="text" className="form-input" value={pickerSelection.address} readOnly placeholder="Selected address" />
              <input type="text" className="form-input" value={pickerSelection.latitude} readOnly placeholder="Latitude" />
              <input type="text" className="form-input" value={pickerSelection.longitude} readOnly placeholder="Longitude" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                Tip: search first, then fine-tune by clicking the map or dragging the pin.
              </p>
              <button type="button" className="btn btn-primary" onClick={() => setShowLocationPicker(false)}>
                Use This Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="navbar-logo" style={{ fontSize: '1.2rem' }}>
            <img src="/images/logo.png" alt="Book Arena logo" loading="lazy" decoding="async" style={{ width: 32, height: 32, borderRadius: '4px' }} />
            Book <span className="accent">Arena</span>
          </Link>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Owner Panel</p>
        </div>

        <ul className="sidebar-nav">
          {tabs.map(tab => (
            <li key={tab.key}>
              <a
                className={activeTab === tab.key ? 'active' : ''}
                onClick={() => { setActiveTab(tab.key); setSidebarOpen(false); }}
                style={{ cursor: 'pointer' }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label.split(' ').slice(1).join(' ')}</span>
              </a>
            </li>
          ))}
          <li>
            <Link to="/owner/activities" onClick={() => setSidebarOpen(false)} style={{ cursor: 'pointer' }}>
              <span>ðŸŽ¢</span>
              <span>Activities & tickets</span>
            </Link>
          </li>
          <li style={{ marginTop: '2rem' }}>
            <a onClick={handleLogout} style={{ cursor: 'pointer', color: '#f87171' }}>
              <span>🚪</span>
              <span>Logout</span>
            </a>
          </li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {dashboardError && (
          <div role="alert" className="card" style={{ margin: '1rem', padding: '1rem', border: '1px solid rgba(248, 113, 113, .45)', color: '#fca5a5' }}>
            <p>{dashboardError}</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => activeVenue?.is_activity ? setActivityRefresh((refresh) => refresh + 1) : loadData()}
              style={{ marginTop: '.75rem' }}
            >
              Retry
            </button>
          </div>
        )}
        {dashboardWarning && !dashboardError && (
          <div role="status" style={{ margin: '1rem', color: '#fbbf24' }}>{dashboardWarning}</div>
        )}
        {/* Mobile Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <button className="nav-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span></span><span></span><span></span>
          </button>
          <div style={{ textAlign: sidebarOpen ? 'left' : 'right', flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {tabs.find(t => t.key === activeTab)?.label || 'Dashboard'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Welcome back, {owner?.name || 'Owner'} 👋
            </p>
          </div>
        </div>

        {/* ═══════ DASHBOARD TAB ═══════ */}
        {activeTab === 'dashboard' && (
          <div>
            {!hasApprovedVenue ? (
              /* CASE A: ONBOARDING & APPROVAL TRACKER */
              <div style={{ marginBottom: '2rem' }}>
                {allOwnerVenues.length === 0 ? (
                  /* Case A1: No venue registered yet */
                  <div className="card" style={{
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '16px'
                  }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🏟️</div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                      Welcome to Book Arena, {owner?.name || 'Partner'}!
                    </h2>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
                      Get your sports arena, swimming pool, or amusement park set up in minutes. Configure multi-category courts, custom ticket passes, and link your Razorpay Route account for automatic payouts.
                    </p>
                    <button
                      className="btn btn-primary btn-lg"
                      style={{ fontSize: '1.05rem', padding: '14px 32px' }}
                      onClick={() => { setWizardDraft(null); setShowWizard(true); }}
                    >
                      🚀 Register Your First Venue
                    </button>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '1.5rem',
                      marginTop: '3rem',
                      textAlign: 'left'
                    }}>
                      <div className="card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📍</div>
                        <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Map Pinpoint</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Exact geocoded coordinates & verified address for players.</p>
                      </div>
                      <div className="card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚙️</div>
                        <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Flexible Models</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Hourly slots, open-entry ticket passes, or swimmer lane sessions.</p>
                      </div>
                      <div className="card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💳</div>
                        <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Direct Payouts</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Automated split settlement via Razorpay Route without manual reconciliation.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Case A2: Venues submitted or in draft */
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1.5rem',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}>
                      <div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800 }}>
                          🏟️ Venue Onboarding & Verification Status
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          Your venue is currently undergoing verification. Once approved by our operations team, it will appear publicly for bookings.
                        </p>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={() => { setWizardDraft(null); setShowWizard(true); }}
                      >
                        ➕ Register Another Venue
                      </button>
                    </div>

                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                      {allOwnerVenues.map(v => {
                        const status = v.approval_status || (v.is_draft ? 'DRAFT' : 'PENDING');
                        const venueCategory = categoryAliases[v.category] || v.category;
                        const cat = VENUE_CATEGORIES[venueCategory] || VENUE_CATEGORIES.sports_court;
                        return (
                          <div key={v.id} className="card" style={{
                            padding: '1.5rem',
                            border: status === 'PENDING'
                              ? '1px solid rgba(245, 158, 11, 0.4)'
                              : status === 'REJECTED'
                              ? '1px solid rgba(239, 68, 68, 0.4)'
                              : '1px solid rgba(16, 185, 129, 0.4)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                  <h3 style={{ fontWeight: 800, fontSize: '1.25rem' }}>{v.name}</h3>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    padding: '3px 10px',
                                    borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'var(--text-secondary)'
                                  }}>
                                    {cat.icon} {cat.name}
                                  </span>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    padding: '3px 10px',
                                    borderRadius: '12px',
                                    background: status === 'PENDING' ? '#f59e0b22' : status === 'REJECTED' ? '#ef444422' : '#3b82f622',
                                    color: status === 'PENDING' ? '#fbbf24' : status === 'REJECTED' ? '#f87171' : '#60a5fa',
                                    fontWeight: 700
                                  }}>
                                    {status === 'PENDING' ? '⏳ Under Review' : status === 'REJECTED' ? '❌ Changes Requested' : '📝 Draft'}
                                  </span>
                                </div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                  📍 {v.address || v.location || 'Address pending'}
                                </p>
                                {status === 'PENDING' && (
                                  <p style={{ color: '#fbbf24', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                    ℹ️ Verification in progress. Most venues are activated within 24 hours.
                                  </p>
                                )}
                                {status === 'REJECTED' && (
                                  <div style={{
                                    background: '#ef444415',
                                    border: '1px solid #ef444433',
                                    borderRadius: '8px',
                                    padding: '10px 14px',
                                    marginTop: '0.75rem',
                                    color: '#fca5a5',
                                    fontSize: '0.85rem'
                                  }}>
                                    <strong>Admin Feedback:</strong> {v.admin_feedback || 'Please update your venue details and resubmit.'}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.75rem' }}>
                                {(status === 'DRAFT' || status === 'REJECTED') && (
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                      setWizardDraft(v);
                                      setShowWizard(true);
                                    }}
                                  >
                                    ✏️ Edit & Resubmit
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* CASE B: APPROVED VENUE - FULL DASHBOARD */
              <div>
                {/* Multi-Category Venue Switcher (Case C) */}
                <div className="card" style={{
                  padding: '1rem 1.5rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                  border: '1px solid var(--border-default)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{categoryConfig.icon}</span>
                      <strong style={{ fontSize: '1rem' }}>Active Venue:</strong>
                    </div>

                    {allOwnerVenues.length > 1 ? (
                      <select
                        className="form-input"
                        style={{ minWidth: '220px', padding: '6px 12px', fontSize: '0.9rem' }}
                        value={selectedVenueId || getVenueKey(activeVenue)}
                        onChange={(e) => {
                          setSelectedVenueId(e.target.value);
                          const venue = allOwnerVenues.find(v => getVenueKey(v) === e.target.value);
                          if (venue && !venue.is_activity) {
                            setEarningsTurfId(String(venue.id));
                            loadEarnings({ turfId: String(venue.id) });
                          } else {
                            setEarningsTurfId('');
                          }
                        }}
                      >
                        {allOwnerVenues.map(v => (
                          <option key={getVenueKey(v)} value={getVenueKey(v)}>
                            {v.name} ({v.category || v.sport_type || (v.is_activity ? 'Activity' : 'Arena')})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {activeVenue?.name || 'Arena'}
                      </span>
                    )}

                    <span style={{
                      fontSize: '0.75rem',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--emerald-400)',
                      fontWeight: 600
                    }}>
                      ✓ {categoryConfig.shortTitle}
                    </span>

                    <span style={{
                      fontSize: '0.75rem',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      fontWeight: 600
                    }}>
                      Model: {activeVenue?.booking_model || 'SLOT'}
                    </span>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setWizardDraft(null); setShowWizard(true); }}
                  >
                    ➕ Register New Venue
                  </button>
                </div>

                {/* Category-Specific Operational KPIs */}
                {activeVenueCategory === 'amusement_park' ? (
                  <div className="grid-5" style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div className="stat-card">
                      <div className="stat-icon">🎟️</div>
                      <div className="stat-value">{activityLoading ? '…' : (activityStats?.bookings ?? 0)}</div>
                      <div className="stat-label">Confirmed Bookings Today</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">👥</div>
                      <div className="stat-value">{activityLoading ? '…' : (activityStats?.tickets ?? 0)}</div>
                      <div className="stat-label">Tickets Booked Today</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">🎢</div>
                      <div className="stat-value">{activityLoading ? '…' : (activityStats?.entries ?? 0)}</div>
                      <div className="stat-label">Entries Scanned Today</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">💰</div>
                      <div className="stat-value">{formatCompactNumber(activityStats?.revenue || 0)}</div>
                      <div className="stat-label">Revenue Today</div>
                    </div>
                  </div>
                ) : activeVenueCategory === 'swimming_pool' ? (
                  <div className="grid-5" style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div className="stat-card">
                      <div className="stat-icon">🏊</div>
                      <div className="stat-value">{turfs.length}</div>
                      <div className="stat-label">My Venues</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">🤿</div>
                      <div className="stat-value">{bookings.length}</div>
                      <div className="stat-label">Confirmed Bookings</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">💰</div>
                      <div className="stat-value">{formatCompactNumber(earnings?.total || 0)}</div>
                      <div className="stat-label">Verified Earnings</div>
                    </div>
                  </div>
                ) : (
                  <div className="grid-5" style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div className="stat-card">
                      <div className="stat-icon">🏟️</div>
                      <div className="stat-value">{turfs.length}</div>
                      <div className="stat-label">My Turfs</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">📋</div>
                      <div className="stat-value">{bookings.length}</div>
                      <div className="stat-label">Total Bookings</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">📅</div>
                      <div className="stat-value">{formatCompactNumber(earnings?.total || 0)}</div>
                      <div className="stat-label">Net Earnings (Total)</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">📊</div>
                      <div className="stat-value">{formatCompactNumber(earnings?.monthly || 0)}</div>
                      <div className="stat-label">This Month</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">💰</div>
                      <div className="stat-value">{formatCompactNumber(earnings?.today || 0)}</div>
                      <div className="stat-label">Today's Earnings</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeVenue?.is_activity ? (
              <>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                  Today&apos;s Activity Bookings
                </h3>
                {activityBookings.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Booking ID</th>
                          <th>Customer</th>
                          <th>Tickets</th>
                          <th>Amount</th>
                          <th>Entry status</th>
                          <th>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityBookings.slice(0, 10).map((booking) => (
                          <tr key={booking.id}>
                            <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{booking.booking_code || `#${booking.id}`}</td>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{booking.customer_name || 'Customer'}</div>
                              {booking.customer_phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{booking.customer_phone}</div>}
                            </td>
                            <td>{booking.ticket_summary || booking.ticket_count || 0}</td>
                            <td>{formatCompactNumber(booking.total_amount || 0)} {activityStats?.currency || 'INR'}</td>
                            <td><span className={`status-badge status-${String(booking.qr_status || 'pending').toLowerCase()}`}>{booking.qr_status || 'Not scanned'}</span></td>
                            <td><span className={`status-badge status-${booking.status}`}>{booking.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">🎟️</div>
                    <h3>{activityLoading ? 'Loading activity bookings…' : 'No activity bookings today'}</h3>
                    <p>Confirmed ticket bookings for this activity will appear here.</p>
                  </div>
                )}
              </>
            ) : (
              <>
            {/* Recent Bookings */}
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Recent Bookings
            </h3>
            {bookings.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>User Name</th>
                      <th>Time Slot</th>
                      <th>Slot Value</th>
                      <th>Paid Now</th>
                      <th>Collected / Balance</th>
                      <th>Final Earning</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupContinuousBookings(bookings).slice(0, 5).map(b => {
                      const isMatchmaking = b.need_players === 1 || b.need_players === true || b.need_players === '1';
                      const slotValue = parseFloat(b.original_price || b.amount || 0);
                      const discount = parseFloat(b.discount_amount || 0);
                      const playersCollected = parseFloat(b.players_collected || 0);
                      const hostPaid = parseFloat(b.advance_amount || b.amount || 0);
                      const pendingBal = parseFloat(b.pending_balance || 0);
                      const balanceRemaining = isMatchmaking ? Math.max(0, slotValue - discount - hostPaid - playersCollected) : pendingBal;

                      return (
                        <tr key={b.displayBookingId || b.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                            {b.displayBookingId || `#${b.id}`}
                            {b.isGrouped && (
                              <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 500, marginTop: '2px' }}>
                                ⚡ {b.slotCount} continuous slots
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.customer_name}</div>
                            {b.court_name && <div style={{ fontSize: '0.75rem', color: 'var(--emerald-400)' }}>{b.court_name}</div>}
                          </td>
                          <td style={{ color: 'var(--emerald-400)' }}>
                            {formatDate(b.booking_date)}<br/>
                            <span style={{ fontWeight: 600 }}>{b.time_slot}</span>
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {formatPrice(slotValue)}
                            {discount > 0 && <div style={{ fontSize: '0.7rem', color: 'var(--gold-400)' }}>-{formatPrice(discount)} coupon</div>}
                          </td>
                          <td style={{ color: '#3b82f6', fontWeight: 600 }}>
                            {isMatchmaking ? (
                              <div>
                                <div>{formatPrice(hostPaid)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Host Paid</div>
                              </div>
                            ) : (
                              <div>
                                <div>{formatPrice(hostPaid)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.payment_type === 'advance' ? `${Math.round((hostPaid / Math.max(1, slotValue - discount)) * 100)}% advance` : 'Full paid'}</div>
                              </div>
                            )}
                          </td>
                          <td>
                            {isMatchmaking ? (
                              <div>
                                <div style={{ color: 'var(--emerald-400)', fontWeight: 600 }}>{formatPrice(playersCollected)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Players Collected</div>
                                {balanceRemaining > 0 && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--gold-400)', fontWeight: 600 }}>{formatPrice(balanceRemaining)} remaining</div>
                                )}
                              </div>
                            ) : (
                              <div>
                                {pendingBal > 0 ? (
                                  <>
                                    <div style={{ color: 'var(--gold-400)', fontWeight: 600 }}>{formatPrice(pendingBal)}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Balance at Venue</div>
                                  </>
                                ) : (
                                  <span style={{ color: 'var(--emerald-400)', fontSize: '0.85rem' }}>Fully Paid</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ color: 'var(--emerald-400)', fontWeight: 800 }}>{formatPrice(b.netAmount)}</td>
                          <td><span className={`status-badge status-${b.status}`}>{b.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No bookings yet</h3>
                <p>Bookings will appear here once customers start booking</p>
              </div>
            )}
              </>
            )}
          </div>
        )}

        {/* ═══════ TURFS TAB ═══════ */}
        {activeTab === 'turfs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Your Turfs & Venues</h3>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={() => { resetTurfForm(); setEditingTurf(null); setShowTurfForm(true); }}>
                  ⚡ Quick Add
                </button>
                <button className="btn btn-primary" onClick={() => { setWizardDraft(null); setShowWizard(true); }}>
                  🚀 Register Venue (Wizard)
                </button>
              </div>
            </div>

            {showTurfForm && (
              <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--emerald-500)' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>{editingTurf ? 'Edit Turf' : 'Add New Turf'}</h3>
                <form onSubmit={handleSaveTurf}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Turf Name *</label>
                      <input type="text" className="form-input" placeholder="e.g. Ryzon Arena"
                        value={turfForm.name} onChange={(e) => setTurfForm({ ...turfForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sport Type / Play Zone *</label>
                      <select className="form-input" 
                        value={['cricket', 'football', 'badminton', 'tennis', 'basketball', 'volleyball', 'box cricket'].includes(turfForm.sport_type?.toLowerCase()) ? turfForm.sport_type.toLowerCase() : 'custom'}
                        onChange={(e) => setTurfForm({ ...turfForm, sport_type: e.target.value === 'custom' ? '' : e.target.value })}>
                        <option value="cricket">Cricket</option>
                        <option value="football">Football</option>
                        <option value="badminton">Badminton</option>
                        <option value="tennis">Tennis</option>
                        <option value="basketball">Basketball</option>
                        <option value="volleyball">Volleyball</option>
                        <option value="box cricket">Box Cricket</option>
                        <option value="custom">+ Add New Sport / Custom Play Zone</option>
                      </select>
                      {!['cricket', 'football', 'badminton', 'tennis', 'basketball', 'volleyball', 'box cricket'].includes(turfForm.sport_type?.toLowerCase()) && (
                        <input type="text" className="form-input" style={{ marginTop: '0.5rem' }} placeholder="Enter custom sport or play zone (e.g. Skating Arena)" 
                          value={turfForm.sport_type} onChange={(e) => setTurfForm({ ...turfForm, sport_type: e.target.value })} required />
                      )}
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">City/Location *</label>
                      <input type="text" className="form-input" placeholder="e.g. Mumbai"
                        value={turfForm.location} onChange={(e) => setTurfForm({ ...turfForm, location: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Base Price (Per Hour) *</label>
                      <input type="number" className="form-input" placeholder="₹"
                        value={turfForm.price_per_hour} onChange={(e) => setTurfForm({ ...turfForm, price_per_hour: e.target.value })} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Owner Notification Email *</label>
                    <input type="email" className="form-input" placeholder="Enter notification email address"
                      value={turfForm.owner_email} onChange={(e) => setTurfForm({ ...turfForm, owner_email: e.target.value })} required />
                    <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block', fontSize: '0.8rem' }}>
                      📩 Booking confirmations will be sent to this email. You can use a different email from your login.
                    </small>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Address *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        ref={addressInputRef}
                        type="text"
                        className="form-input"
                        placeholder="Search address / area / landmark (Google suggestions)"
                        value={turfForm.address}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        onFocus={() => {
                          if (addressSuggestions.length > 0) setAddressDropdownOpen(true);
                        }}
                        onBlur={() => {
                          // allow click selection first (mousedown fires before blur)
                          setTimeout(() => setAddressDropdownOpen(false), 150);
                        }}
                        required
                      />

                      {addressDropdownOpen && addressSuggestions.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: 'calc(100% + 6px)',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            zIndex: 50,
                            boxShadow: 'var(--shadow-lg)'
                          }}
                        >
                          {addressSuggestions.slice(0, 8).map((p) => (
                            <div
                              key={p.place_id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleAddressSelect(p);
                              }}
                              style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem'
                              }}
                            >
                              {p.description}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                      Start typing any venue name, area, landmark, or full address and select a suggestion to auto-fill coordinates.
                    </p>
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '10px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Map Coordinates *</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleBrowseLocation}
                        >
                          🌍 Select Location
                        </button>

                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            if (!navigator.geolocation) {
                              alert("Geolocation is not supported by your browser");
                              return;
                            }
                            const btn = document.getElementById('detect-btn');
                            btn.innerHTML = 'Detecting...';
                            navigator.geolocation.getCurrentPosition(
                              async (pos) => {
                                const lat = pos.coords.latitude;
                                const lng = pos.coords.longitude;
                                
                                // Try to reverse geocode to get city
                                try {
                                  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                                  const data = await res.json();
                                  const city = data.address?.city || data.address?.state_district || data.address?.town;
                                  const address = data.display_name;
                                  
                                  setTurfForm(prev => ({ 
                                    ...prev, 
                                    latitude: lat, 
                                    longitude: lng,
                                    location: prev.location || city || '',
                                    address: prev.address || address || ''
                                  }));
                                } catch (err) {
                                  setTurfForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
                                }
                                btn.innerHTML = '📍 Location Detected';
                              },
                              (err) => {
                                alert("Please enable location access to use this feature");
                                btn.innerHTML = '📍 Use My Current Location';
                              }
                            );
                          }}
                          id="detect-btn"
                        >
                          📍 Use My Current Location
                        </button>
                      </div>
                    </div>
                    <div className="grid-2">
                      <input type="number" step="any" className="form-input" placeholder="Latitude (e.g. 13.0827)"
                        value={turfForm.latitude} onChange={(e) => setTurfForm({ ...turfForm, latitude: e.target.value })} required />
                      <input type="number" step="any" className="form-input" placeholder="Longitude (e.g. 80.2707)"
                        value={turfForm.longitude} onChange={(e) => setTurfForm({ ...turfForm, longitude: e.target.value })} required />
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                      Tip: use the address search above to pick a Google suggestion and auto-fill the coordinates, or use <strong>"Use My Current Location"</strong> if you are physically at the turf.
                    </p>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Opening Time</label>
                      <input type="time" className="form-input" value={turfForm.open_time}
                        disabled={turfForm.is_24_hours}
                        onChange={(e) => setTurfForm({ ...turfForm, open_time: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Closing Time</label>
                      <input type="time" className="form-input" value={turfForm.close_time}
                        disabled={turfForm.is_24_hours}
                        onChange={(e) => setTurfForm({ ...turfForm, close_time: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <input
                        type="checkbox"
                        checked={!!turfForm.is_24_hours}
                        onChange={(e) => setTurfForm({
                          ...turfForm,
                          is_24_hours: e.target.checked,
                          open_time: e.target.checked ? '00:00' : (turfForm.open_time || '06:00'),
                          close_time: e.target.checked ? '00:00' : (turfForm.close_time || '23:00')
                        })}
                      />
                      <span>Open 24 Hours</span>
                    </label>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                      Saves this venue as `00:00` to `00:00` so customers can see all 24 hours of slots.
                    </p>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">⏱️ Slot Duration</label>
                      <select className="form-input" value={turfForm.slot_duration}
                        onChange={(e) => setTurfForm({ ...turfForm, slot_duration: parseInt(e.target.value) })}>
                        <option value={30}>30 Minutes</option>
                        <option value={60}>1 Hour</option>
                      </select>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>Duration of each bookable slot</p>
                    </div>
                    <div className="form-group">
                      <label className="form-label">🕐 Time Format</label>
                      <select className="form-input" value={turfForm.time_format}
                        onChange={(e) => setTurfForm({ ...turfForm, time_format: e.target.value })}>
                        <option value="12h">12-Hour (AM/PM)</option>
                        <option value="24h">24-Hour (00:00)</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">💳 Advance Payment Required</label>
                    <select className="form-input" value={turfForm.advance_percent}
                      onChange={(e) => setTurfForm({ ...turfForm, advance_percent: parseInt(e.target.value) })}>
                      <option value={100}>100% – Full payment upfront</option>
                      <option value={50}>50% – Half advance</option>
                      <option value={30}>30% – 30% advance</option>
                      <option value={20}>20% – 20% advance</option>
                    </select>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>Customer pays this % now; remaining balance paid at venue</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>💰 Period-Based Pricing (Optional)</label>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>Set different prices for each time period. Leave blank to use the Base Price for all slots.</p>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Default / Fallback Price (₹)</label>
                        <input type="number" className="form-input" placeholder="Defaults to Base Price if blank"
                          value={turfForm.default_price} onChange={(e) => setTurfForm({ ...turfForm, default_price: e.target.value })} min="0" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">🌙 Early Morning Price (12 AM – 6 AM)</label>
                        <input type="number" className="form-input" placeholder="₹ per slot"
                          value={turfForm.early_morning_price} onChange={(e) => setTurfForm({ ...turfForm, early_morning_price: e.target.value })} min="0" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">☀️ Morning Price (6 AM – 12 PM)</label>
                        <input type="number" className="form-input" placeholder="₹ per slot"
                          value={turfForm.morning_price} onChange={(e) => setTurfForm({ ...turfForm, morning_price: e.target.value })} min="0" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">🌤️ Afternoon Price (12 PM – 6 PM)</label>
                        <input type="number" className="form-input" placeholder="₹ per slot"
                          value={turfForm.afternoon_price} onChange={(e) => setTurfForm({ ...turfForm, afternoon_price: e.target.value })} min="0" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">🌆 Evening / Night Price (6 PM – 12 AM)</label>
                        <input type="number" className="form-input" placeholder="₹ per slot"
                          value={turfForm.evening_price} onChange={(e) => setTurfForm({ ...turfForm, evening_price: e.target.value })} min="0" />
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-input" rows="3" placeholder="Tell customers about your turf..."
                      value={turfForm.description} onChange={(e) => setTurfForm({ ...turfForm, description: e.target.value })}></textarea>
                  </div>
                  <div className="form-group">
                    <TurfImageUpload
                      key={`turf-upload-${editingTurf?.id || 'new'}-${turfUploadKey}`}
                      photos={turfForm.photos || []}
                      coverImage={turfForm.coverImage || ''}
                      onChange={({ photos, coverImage, photosCount }) =>
                        setTurfForm(prev => ({
                          ...prev,
                          photos,
                          coverImage,
                          photosCount,
                          images: photos
                        }))
                      }
                    />
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Markup Type (Display Discount)</label>
                      <select className="form-input" value={turfForm.markup_type || 'fixed'}
                        onChange={(e) => setTurfForm({ ...turfForm, markup_type: e.target.value })}>
                        <option value="fixed">Fixed (₹)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>This adds to the base price for "Striked Price" display</p>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Markup Value *</label>
                      <input type="number" className="form-input" placeholder="e.g. 200"
                        value={turfForm.markup_value || ''} 
                        onChange={(e) => setTurfForm({ ...turfForm, markup_value: e.target.value })} 
                        required min="0" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amenities</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {AMENITIES_LIST.map(a => (
                        <button key={a} type="button"
                          className={`sport-chip ${turfForm.amenities.includes(a) ? 'active' : ''}`}
                          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                          onClick={() => toggleAmenity(a)}>
                          {turfForm.amenities.includes(a) ? '✓ ' : ''}{a}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={couponLoading}>
                      {editingTurf ? '💾 Update Turf' : '➕ Add Turf'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={closeTurfForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid-3">
              {turfs.map(turf => (
                <div key={turf.id} className="turf-card card">
                  <div className="turf-image" style={{ height: '140px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '1rem', overflow: 'hidden' }}>
                    {turf.images && turf.images.length > 0 ? (
                      <img src={resolveMediaUrl(turf.images[0])} alt={turf.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '2rem' }}>🏟️</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <h4 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{turf.name}</h4>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      background: (turf.approval_status || 'APPROVED') === 'APPROVED' ? '#10b98122' : (turf.approval_status === 'REJECTED' ? '#ef444422' : '#f59e0b22'),
                      color: (turf.approval_status || 'APPROVED') === 'APPROVED' ? 'var(--emerald-400)' : (turf.approval_status === 'REJECTED' ? '#f87171' : '#fbbf24')
                    }}>
                      {(turf.approval_status || 'APPROVED') === 'APPROVED' ? '✓ Approved' : (turf.approval_status === 'REJECTED' ? '❌ Rejected' : '⏳ Pending Review')}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>📍 {turf.location}</p>
                  {turf.approval_status === 'REJECTED' && turf.admin_feedback && (
                    <div style={{ background: '#ef444415', border: '1px solid #ef444433', borderRadius: '6px', padding: '6px 10px', fontSize: '0.75rem', color: '#fca5a5', marginBottom: '0.5rem' }}>
                      <strong>Feedback:</strong> {turf.admin_feedback}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span className="sport-chip" style={{ fontSize: '0.7rem' }}>
                      {turf.category
                        ? `${VENUE_CATEGORIES[turf.category]?.icon || '🏟️'} ${VENUE_CATEGORIES[turf.category]?.shortTitle || turf.category}`
                        : (turf.sport_type || 'Venue').toUpperCase()}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>{formatPrice(turf.price_per_hour)}/hr</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => editTurf(turf)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTurf(turf.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
            {turfs.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🏟️</div>
                <h3>No turfs added yet</h3>
                <p>Start by adding your first turf to receive bookings</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════ COURTS TAB ═══════ */}
        {activeTab === 'courts' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>🎾 Court Management</h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="form-input" style={{ minWidth: '200px' }} value={courtsTurfId}
                  onChange={(e) => { setCourtsTurfId(e.target.value); loadCourts(e.target.value); setShowCourtForm(false); }}>
                  <option value="">Select a Turf/Venue</option>
                  {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {courtsTurfId && (
                  <button className="btn btn-primary" onClick={() => { setShowCourtForm(true); setEditingCourt(null); setCourtForm({ name: '', sport_type: 'cricket', price_per_hour: '', description: '', images: [], amenities: [], open_time: '06:00', close_time: '23:00', markup_type: 'fixed', markup_value: '0', slot_duration: 60, time_format: '12h', advance_percent: 100, is_24_hours: false, default_price: '', early_morning_price: '', morning_price: '', afternoon_price: '', evening_price: '' }); }}>
                    ➕ Add Court
                  </button>
                )}
              </div>
            </div>

            {!courtsTurfId && (
              <div className="empty-state"><div className="empty-icon">🏟️</div><h3>Select a Venue</h3><p>Choose a turf/venue above to manage its courts</p></div>
            )}

            {courtsTurfId && showCourtForm && (
              <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--emerald-500)' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>{editingCourt ? '✏️ Edit Court' : '➕ Add New Court'}</h3>
                <form onSubmit={handleSaveCourt}>
                  {selectedCourtsTurf && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setCourtForm(prev => ({
                          ...prev,
                          open_time: selectedCourtsTurf.open_time || '06:00',
                          close_time: selectedCourtsTurf.close_time || '23:00',
                          slot_duration: selectedCourtsTurf.slot_duration || 60,
                          time_format: selectedCourtsTurf.time_format || '12h',
                          advance_percent: selectedCourtsTurf.advance_percent || 100,
                          is_24_hours: isEntityOpen24Hours(selectedCourtsTurf),
                          markup_type: selectedCourtsTurf.markup_type || 'fixed',
                          markup_value: selectedCourtsTurf.markup_value || '0'
                        }))}
                      >
                        Copy venue slot settings
                      </button>
                    </div>
                  )}
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Court Name *</label>
                      <input type="text" className="form-input" placeholder="e.g. Court A / Badminton Court 1"
                        value={courtForm.name} onChange={(e) => setCourtForm({ ...courtForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sport Type *</label>
                      <input type="text" className="form-input" placeholder="e.g. Badminton"
                        value={courtForm.sport_type} onChange={(e) => setCourtForm({ ...courtForm, sport_type: e.target.value })} required />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Price Per Hour (₹) *</label>
                      <input type="number" className="form-input" placeholder="₹"
                        value={courtForm.price_per_hour} onChange={(e) => setCourtForm({ ...courtForm, price_per_hour: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">⏱️ Slot Duration</label>
                      <select className="form-input" value={courtForm.slot_duration}
                        onChange={(e) => setCourtForm({ ...courtForm, slot_duration: parseInt(e.target.value) })}>
                        <option value={30}>30 Minutes</option>
                        <option value={60}>1 Hour</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Opening Time</label>
                      <input type="time" className="form-input" value={courtForm.open_time}
                        disabled={courtForm.is_24_hours}
                        onChange={(e) => setCourtForm({ ...courtForm, open_time: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Closing Time</label>
                      <input type="time" className="form-input" value={courtForm.close_time}
                        disabled={courtForm.is_24_hours}
                        onChange={(e) => setCourtForm({ ...courtForm, close_time: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <input
                        type="checkbox"
                        checked={!!courtForm.is_24_hours}
                        onChange={(e) => setCourtForm({
                          ...courtForm,
                          is_24_hours: e.target.checked,
                          open_time: e.target.checked ? '00:00' : (courtForm.open_time || '06:00'),
                          close_time: e.target.checked ? '00:00' : (courtForm.close_time || '23:00')
                        })}
                      />
                      <span>Open 24 Hours</span>
                    </label>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                      Saves this court as `00:00` to `00:00` so the booking page can show the full 24-hour schedule.
                    </p>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">🕐 Time Format</label>
                      <select className="form-input" value={courtForm.time_format}
                        onChange={(e) => setCourtForm({ ...courtForm, time_format: e.target.value })}>
                        <option value="12h">12-Hour (AM/PM)</option>
                        <option value="24h">24-Hour</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">💳 Advance Payment %</label>
                      <select className="form-input" value={courtForm.advance_percent}
                        onChange={(e) => setCourtForm({ ...courtForm, advance_percent: parseInt(e.target.value) })}>
                        <option value={100}>100% – Full payment</option>
                        <option value={50}>50% – Half advance</option>
                        <option value={30}>30% – 30% advance</option>
                        <option value={20}>20% – 20% advance</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>💰 Period-Based Pricing (Optional)</label>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>Set different prices for each time period. Leave blank to use the Base Price for all slots.</p>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Default / Fallback Price (₹)</label>
                        <input type="number" className="form-input" placeholder="Defaults to Base Price if blank"
                          value={courtForm.default_price || ''} onChange={(e) => setCourtForm({ ...courtForm, default_price: e.target.value })} min="0" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">🌙 Early Morning (12 AM – 6 AM)</label>
                        <input type="number" className="form-input" placeholder="₹ per slot"
                          value={courtForm.early_morning_price || ''} onChange={(e) => setCourtForm({ ...courtForm, early_morning_price: e.target.value })} min="0" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">☀️ Morning (6 AM – 12 PM)</label>
                        <input type="number" className="form-input" placeholder="₹ per slot"
                          value={courtForm.morning_price || ''} onChange={(e) => setCourtForm({ ...courtForm, morning_price: e.target.value })} min="0" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">🌤️ Afternoon (12 PM – 6 PM)</label>
                        <input type="number" className="form-input" placeholder="₹ per slot"
                          value={courtForm.afternoon_price || ''} onChange={(e) => setCourtForm({ ...courtForm, afternoon_price: e.target.value })} min="0" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">🌆 Evening / Night (6 PM – 12 AM)</label>
                        <input type="number" className="form-input" placeholder="₹ per slot"
                          value={courtForm.evening_price || ''} onChange={(e) => setCourtForm({ ...courtForm, evening_price: e.target.value })} min="0" />
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Images (comma-separated URLs)</label>
                    <input type="text" className="form-input" placeholder="https://img1.jpg, https://img2.jpg"
                      value={courtForm.images.join(', ')}
                      onChange={(e) => setCourtForm({ ...courtForm, images: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="submit" className="btn btn-primary">{editingCourt ? '💾 Update Court' : '➕ Add Court'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowCourtForm(false); setEditingCourt(null); }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {courtsTurfId && (
              courtsLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}><div className="loader"></div></div>
              ) : courts.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🎾</div><h3>No courts yet</h3><p>Add courts to allow separate bookings per court within this venue</p></div>
              ) : (
                <div className="grid-3">
                  {courts.map(court => (
                    <div key={court.id} className="card" style={{ padding: '1.25rem' }}>
                      {court.images && court.images.length > 0 && (
                        <img src={court.images[0]} alt={court.name} loading="lazy" decoding="async" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.75rem' }} />
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                        <h4 style={{ fontWeight: 700, margin: 0 }}>{court.name}</h4>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          background: (court.approval_status || 'APPROVED') === 'APPROVED' ? '#10b98122' : (court.approval_status === 'REJECTED' ? '#ef444422' : '#f59e0b22'),
                          color: (court.approval_status || 'APPROVED') === 'APPROVED' ? 'var(--emerald-400)' : (court.approval_status === 'REJECTED' ? '#f87171' : '#fbbf24')
                        }}>
                          {(court.approval_status || 'APPROVED') === 'APPROVED' ? '✓ Approved' : (court.approval_status === 'REJECTED' ? '❌ Rejected' : '⏳ Pending Review')}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{court.sport_type}</p>
                      {court.approval_status === 'REJECTED' && court.admin_feedback && (
                        <div style={{ background: '#ef444415', border: '1px solid #ef444433', borderRadius: '6px', padding: '6px 10px', fontSize: '0.75rem', color: '#fca5a5', marginBottom: '0.5rem' }}>
                          <strong>Feedback:</strong> {court.admin_feedback}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>₹{court.price_per_hour}/hr</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{court.slot_duration}min slots</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.7rem', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>{court.time_format}</span>
                        <span style={{ fontSize: '0.7rem', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>{court.advance_percent}% advance</span>
                        <span style={{ fontSize: '0.7rem', background: court.is_active ? '#10b98122' : '#ef444422', color: court.is_active ? 'var(--emerald-400)' : '#f87171', padding: '2px 8px', borderRadius: '4px' }}>{court.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => {
                          setEditingCourt(court);
                          setCourtForm({ name: court.name, sport_type: court.sport_type, price_per_hour: court.price_per_hour, description: court.description || '', images: court.images || [], amenities: court.amenities || [], open_time: court.open_time || '06:00', close_time: court.close_time || '23:00', markup_type: court.markup_type || 'fixed', markup_value: court.markup_value || 0, slot_duration: court.slot_duration || 60, time_format: court.time_format || '12h', advance_percent: court.advance_percent || 100, is_24_hours: isEntityOpen24Hours(court), default_price: court.default_price || '', early_morning_price: court.early_morning_price || '', morning_price: court.morning_price || '', afternoon_price: court.afternoon_price || '', evening_price: court.evening_price || '' });
                          setShowCourtForm(true);
                        }}>✏️ Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCourt(court.id)}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* ═══════ BOOKINGS TAB ═══════ */}
        {activeTab === 'bookings' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Booking History</h3>
            </div>
            {bookings.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>Turf</th>
                      <th>Customer</th>
                      <th>Date & Slot</th>
                      <th>Slot Value</th>
                      <th>Paid Now</th>
                      <th>Collected / Balance</th>
                      <th>Final Earning</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupContinuousBookings(bookings).map(b => {
                      const isMatchmaking = b.need_players === 1 || b.need_players === true || b.need_players === '1';
                      const slotValue = parseFloat(b.original_price || b.amount || 0);
                      const discount = parseFloat(b.discount_amount || 0);
                      const playersCollected = parseFloat(b.players_collected || 0);
                      const hostPaid = parseFloat(b.advance_amount || b.amount || 0);
                      const pendingBal = parseFloat(b.pending_balance || 0);
                      const balanceRemaining = isMatchmaking ? Math.max(0, slotValue - discount - hostPaid - playersCollected) : pendingBal;

                      return (
                        <tr key={b.displayBookingId || b.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{b.displayBookingId || `#${b.id}`}</div>
                            {b.isGrouped && (
                              <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 500, marginTop: '2px' }}>
                                ⚡ {b.slotCount} continuous slots
                              </div>
                            )}
                          </td>
                          <td>
                            <div>{b.turf_name}</div>
                            {b.court_name && <div style={{ fontSize: '0.8rem', color: 'var(--emerald-400)' }}>{b.court_name}</div>}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{b.customer_name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.customer_phone}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.9rem' }}>{formatDate(b.booking_date)}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--emerald-400)', fontWeight: 600 }}>{b.time_slot}</div>
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {formatPrice(slotValue)}
                            {discount > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--gold-400)' }}>-{formatPrice(discount)} coupon</div>}
                          </td>
                          <td style={{ color: '#3b82f6', fontWeight: 600 }}>
                            {isMatchmaking ? (
                              <div>
                                <div>{formatPrice(hostPaid)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Host Paid</div>
                              </div>
                            ) : (
                              <div>
                                <div>{formatPrice(hostPaid)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.payment_type === 'advance' ? `${Math.round((hostPaid / Math.max(1, slotValue - discount)) * 100)}% advance` : 'Full paid'}</div>
                              </div>
                            )}
                          </td>
                          <td>
                            {isMatchmaking ? (
                              <div>
                                <div style={{ color: 'var(--emerald-400)', fontWeight: 600 }}>{formatPrice(playersCollected)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Players Collected</div>
                                {balanceRemaining > 0 && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--gold-400)', fontWeight: 600 }}>{formatPrice(balanceRemaining)} remaining</div>
                                )}
                              </div>
                            ) : (
                              <div>
                                {pendingBal > 0 ? (
                                  <>
                                    <div style={{ color: 'var(--gold-400)', fontWeight: 600 }}>{formatPrice(pendingBal)}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Balance at Venue</div>
                                  </>
                                ) : (
                                  <span style={{ color: 'var(--emerald-400)', fontSize: '0.85rem' }}>Fully Paid</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>{formatPrice(b.netAmount)}</td>
                          <td><span className={`status-badge status-${b.status}`}>{b.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No bookings yet</h3>
                <p>Follow the tips below to increase your turf's visibility</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════ SLOTS TAB ═══════ */}
        {activeTab === 'slots' && (() => {
          // Compute AM and PM slots
          const amSlots = [];
          const pmSlots = [];
          managedSlots.forEach(slot => {
            const mins = getSlotStartMinutes(slot.time);
            if (mins < 720) {
              amSlots.push(slot);
            } else {
              pmSlots.push(slot);
            }
          });
          // Sort chronologically
          amSlots.sort((a, b) => getSlotStartMinutes(a.time) - getSlotStartMinutes(b.time));
          pmSlots.sort((a, b) => getSlotStartMinutes(a.time) - getSlotStartMinutes(b.time));

          const renderSlotsGridSection = (title, slotsList) => (
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '1.25rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                {title} ({slotsList.length})
              </h4>
              {slotsList.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No slots in this time period.</p>
              ) : (
                <div className="slots-grid">
                  {slotsList.map(slot => {
                    const isBooked = slot.status === 'booked';
                    const isBlocked = slot.status === 'blocked';
                    const isSubReserved = slot.status === 'subscription_reserved';
                    const isSelected = selectedSlots.includes(slot.time);

                    let badgeDotColor = '#10b981';
                    let statusLabel = 'Available';
                    let itemBg = 'rgba(255, 255, 255, 0.03)';
                    let itemBorder = '1px solid rgba(255, 255, 255, 0.08)';

                    if (isBooked) {
                      badgeDotColor = '#f59e0b';
                      statusLabel = 'Booked by Customer';
                      itemBg = 'rgba(245, 158, 11, 0.08)';
                      itemBorder = '1px solid rgba(245, 158, 11, 0.25)';
                    } else if (isBlocked) {
                      badgeDotColor = '#f43f5e';
                      statusLabel = 'Blocked by Venue';
                      itemBg = 'rgba(244, 63, 94, 0.12)';
                      itemBorder = '1px solid rgba(244, 63, 94, 0.45)';
                    } else if (isSubReserved) {
                      badgeDotColor = '#8b5cf6';
                      statusLabel = 'Subscription Reserved';
                      itemBg = 'rgba(139, 92, 246, 0.1)';
                      itemBorder = '1px solid rgba(139, 92, 246, 0.3)';
                    }

                    if (isSelected) {
                      itemBg = 'rgba(59, 130, 246, 0.18)';
                      itemBorder = '1px solid var(--blue-500)';
                    }

                    const isCheckboxDisabled = isBooked || isSubReserved;

                    return (
                      <label 
                        key={slot.time} 
                        className={`slot-manage-item ${isBooked ? 'booked' : ''} ${isBlocked ? 'blocked' : ''} ${isSelected ? 'selected' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.85rem 1rem',
                          background: itemBg,
                          border: itemBorder,
                          borderRadius: '10px',
                          cursor: isCheckboxDisabled ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          opacity: isCheckboxDisabled ? 0.65 : 1
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          disabled={isCheckboxDisabled}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSlots([...selectedSlots, slot.time]);
                            } else {
                              setSelectedSlots(selectedSlots.filter(t => t !== slot.time));
                            }
                          }}
                          style={{ cursor: isCheckboxDisabled ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {convertSlotTo12Hour(slot.time)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: badgeDotColor }}></span>
                            <span style={{ fontWeight: 500, color: isBlocked ? '#fca5a5' : isBooked ? '#fcd34d' : isSubReserved ? '#c084fc' : 'var(--text-muted)' }}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );

          return (
            <div>
              <div className="card" style={{ maxWidth: '960px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                    🔒 Slot Management & Venue Blocking
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Select a court, date, and time slots below to block or unblock. Booked and subscription slots are automatically protected.
                  </p>
                </div>
                
                {/* Step indicator */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>Step 1: Select Venue *</label>
                    <select className="form-input" required value={blockForm.turf_id}
                      onChange={(e) => {
                        setBlockForm({ ...blockForm, turf_id: e.target.value, court_id: '', reason: '' });
                        loadSlotCourts(e.target.value);
                      }}>
                      <option value="">Choose a turf</option>
                      {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  {blockForm.turf_id && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>Step 2: Select Court (Optional)</label>
                      <select className="form-input" value={blockForm.court_id}
                        onChange={(e) => setBlockForm({ ...blockForm, court_id: e.target.value })}
                        disabled={slotCourtsLoading}>
                        <option value="">Entire venue / All courts</option>
                        {slotCourts.map(court => <option key={court.id} value={court.id}>{court.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>Step 3: Select Date *</label>
                    <input type="date" className="form-input" required value={blockForm.block_date}
                      onChange={(e) => setBlockForm({ ...blockForm, block_date: e.target.value })} min={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '2rem' }}>
                  <label className="form-label">Step 4: Reason for Blocking (Optional)</label>
                  <input type="text" className="form-input" placeholder="e.g. Maintenance, Tournament, Private Event"
                    value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} />
                </div>

                {/* Status Legend */}
                {blockForm.turf_id && blockForm.block_date && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.75rem 1.25rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    marginBottom: '2rem',
                    fontSize: '0.82rem'
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10b981' }}></span> Available
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f43f5e' }}></span> Blocked by Venue
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f59e0b' }}></span> Booked by Customer
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#8b5cf6' }}></span> Subscription Reserved
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#3b82f6' }}></span> Selected
                    </span>
                  </div>
                )}

                {slotsLoading ? (
                  <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                    <div className="loader" style={{ margin: '0 auto' }}></div>
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Checking slot availability...</p>
                  </div>
                ) : blockForm.turf_id && blockForm.block_date ? (
                  <div style={{ marginTop: '1rem' }}>
                    {/* Render Slot Item Component */}
                    {renderSlotsGridSection('🌅 Morning & Afternoon Slots (12 AM – 12 PM)', amSlots)}
                    {renderSlotsGridSection('🌇 Evening & Night Slots (12 PM – 12 AM)', pmSlots)}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
                    <div className="empty-icon">📅</div>
                    <h3>Select Venue & Date</h3>
                    <p>Choose your turf and date above to load live availability and start blocking slots.</p>
                  </div>
                )}
              </div>

              {/* Floating Action Bar */}
              {selectedSlots.length > 0 && (() => {
                const hasBlockedSelected = selectedSlots.some(time => {
                  const slot = [...amSlots, ...pmSlots].find(s => s.time === time);
                  return slot && slot.status === 'blocked';
                });
                const hasAvailableSelected = selectedSlots.some(time => {
                  const slot = [...amSlots, ...pmSlots].find(s => s.time === time);
                  return slot && slot.status === 'available';
                });
                return (
                  <div className="floating-action-bar">
                    <span>{selectedSlots.length} slot(s) selected</span>
                    <div className="floating-action-bar-actions">
                      {hasAvailableSelected && (
                        <button onClick={handleBulkBlock} className="btn btn-danger">Block Selected Slots</button>
                      )}
                      {hasBlockedSelected && (
                        <button onClick={handleBulkUnblock} className="btn btn-secondary">Unblock Selected Slots</button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ═══════ PRICING TAB ═══════ */}
        {activeTab === 'pricing' && (
          <div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>Period-Based Base Pricing</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Set base prices by time period. These prices are used automatically for slots unless a special price is configured for a specific day or date.
              </p>
              <form onSubmit={handleSavePeriodPricing}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Choose Turf</label>
                    <select className="form-input" value={periodPricingTurf}
                      onChange={(e) => {
                        const turfId = e.target.value;
                        setPeriodPricingTurf(turfId);
                        setPeriodPricingCourtId('');
                        loadPeriodPricing(turfId);
                        loadSlotCourts(turfId);
                      }} required>
                      <option value="">Select Turf</option>
                      {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  {periodPricingTurf && (
                    <div className="form-group">
                      <label className="form-label">Court / Default Pricing (Optional)</label>
                      <select className="form-input" value={periodPricingCourtId}
                        onChange={(e) => {
                          setPeriodPricingCourtId(e.target.value);
                          loadPeriodPricing(periodPricingTurf, e.target.value);
                        }}
                        disabled={periodPricingLoading}>
                        <option value="">Default turf pricing</option>
                        {slotCourts.map(court => <option key={court.id} value={court.id}>{court.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {periodPricingLoading ? (
                  <p>Loading base pricing...</p>
                ) : (
                  <div className="grid-2">
                    {periodPricingFields.map(field => (
                      <div className="form-group" key={field.key}>
                        <label className="form-label">{field.label}</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="₹ per slot"
                          min="0"
                          value={periodPricingForm[field.key] ?? ''}
                          onChange={(e) => setPeriodPricingForm({ ...periodPricingForm, [field.key]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={periodPricingSaving}>
                  {periodPricingSaving ? 'Saving...' : 'Save Base Pricing'}
                </button>
              </form>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>📅 Day-Wise Special Pricing</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Set special period pricing for specific days of the week (e.g., Saturday, Sunday). This takes priority over the general period-based base pricing.
              </p>
              <form onSubmit={handleSaveDayWisePricing}>
                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Choose Turf</label>
                    <select className="form-input" value={dayWiseTurf}
                      onChange={(e) => {
                        const turfId = e.target.value;
                        setDayWiseTurf(turfId);
                        setDayWiseCourtId('');
                        loadSlotCourts(turfId);
                      }} required>
                      <option value="">Select Turf</option>
                      {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  {dayWiseTurf && (
                    <div className="form-group">
                      <label className="form-label">Court / Default Pricing (Optional)</label>
                      <select className="form-input" value={dayWiseCourtId}
                        onChange={(e) => setDayWiseCourtId(e.target.value)}>
                        <option value="">Default turf pricing</option>
                        {slotCourts.map(court => <option key={court.id} value={court.id}>{court.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Select Day</label>
                    <select className="form-input" value={dayWiseDay} onChange={(e) => setDayWiseDay(e.target.value)} required>
                      <option value="">Select Day</option>
                      {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.label}>{d.label}</option>)}
                    </select>
                  </div>
                </div>

                {dayWiseLoading ? (
                  <p>Loading day-wise pricing...</p>
                ) : (
                  dayWiseTurf && dayWiseDay && (
                    <div className="grid-2" style={{ marginTop: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Early Morning Price (12 AM - 6 AM) (₹)</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Leave empty or set ₹"
                          min="0"
                          value={dayWiseForm.early_morning_price ?? ''}
                          onChange={(e) => setDayWiseForm({ ...dayWiseForm, early_morning_price: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Morning Price (6 AM - 12 PM) (₹)</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Leave empty or set ₹"
                          min="0"
                          value={dayWiseForm.morning_price ?? ''}
                          onChange={(e) => setDayWiseForm({ ...dayWiseForm, morning_price: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Afternoon Price (12 PM - 6 PM) (₹)</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Leave empty or set ₹"
                          min="0"
                          value={dayWiseForm.afternoon_price ?? ''}
                          onChange={(e) => setDayWiseForm({ ...dayWiseForm, afternoon_price: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Evening Price (6 PM - 12 AM) (₹)</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Leave empty or set ₹"
                          min="0"
                          value={dayWiseForm.evening_price ?? ''}
                          onChange={(e) => setDayWiseForm({ ...dayWiseForm, evening_price: e.target.value })}
                        />
                      </div>
                    </div>
                  )
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={dayWiseSaving || !dayWiseTurf || !dayWiseDay}>
                  {dayWiseSaving ? 'Saving...' : 'Save Day-Wise Pricing'}
                </button>
              </form>
            </div>

            <div className="grid-2">
              <div className="card">
                <h3 style={{ marginBottom: '1.5rem' }}>💰 Set Special Pricing</h3>
                <form onSubmit={handleSaveSpecialPricing}>
                  <div className="form-group">
                    <label className="form-label">Choose Turf</label>
                    <select className="form-input" value={specialPricingTurf} 
                      onChange={(e) => {
                        const turfId = e.target.value;
                        setSpecialPricingTurf(turfId);
                        setSpecialPricingCourtId('');
                        loadSpecialPricing(turfId);
                        loadSlotCourts(turfId);
                      }} required>
                      <option value="">Select Turf</option>
                      {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  {specialPricingTurf && (
                    <div className="form-group">
                      <label className="form-label">Court / Default Pricing</label>
                      <select className="form-input" value={specialPricingCourtId}
                        onChange={(e) => {
                          setSpecialPricingCourtId(e.target.value);
                          loadSpecialPricing(specialPricingTurf, e.target.value);
                        }}>
                        <option value="">Default turf pricing</option>
                        {slotCourts.map(court => <option key={court.id} value={court.id}>{court.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button type="button" 
                      className={`btn ${specialPricingMode === 'day' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSpecialPricingMode('day')} style={{ flex: 1 }}>
                      Day Basis
                    </button>
                    <button type="button" 
                      className={`btn ${specialPricingMode === 'date' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSpecialPricingMode('date')} style={{ flex: 1 }}>
                      Specific Date
                    </button>
                  </div>

                  {specialPricingMode === 'day' ? (
                    <div className="form-group">
                      <label className="form-label">Select Day</label>
                      <select className="form-input" value={specialPricingDay} onChange={(e) => setSpecialPricingDay(e.target.value)} required>
                        <option value="">Select Day</option>
                        {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Select Date</label>
                      <input type="date" className="form-input" value={specialPricingDate} onChange={(e) => setSpecialPricingDate(e.target.value)} required />
                    </div>
                  )}

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Time Slot</label>
                      <select className="form-input" value={specialPricingTimeSlot} onChange={(e) => setSpecialPricingTimeSlot(e.target.value)} required>
                        <option value="">Select Slot</option>
                        {specialPricingSlots.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Special Price (₹)</label>
                      <input type="number" className="form-input" placeholder="₹" value={specialPricingPrice} 
                        onChange={(e) => setSpecialPricingPrice(e.target.value)} required />
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Offer Percentage (Optional)</label>
                      <input type="number" className="form-input" placeholder="e.g. 20"
                        value={couponForm.offer_percentage} onChange={(e) => setCouponForm({ ...couponForm, offer_percentage: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Offer Label (Optional)</label>
                      <input type="text" className="form-input" placeholder="e.g. Morning Deal"
                        value={couponForm.offer_label} onChange={(e) => setCouponForm({ ...couponForm, offer_label: e.target.value })} />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                    Save Special Pricing
                  </button>
                </form>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '1.5rem' }}>📋 Existing Special Prices</h3>
                {specialPricingLoading ? (
                  <p>Loading...</p>
                ) : specialPricingList.length > 0 ? (
                  <div style={{ overflowY: 'auto', maxHeight: '400px' }}>
                    <table className="data-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Apply On</th>
                          <th>Slot</th>
                          <th>Price</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {specialPricingList.map(p => (
                          <tr key={p.id}>
                            <td>{p.specific_date ? formatDate(p.specific_date) : DAYS_OF_WEEK.find(d => d.value === p.day_of_week)?.label}</td>
                            <td>{formatSlotTime(p.time_slot)}</td>
                            <td style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>₹{p.special_price}</td>
                            <td>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSpecialPricing(p.id)}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No special pricing set for this turf</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ COUPONS TAB ═══════ */}
        {activeTab === 'coupons' && (
          <div>
            <div className="grid-2">
              <div className="card">
                <h3 style={{ marginBottom: '1.5rem' }}>🎟️ Create New Coupon</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setCouponLoading(true);
                  try {
                    if (editingCoupon) {
                      await apiPut(`/coupons/${editingCoupon.id}`, couponForm);
                      alert('Coupon updated!');
                    } else {
                      await apiPost('/coupons', couponForm);
                      alert('Coupon created!');
                    }
                    setCouponForm({
                      code: '',
                      discount_type: 'flat',
                      discount_value: '',
                      valid_from: '',
                      valid_until: '',
                      expiry_date: '',
                      turf_id: '',
                      court_id: '',
                      max_uses: '',
                      per_user_limit: '',
                      min_booking_amount: '',
                      max_discount_cap: '',
                      offer_percentage: '',
                      offer_label: ''
                    });
                    setEditingCoupon(null);
                    loadCoupons();
                  } catch (err) {
                    alert(err.message);
                  } finally {
                    setCouponLoading(false);
                  }
                }}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Coupon Code</label>
                      <input type="text" className="form-input" placeholder="e.g. WELCOME50" required
                        value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Apply to Turf</label>
                      <select className="form-input" required value={couponForm.turf_id}
                        onChange={(e) => setCouponForm({ ...couponForm, turf_id: e.target.value, court_id: '' })}>
                        <option value="">Select Turf</option>
                        {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Applicable Court</label>
                    <select
                      className="form-input"
                      value={couponForm.court_id}
                      onChange={(e) => setCouponForm({ ...couponForm, court_id: e.target.value })}
                    >
                      <option value="">All Courts</option>
                      {courts
                        .filter(c => String(c.turf_id) === String(couponForm.turf_id))
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.sport_type})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Discount Type</label>
                      <select className="form-input" value={couponForm.discount_type}
                        onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}>
                        <option value="flat">Flat (₹)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Discount Value</label>
                      <input type="number" className="form-input" placeholder="Value" required
                        value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Valid From (Optional)</label>
                      <input type="date" className="form-input" 
                        value={couponForm.valid_from} onChange={(e) => setCouponForm({ ...couponForm, valid_from: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valid Until (Optional)</label>
                      <input type="date" className="form-input"
                        value={couponForm.valid_until} onChange={(e) => setCouponForm({ ...couponForm, valid_until: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Total Usage Limit (Optional)</label>
                      <input type="number" className="form-input" placeholder="e.g. 100"
                        value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Per User Limit (Optional)</label>
                      <input type="number" className="form-input" placeholder="e.g. 1"
                        value={couponForm.per_user_limit} onChange={(e) => setCouponForm({ ...couponForm, per_user_limit: e.target.value })} />
                    </div>
                  </div>

                  {couponForm.discount_type === 'percentage' && (
                    <div className="form-group">
                      <label className="form-label">Maximum Discount Cap (Optional)</label>
                      <input type="number" className="form-input" placeholder="e.g. 150"
                        value={couponForm.max_discount_cap} onChange={(e) => setCouponForm({ ...couponForm, max_discount_cap: e.target.value })} />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Min Booking Amount (₹)</label>
                    <input type="number" className="form-input" placeholder="e.g. 500"
                      value={couponForm.min_booking_amount} onChange={(e) => setCouponForm({ ...couponForm, min_booking_amount: e.target.value })} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={couponLoading}>
                    {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                  </button>
                  {editingCoupon && (
                    <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} 
                      onClick={() => {
                        setEditingCoupon(null);
                        setCouponForm({
                          code: '',
                          discount_type: 'flat',
                          discount_value: '',
                          valid_from: '',
                          valid_until: '',
                          expiry_date: '',
                          turf_id: '',
                          court_id: '',
                          max_uses: '',
                          per_user_limit: '',
                          min_booking_amount: '',
                          max_discount_cap: '',
                          offer_percentage: '',
                          offer_label: ''
                        });
                      }}>
                      Cancel Edit
                    </button>
                  )}
                </form>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '1.5rem' }}>🎟️ Active Coupons</h3>
                {coupons.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Value</th>
                          <th>Turf</th>
                          <th>Expiry</th>
                          <th>Usage</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coupons.map(coupon => (
                          <tr key={coupon.id}>
                            <td>
                              <span style={{ fontWeight: 800, color: 'var(--emerald-400)', fontFamily: 'monospace', letterSpacing: '1px' }}>
                                {coupon.code}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: 'var(--gold-400)', fontWeight: 600 }}>
                                {coupon.discount_type === 'flat' ? `₹${coupon.discount_value}` : `${coupon.discount_value}%`}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{coupon.turf_name}</td>
                            <td style={{ fontSize: '0.85rem' }}>
                              {coupon.expiry_date ? (
                                <span style={{ color: coupon.is_expired ? '#f87171' : 'var(--text-secondary)' }}>
                                  {formatDate(coupon.expiry_date)}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Never</span>
                              )}
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>
                              {coupon.max_uses ? (
                                <span>{coupon.used_count}/{coupon.max_uses}</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>{coupon.used_count} used</span>
                              )}
                            </td>
                            <td>
                              <span className={`status-badge ${coupon.is_expired ? 'status-cancelled' : 'status-confirmed'}`}>
                                {coupon.is_expired ? 'Expired' : (coupon.is_active ? 'Active' : 'Inactive')}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setEditingCoupon(coupon);
                                    setCouponForm({
                                      code: coupon.code,
                                      discount_type: coupon.discount_type,
                                      discount_value: coupon.discount_value,
                                      valid_from: coupon.valid_from ? String(coupon.valid_from).slice(0, 10) : '',
                                      valid_until: coupon.valid_until ? String(coupon.valid_until).slice(0, 10) : '',
                                      expiry_date: coupon.expiry_date || '',
                                      turf_id: coupon.turf_id,
                                      court_id: coupon.court_id || '',
                                      max_uses: coupon.max_uses || '',
                                      per_user_limit: coupon.per_user_limit || '',
                                      max_discount_cap: coupon.max_discount_cap || '',
                                      min_booking_amount: coupon.min_booking_amount || ''
                                    });
                                  }}>
                                  ✏️
                                </button>
                                <button
                                  className={`btn btn-sm ${coupon.is_active ? 'btn-danger' : 'btn-primary'}`}
                                  onClick={async () => {
                                    try {
                                      await apiPut(`/coupons/${coupon.id}`, { is_active: !coupon.is_active });
                                      loadCoupons();
                                    } catch (err) {
                                      alert(err.message);
                                    }
                                  }}
                                  disabled={coupon.is_expired}
                                >
                                  {coupon.is_active ? 'Disable' : 'Enable'}
                                </button>
                                <button className="btn btn-danger btn-sm"
                                  onClick={async () => {
                                    if (!confirm('Delete this coupon?')) return;
                                    try {
                                      await apiDelete(`/coupons/${coupon.id}`);
                                      alert('Coupon deleted!');
                                      loadCoupons();
                                    } catch (err) {
                                      alert(err.message);
                                    }
                                  }}>
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <div className="empty-icon">🎟️</div>
                    <h3>No coupons yet</h3>
                    <p>Create coupons to offer discounts to your customers</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ VENUE BILLING TAB ═══════ */}
        {activeTab === 'billing' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ marginBottom: 4 }}>Venue Billing &amp; Subscriptions</h2>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Each venue’s assigned platform billing terms and payment history.</p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={loadOwnerBilling} disabled={billingLoading}>Refresh</button>
            </div>
            {billingError && <div className="card" role="alert" style={{ color: '#ef4444', marginBottom: 12 }}>{billingError}</div>}
            {billingLoading && ownerBilling.length === 0 ? <div className="card">Loading venue billing…</div> : null}
            {!billingLoading && ownerBilling.length === 0 && !billingError ? <div className="card">No venues have billing information yet.</div> : null}
            <div className="grid-2">
              {ownerBilling.map((venue) => {
                const b = venue.billing || {};
                const s = b.subscription;
                const cycle = s?.cycles?.find((item) => item.cycle_start === s.current?.start);
                const amount = (minor, currency = b.currency || venue.currency || 'INR') => {
                  if (minor == null) return '—';
                  const digits = { KWD: 3, OMR: 3, BHD: 3, JPY: 0 }[currency] ?? 2;
                  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: digits }).format(Number(minor) / (10 ** digits));
                };
                const status = cycle?.status || (b.billing_model ? 'ACTIVE' : 'NOT_CONFIGURED');
                const canPay = b.billing_model === 'SUBSCRIPTION' && b.subscription_policy === 'SEPARATE' && cycle?.outstandingMinor > 0;
                const busyKey = `${venue.id}:${cycle?.id}`;
                return (
                  <section key={venue.id} className="card" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div><h3 style={{ margin: 0 }}>{venue.name}</h3><small style={{ color: 'var(--text-muted)' }}>Venue ID {venue.id} · {venue.sport_type || 'Sports'}</small></div>
                      <span className="status-badge">{status.replace(/_/g, ' ').toLowerCase()}</span>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      {b.restriction?.active && <div role="alert" style={{ border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.1)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                        <strong>New bookings are temporarily restricted.</strong>
                        <p style={{ margin: '6px 0' }}>This affects new bookings only. Existing and confirmed bookings, your owner panel, billing, and history remain available.</p>
                        <small>Outstanding when applied: {amount(b.restriction.active.outstanding_minor, b.restriction.active.currency || b.currency)} · Applied {new Date(b.restriction.active.applied_at).toLocaleString()}{b.restriction.active.reason ? ` · Reason: ${b.restriction.active.reason}` : ''}</small>
                      </div>}
                      <p><strong>Billing model:</strong> {b.billing_model || 'Not configured'}</p>
                      {b.billing_model === 'SUBSCRIPTION' && <>
                        <p><strong>Plan:</strong> {b.subscription_period || 'Subscription'} subscription</p>
                        <p><strong>Cycle:</strong> {cycle ? `${cycle.cycle_start} – ${cycle.cycle_end}` : (s?.current ? `${s.current.start} – ${s.current.end}` : 'Not started')}</p>
                        {cycle && <><p><strong>Due date:</strong> {cycle.due_date}</p><p><strong>Amount due:</strong> {amount(cycle.outstandingMinor)}</p><p><strong>Amount paid:</strong> {amount(cycle.paidSeparatelyMinor)}</p></>}
                        <p><strong>Payment method:</strong> {b.subscription_policy === 'SEPARATE' ? 'Separate payment' : 'Deducted from eligible booking proceeds'}</p>
                      </>}
                      {b.billing_model === 'PERCENTAGE' && <p><strong>Platform commission:</strong> {b.commission_percent ?? '—'}% of eligible captured booking amounts. Past transfers retain their saved calculation.</p>}
                      {b.billing_model === 'FLAT' && <p><strong>Platform fee:</strong> {amount(b.flat_fee_minor)} per eligible booking.</p>}
                      {canPay && <button type="button" className="btn btn-primary" style={{ minHeight: 44, width: '100%' }} disabled={billingBusyCycle === busyKey} onClick={() => payVenueBilling(venue, cycle)}>{billingBusyCycle === busyKey ? 'Verifying…' : `Pay ${amount(cycle.outstandingMinor)} now`}</button>}
                      {b.payment_history?.length > 0 && <details style={{ marginTop: 12 }}><summary>Payment history ({b.payment_history.length})</summary>
                        {b.payment_history.map((p) => <p key={p.id} style={{ fontSize: '0.85rem', margin: '8px 0' }}>{amount(p.amount_minor)} · {p.status.toLowerCase()} · {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}{p.razorpay_payment_id ? ` · ${p.razorpay_payment_id}` : ''}</p>)}
                      </details>}
                      {b.restriction?.history?.length > 0 && <details style={{ marginTop: 12 }}><summary>Restriction history ({b.restriction.history.length})</summary>
                        {b.restriction.history.map((item) => <p key={item.id} style={{ fontSize: '0.85rem', margin: '8px 0' }}>
                          Applied {new Date(item.applied_at).toLocaleString()} · {amount(item.outstanding_minor, item.currency)} · {item.reason}
                          {item.removed_at ? ` · Removed ${new Date(item.removed_at).toLocaleString()}: ${item.remove_reason || '—'}` : ' · Still active'}
                        </p>)}
                      </details>}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════ EARNINGS TAB ═══════ */}
        {activeTab === 'earnings' && (
          <div>
            <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <select 
                className="form-input" 
                style={{ width: 'auto', minWidth: '200px' }}
                value={earningsTurfId}
                onChange={(e) => setEarningsTurfId(e.target.value)}
              >
                {turfs.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                <select
                  className="form-input"
                  style={{ width: 'auto', minWidth: '160px' }}
                  value={earningsRangeType}
                  onChange={(e) => handleOwnerRangeChange(e.target.value)}
                >
                  <option value="7">Last 7 days</option>
                  <option value="10">Last 10 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="custom">Custom range</option>
                </select>

                {earningsRangeType === 'custom' && (
                  <>
                    <input
                      type="date"
                      className="form-input"
                      value={earningsStartDate}
                      min={ownerDateInputMin}
                      max={ownerDateInputMax}
                      onChange={(e) => setEarningsStartDate(e.target.value)}
                      style={{ width: 'auto' }}
                    />
                    <input
                      type="date"
                      className="form-input"
                      value={earningsEndDate}
                      min={earningsStartDate || ownerDateInputMin}
                      max={ownerDateInputMax}
                      onChange={(e) => setEarningsEndDate(e.target.value)}
                      style={{ width: 'auto' }}
                    />
                    <button className="btn btn-primary" onClick={applyOwnerCustomRange}>
                      Apply
                    </button>
                  </>
                )}
              </div>
            </div>
            <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Showing earnings for <strong style={{ color: 'var(--text-secondary)' }}>{ownerRangeLabel}</strong>
            </div>
            <div className="grid-4" style={{ marginBottom: '2rem' }}>
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-value">{formatPrice(earnings?.total || 0)}</div>
                <div className="stat-label">Overall Slot Value</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📅</div>
                <div className="stat-value">{formatPrice(ownerRangeSummary?.slot_value || 0)}</div>
                <div className="stat-label">Selected Range Slot Value</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💳</div>
                <div className="stat-value">{formatPrice(ownerRangeSummary?.razorpay_collected || 0)}</div>
                <div className="stat-label">Collected via Razorpay</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🏟️</div>
                <div className="stat-value">{formatPrice(ownerRangeSummary?.venue_cash || 0)}</div>
                <div className="stat-label">Venue / Cash Due</div>
              </div>
            </div>

            <div className="grid-3" style={{ marginBottom: '2rem' }}>
              <div className="card" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Owner blocked value</div>
                <div style={{ color: 'var(--amber-400)', fontWeight: 800, fontSize: '1.3rem' }}>{formatPrice(ownerRangeSummary?.blocked_value || 0)}</div>
              </div>
              <div className="card" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Customer booking value</div>
                <div style={{ color: 'var(--emerald-400)', fontWeight: 800, fontSize: '1.3rem' }}>{formatPrice(ownerRangeSummary?.customer_booking_value || 0)}</div>
              </div>
              <div className="card" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Legacy snapshot</div>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: '1rem' }}>Today {formatPrice(earnings?.today || 0)} | This month {formatPrice(earnings?.monthly || 0)}</div>
              </div>
            </div>

            {Object.values(ownerRangeSummary?.settlement_by_currency || {}).map((settlement) => (
              <section className="card" key={settlement.currency} style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>Payment settlement · {settlement.currency}</h3>
                <div className="grid-3">
                  <div><small>Gross captured</small><strong style={{ display: 'block' }}>{formatSettlementMoney(settlement.captured_minor, settlement.currency)}</strong></div>
                  <div><small>Platform fee (saved settlement)</small><strong style={{ display: 'block' }}>{formatSettlementMoney(settlement.platform_fee_minor, settlement.currency)}</strong></div>
                  <div><small>Tax liability</small><strong style={{ display: 'block' }}>{formatSettlementMoney(settlement.tax_minor, settlement.currency)}</strong></div>
                  <div><small>Subscription deduction</small><strong style={{ display: 'block' }}>{formatSettlementMoney(settlement.subscription_deduction_minor, settlement.currency)}</strong></div>
                  <div><small>Owner transfer confirmed</small><strong style={{ display: 'block' }}>{formatSettlementMoney(settlement.settled_owner_transfer_minor, settlement.currency)}</strong></div>
                  <div><small>Owner transfer pending</small><strong style={{ display: 'block' }}>{formatSettlementMoney(settlement.pending_owner_transfer_minor, settlement.currency)}</strong></div>
                </div>
                <small style={{ color: 'var(--text-muted)' }}>{ownerRangeSummary?.settlement_definition}</small>
              </section>
            ))}

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
              📅 Daily Earnings Breakdown
            </h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Slot Value</th>
                    <th>Razorpay</th>
                    <th>Venue / Cash</th>
                    <th>Owner Blocked</th>
                    <th>Payment Status</th>
                    <th>Payment Split</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings?.daily?.length > 0 ? (
                    earnings.daily.map((d, i) => {
                      const totalValue = Math.max(0, Number(d.earnings || 0));
                      const razorpayWidth = totalValue > 0 ? (Number(d.razorpay_paid || 0) / totalValue) * 100 : 0;
                      const venueCashWidth = totalValue > 0 ? (Number(d.venue_cash || 0) / totalValue) * 100 : 0;
                      const blockedWidth = totalValue > 0 ? (Number(d.blocked_value || 0) / totalValue) * 100 : 0;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>
                            {new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                          </td>
                          <td style={{ color: 'var(--emerald-400)', fontWeight: 800 }}>
                            {formatPrice(d.earnings)}
                          </td>
                          <td>
                            <div style={{ color: '#60a5fa', fontWeight: 700 }}>{formatPrice(d.razorpay_paid || 0)}</div>
                          </td>
                          <td>
                            <div style={{ color: 'var(--gold-400)', fontWeight: 700 }}>{formatPrice(d.venue_cash || 0)}</div>
                          </td>
                          <td>
                            <div style={{ color: 'var(--amber-400)', fontWeight: 700 }}>{formatPrice(d.blocked_value || 0)}</div>
                          </td>
                          <td>
                            {d.has_owner_blocked && !d.has_customer_bookings ? (
                              <span style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.65rem',
                                borderRadius: '100px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: 'var(--amber-400)',
                                border: '1px solid rgba(245, 158, 11, 0.3)'
                              }}>Booked by Owner</span>
                            ) : d.status === 'paid' ? (
                              <span className="status-badge status-confirmed" title={`Paid at: ${d.paid_at ? new Date(d.paid_at).toLocaleString() : 'N/A'}`}>Paid</span>
                            ) : (
                              <span className="status-badge status-pending">Not Paid</span>
                            )}
                          </td>
                          <td style={{ width: '25%' }}>
                            <div style={{ background: 'var(--bg-secondary)', height: '9px', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                              <div style={{
                                background: '#3b82f6',
                                height: '100%',
                                width: `${Math.max(0, Math.min(100, razorpayWidth))}%`
                              }}></div>
                              <div style={{
                                background: '#f59e0b',
                                height: '100%',
                                width: `${Math.max(0, Math.min(100, venueCashWidth))}%`
                              }}></div>
                              <div style={{
                                background: '#8b5cf6',
                                height: '100%',
                                width: `${Math.max(0, Math.min(100, blockedWidth))}%`
                              }}></div>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                              {Math.round((d.earnings / ownerDailyMax) * 100)}% of peak day
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No data for the selected range yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>💡 Legend:</strong> &nbsp;
                <span style={{ color: 'var(--emerald-400)' }}>Slot Value</span> = full price/value for the day. &nbsp;
                <span style={{ color: '#60a5fa' }}>Razorpay</span> = amount received online. &nbsp;
                <span style={{ color: 'var(--gold-400)' }}>Venue / Cash</span> = amount still payable at venue. &nbsp;
                <span style={{ color: 'var(--amber-400)' }}>Owner Blocked</span> = slot blocked by you with no customer payment. &nbsp;
                <strong>Paid / Not Paid</strong> status is managed by admin.
              </p>
            </div>
          </div>
        )}
        {/* ═══════ SESSIONS TAB ═══════ */}
        {activeTab === 'sessions' && (
          <div>
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>⏰ Custom Slot Sessions</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Create custom time labels (like "Morning Peak", "Night Game") for your slots. 
                These will appear as filter tabs for customers.
              </p>

              <form onSubmit={handleAddSession}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Select Turf *</label>
                    <select className="form-input" value={sessionForm.turf_id} 
                      onChange={(e) => setSessionForm({ ...sessionForm, turf_id: e.target.value })} required>
                      <option value="">Choose a turf...</option>
                      {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Session Name *</label>
                    <input type="text" className="form-input" placeholder="e.g. Morning Peak"
                      value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })} required />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Start Time *</label>
                    <input type="time" className="form-input"
                      value={sessionForm.start_time} onChange={(e) => setSessionForm({ ...sessionForm, start_time: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time *</label>
                    <input type="time" className="form-input"
                      value={sessionForm.end_time} onChange={(e) => setSessionForm({ ...sessionForm, end_time: e.target.value })} required />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={!sessionForm.turf_id}>
                  Add Custom Session
                </button>
              </form>
            </div>

            {sessionForm.turf_id && (
              <div className="card">
                <h3>Current Sessions for {turfs.find(t => t.id == sessionForm.turf_id)?.name}</h3>
                {sessionsLoading ? (
                  <div className="loading-spinner" />
                ) : sessions.length > 0 ? (
                  <div style={{ marginTop: '1.5rem' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Time Range</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map(s => (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                            <td>{s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}</td>
                            <td><span className="status-badge status-confirmed">Enabled</span></td>
                            <td>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSession(s.id)}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ color: 'var(--text-muted)' }}>No custom sessions. Using default labels.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════ SUBSCRIPTIONS TAB ═══════ */}
        {activeTab === 'subscriptions' && (
          <div>
            <div className="grid-2">
              <div className="card">
                <h3>💎 Create Monthly Subscription Plan</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  Define fixed daily slots for monthly subscribers.
                </p>
                <form onSubmit={handleSaveSubPlan}>
                  <div className="form-group">
                    <label className="form-label">Plan Name *</label>
                    <input type="text" className="form-input" placeholder="e.g. Early Bird Cricket"
                      value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} required />
                  </div>
                  
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Select Turf *</label>
                      <select className="form-input" value={subForm.turf_id} 
                        onChange={(e) => {
                          setSubForm({ ...subForm, turf_id: e.target.value, court_id: '' });
                          loadCourts(e.target.value);
                        }} required>
                        <option value="">Choose Turf...</option>
                        {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Select Court (Optional)</label>
                      <select className="form-input" value={subForm.court_id} 
                        onChange={(e) => setSubForm({ ...subForm, court_id: e.target.value })}>
                        <option value="">Full Turf / Main Area</option>
                        {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Monthly Price (₹) *</label>
                      <input type="number" className="form-input" placeholder="e.g. 5000"
                        value={subForm.price} onChange={(e) => setSubForm({ ...subForm, price: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Duration (Months) *</label>
                      <select className="form-input" value={subForm.duration_months} 
                        onChange={(e) => setSubForm({ ...subForm, duration_months: parseInt(e.target.value) })}>
                        <option value={1}>1 Month</option>
                        <option value={3}>3 Months</option>
                        <option value={6}>6 Months</option>
                        <option value={12}>12 Months</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Daily Start Time *</label>
                      <input type="time" className="form-input" value={subForm.start_time}
                        onChange={(e) => setSubForm({ ...subForm, start_time: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Daily End Time *</label>
                      <input type="time" className="form-input" value={subForm.end_time}
                        onChange={(e) => setSubForm({ ...subForm, end_time: e.target.value })} required />
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Max Subscribers for this Slot *</label>
                      <input type="number" className="form-input" value={subForm.max_subscribers}
                        onChange={(e) => setSubForm({ ...subForm, max_subscribers: parseInt(e.target.value) })} required min="1" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Time Format *</label>
                      <select className="form-input" value={subForm.time_format}
                        onChange={(e) => setSubForm({ ...subForm, time_format: e.target.value })}>
                        <option value="12h">12-Hour (AM/PM)</option>
                        <option value="24h">24-Hour (00:00)</option>
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Plan</button>
                </form>
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>📊 Active Subscribers ({activeSubscribers.length})</h3>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    setMemberForm({ plan_id: subPlans[0]?.id || '', name: '', phone: '', email: '', amount_paid: '', payment_type: 'offline' });
                    setShowAddMemberModal(true);
                  }}>
                    ➕ Add Member
                  </button>
                </div>
                {subLoading ? <div className="loading-spinner" /> : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Plan</th>
                          <th>Expiry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSubscribers.map(sub => (
                          <tr key={sub.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{sub.member_name || sub.user_name || 'Member'}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{sub.member_phone || sub.member_email || sub.user_email || '—'}</div>
                            </td>
                            <td>{sub.plan_name}</td>
                            <td style={{ color: 'var(--emerald-400)' }}>{new Date(sub.expiry_date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        {activeSubscribers.length === 0 && (
                          <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>No active subscribers</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Manual Member Addition Modal */}
            {showAddMemberModal && (
              <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 9999 }}>
                <div className="card" style={{ padding: '2rem', maxWidth: 480, width: '90%' }}>
                  <h3 style={{ marginBottom: '1rem' }}>➕ Add Member to Subscription</h3>
                  <form onSubmit={handleAddMember}>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Subscription Plan *</label>
                      <select className="form-input" value={memberForm.plan_id}
                        onChange={(e) => setMemberForm({ ...memberForm, plan_id: e.target.value })} required>
                        <option value="">Select Plan</option>
                        {subPlans.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.start_time.substring(0, 5)} - {p.end_time.substring(0, 5)}) - {p.active_count ?? p.current_subscribers ?? 0}/{p.max_subscribers} members
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Member Name *</label>
                      <input className="form-input" value={memberForm.name}
                        onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} required placeholder="Full Name" />
                    </div>
                    <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input className="form-input" value={memberForm.phone}
                          onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} placeholder="Mobile Number" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="form-input" type="email" value={memberForm.email}
                          onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} placeholder="Email address" />
                      </div>
                    </div>
                    <div className="grid-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                      <div className="form-group">
                        <label className="form-label">Amount Paid</label>
                        <input className="form-input" type="number" min="0" step="any" value={memberForm.amount_paid}
                          onChange={(e) => setMemberForm({ ...memberForm, amount_paid: e.target.value })} placeholder="0.00" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Payment Mode</label>
                        <select className="form-input" value={memberForm.payment_type}
                          onChange={(e) => setMemberForm({ ...memberForm, payment_type: e.target.value })}>
                          <option value="offline">Cash / Offline</option>
                          <option value="upi">UPI</option>
                          <option value="complimentary">Complimentary</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddMemberModal(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={addingMember}>{addingMember ? 'Adding…' : 'Add Member'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="card" style={{ marginTop: '2rem' }}>
              <h3>📜 All Subscription Plans</h3>
              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Plan Name</th>
                      <th>Timings</th>
                      <th>Price</th>
                      <th>Capacity</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subPlans.map(plan => (
                      <tr key={plan.id}>
                        <td style={{ fontWeight: 700 }}>{plan.name}</td>
                        <td>{plan.start_time.substring(0, 5)} - {plan.end_time.substring(0, 5)}</td>
                        <td style={{ color: 'var(--emerald-400)', fontWeight: 800 }}>{formatPrice(plan.price)}</td>
                        <td>{plan.active_count ?? plan.current_subscribers ?? 0} / {plan.max_subscribers}</td>
                        <td>
                          <button className="btn btn-danger btn-sm">Disable</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'matches' && (
          <div className="card">
            <h3>🤝 Match Requests You've Created</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>View and manage player requests for your matches. Approve or reject players as needed.</p>
            
            {matchLoading ? (
              <div className="flex-center" style={{ minHeight: '300px' }}>
                <div className="loading-spinner" />
              </div>
            ) : matchRequests.length === 0 ? (
              <div className="empty-state-small" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                <h4>No Match Requests Yet</h4>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Create a match request from the Find Players page to get started.</p>
                <Link to="/find-players" className="btn btn-primary" style={{ display: 'inline-block' }}>
                  Publish a Match Request
                </Link>
              </div>
            ): (
              <div style={{ display: 'grid', gap: '2rem' }}>
                {matchRequests.map(match => {
                  const isUrgent = new Date(`${match.match_date}T${match.match_time}`) - new Date() < 2 * 60 * 60 * 1000;
                  const sport = getSportInfo(match.sport_type);
                  let roles = [];
                  try {
                    roles = Array.isArray(match.roles_needed)
                      ? match.roles_needed
                      : (typeof match.roles_needed === 'string'
                          ? JSON.parse(match.roles_needed || '[]')
                          : []);
                  } catch (e) {
                    console.error('Failed to parse roles in OwnerDashboard:', e);
                    roles = [];
                  }
                  const emptySlots = match.total_slots - match.filled_slots;
                  
                  return (
                    <div key={match.id} style={{
                      background: 'var(--bg-card)',
                      border: `2px solid ${isUrgent ? 'var(--emerald-500)' : 'var(--border-subtle)'}`,
                      borderRadius: '16px',
                      padding: '2rem',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '2rem'
                    }}>
                      {/* LEFT: MATCH INFO */}
                      <div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                          <span style={{ fontSize: '2rem' }}>{sport.emoji}</span>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 0.5rem 0' }}>{match.turf_name}</h4>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              📅 {formatDate(match.match_date)} • 🕒 {match.match_time.substring(0, 5)}
                            </div>
                            {isUrgent && (
                              <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem', fontWeight: 700 }}>
                                🔥 URGENT (starts within 2h)
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ background: 'rgba(16,185,129,0.1)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Players</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--emerald-400)' }}>
                            {match.filled_slots}/{match.total_slots}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            {emptySlots} slots available
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {roles.map(role => (
                            <span key={role} style={{
                              background: 'rgba(16,185,129,0.15)',
                              color: 'var(--emerald-400)',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}>
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* RIGHT: PLAYERS LIST & ACTIONS */}
                      <div>
                        <div style={{ marginBottom: '1rem' }}>
                          <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                            Players Joined ({match.player_count || 0})
                          </h5>
                          
                          {/* In real app, would fetch players for this match using match detail API */}
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              View joined players on the <Link to={`/match/${match.id}`} style={{ color: 'var(--emerald-400)', fontWeight: 600 }}>match detail page</Link>
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '2rem' }}>
                          <button 
                            className="btn btn-secondary"
                            onClick={() => handleCancelMatch(match.id)}
                            style={{ fontSize: '0.85rem' }}
                          >
                            ❌ Cancel Match
                          </button>
                          <Link 
                            to={`/match/${match.id}`}
                            className="btn btn-primary"
                            style={{ fontSize: '0.85rem', textAlign: 'center' }}
                          >
                            👁️ View Details
                          </Link>
                        </div>

                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          💡 Manage players: approve/reject from the match detail page
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════ TOURNAMENTS TAB ═══════ */}
        {activeTab === 'tournaments' && (
          <HostTournaments owner={owner} />
        )}
      </main>
    </div>
  );
}
