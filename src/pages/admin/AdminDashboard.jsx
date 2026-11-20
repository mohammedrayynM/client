
import { useState, useEffect } from 'react';
import { useNavigate as useRouter } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { API_BASE, apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { formatPrice, formatCompactNumber, formatDate, getSportInfo, AMENITIES_LIST } from '@/lib/constants';
import AdminTournaments from './AdminTournaments';
import AdminApprovals from './AdminApprovals';
import AdminRoute from './AdminRoute';
import { FinanceOverview, PaymentLookup, VenueBilling, FeeRules } from './AdminFinance';
import { AuthSettings, SportCategories } from './AdminDiscovery';
import { setPageMeta } from '@/lib/seo';
import MoreActions from '@/components/MoreActions';

const ADMIN_PAYOUT_HISTORY_DAYS = 90;

function formatAdminInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getAdminTodayInputDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return formatAdminInputDate(today);
}

function getAdminDaysAgoInputDate(daysAgo) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return formatAdminInputDate(date);
}

function getAdminDateDiffInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [turfs, setTurfs] = useState([]);
  const [owners, setOwners] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [payoutSummary, setPayoutSummary] = useState(null);
  const [payoutRangeType, setPayoutRangeType] = useState('30');
  const [payoutStartDate, setPayoutStartDate] = useState(() => getAdminDaysAgoInputDate(29));
  const [payoutEndDate, setPayoutEndDate] = useState(() => getAdminTodayInputDate());
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Billing Model Modal
  const [billingModalTurf, setBillingModalTurf] = useState(null);
  const [billingForm, setBillingForm] = useState({
    billing_model: 'PERCENTAGE',
    monthly_amount: 799,
    commission_percentage: 5,
    subscription_status: 'ACTIVE'
  });

  // Owner Deletion Modal
  const [deleteOwnerModal, setDeleteOwnerModal] = useState(null);

  // Promotional Notifications
  const [promoForm, setPromoForm] = useState({ title: '', message: '', target_audience: 'all', send_email: false });
  const [promoSending, setPromoSending] = useState(false);

  // Advertisements
  const [adsList, setAdsList] = useState([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [showAdForm, setShowAdForm] = useState(false);
  const [uploadingAdImage, setUploadingAdImage] = useState(false);
  const [adForm, setAdForm] = useState({
    title: '',
    description: '',
    image_url: '',
    sponsor_name: '',
    link_url: '',
    placement: 'HOME_BANNER',
    priority: 1,
    start_date: '',
    end_date: ''
  });

  // Inbox (Contact messages)
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Admin Coupons
  const [coupons, setCoupons] = useState([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    label: '',
    discount_type: 'flat',
    discount_value: '',
    min_booking_amount: '',
    max_discount_cap: '',
    valid_from: '',
    valid_until: '',
    max_uses: '',
    per_user_limit: '',
    applicable_sport: 'all'
  });

  // Turf form
  const [showTurfForm, setShowTurfForm] = useState(false);
  const [editingTurf, setEditingTurf] = useState(null);
  const [turfForm, setTurfForm] = useState({
    name: '', location: '', address: '', sport_type: 'cricket',
    price_per_hour: '', description: '', images: [], amenities: [],
    owner_email: ''
  });

  // Turf Analytics
  const [selectedTurfAnalytics, setSelectedTurfAnalytics] = useState(null);
  const [turfEarnings, setTurfEarnings] = useState(null);

  // Commission
  const [commission, setCommission] = useState('');

  // Match Management
  const [matchRequests, setMatchRequests] = useState([]);
  const [matchStats, setMatchStats] = useState(null);
  const [matchesLoading, setMatchesLoading] = useState(false);

  useEffect(() => {
    setPageMeta({
      title: 'Admin Dashboard — Book Arena',
      description: 'Admin dashboard for managing turfs, owners, bookings, and payouts on Book Arena.',
      keywords: 'book arena admin dashboard, manage turfs, manage bookings',
      robots: 'noindex, nofollow',
      canonicalUrl: 'https://bookarena.in/admin/dashboard'
    });

    const token = localStorage.getItem('token');
    const adminData = localStorage.getItem('admin');
    if (!token || !adminData) {
      router('/admin/login');
      return;
    }
    setAdmin(JSON.parse(adminData));
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      const [dashData, turfsData, ownersData, bookingsData, payoutsData, approvalsData] = await Promise.all([
        apiGet('/admin/dashboard').catch(() => ({ stats: {} })),
        apiGet('/admin/turfs').catch(() => ({ turfs: [] })),
        apiGet('/admin/owners').catch(() => ({ owners: [] })),
        apiGet('/admin/bookings').catch(() => ({ bookings: [] })),
        apiGet(buildAdminPayoutUrl()).catch((err) => { console.error('Payouts fetch error:', err); return { payouts: [], summary: null }; }),
        apiGet('/admin/pending-approvals').catch(() => ({ pendingVenues: [], pendingCourts: [] })),
      ]);
      setStats(dashData.stats || {});
      setTurfs(turfsData.turfs || []);
      setOwners(ownersData.owners || []);
      setBookings(bookingsData.bookings || []);
      setPayouts(payoutsData.payouts || []);
      setPayoutSummary(payoutsData.summary || null);
      const pVenues = approvalsData.pendingVenues || approvalsData.pending_turfs || [];
      const pCourts = approvalsData.pendingCourts || approvalsData.pending_courts || [];
      setPendingApprovalsCount(pVenues.length + pCourts.length);
      setCommission(dashData.stats?.commission_percent?.toString() ?? '10');
    } catch (err) {
      console.log('Using empty data');
    } finally {
      setLoading(false);
    }
  }

  function buildAdminPayoutUrl(rangeType = payoutRangeType, startDate = payoutStartDate, endDate = payoutEndDate) {
    const params = new URLSearchParams();
    if (rangeType === 'custom') {
      params.set('start_date', startDate);
      params.set('end_date', endDate);
    } else {
      params.set('range_days', rangeType || '30');
    }
    return `/admin/payouts?${params.toString()}`;
  }

  async function loadPayouts(options = {}) {
    const rangeType = options.rangeType ?? payoutRangeType;
    const startDate = options.startDate ?? payoutStartDate;
    const endDate = options.endDate ?? payoutEndDate;
    try {
      const data = await apiGet(buildAdminPayoutUrl(rangeType, startDate, endDate));
      setPayouts(data.payouts || []);
      setPayoutSummary(data.summary || null);
    } catch (err) {
      console.error('Failed to load payouts:', err);
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    router('/admin/login');
  }

  // -----------------------------------------------------------------------
  // Inbox (Contact messages)
  // -----------------------------------------------------------------------
  const unreadCount = (messages || []).reduce((acc, m) => acc + (m?.is_read ? 0 : 1), 0);

  async function loadMessages() {
    setMessagesLoading(true);
    try {
      const data = await apiGet('/admin/messages');
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function updateMessageRead(id, isRead) {
    try {
      await apiPut(`/admin/messages/${id}/read`, { is_read: !!isRead });
      setMessages(prev => prev.map(m => (Number(m.id) === Number(id) ? { ...m, is_read: !!isRead } : m)));
      setSelectedMessage(prev => (prev && Number(prev.id) === Number(id) ? { ...prev, is_read: !!isRead } : prev));
    } catch (err) {
      alert(err.message || 'Failed to update message');
    }
  }

  useEffect(() => {
    if (activeTab === 'messages') {
      loadMessages();
    }
  }, [activeTab]);

  // Realtime: push new Contact messages into admin inbox without refresh.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    let es;
    try {
      es = new EventSource(`${API_BASE}/admin/messages/events?token=${encodeURIComponent(token)}`);
    } catch {
      return;
    }

    const onCreated = (e) => {
      try {
        const payload = JSON.parse(e.data || '{}');
        const msg = payload.message;
        if (!msg?.id) return;
        setMessages(prev => {
          // de-dupe
          if (prev.some(m => Number(m.id) === Number(msg.id))) return prev;
          return [msg, ...prev];
        });
      } catch {
        // ignore
      }
    };

    es.addEventListener('contact_message_created', onCreated);

    return () => {
      try { es.close(); } catch {}
    };
  }, []);

  // -----------------------------------------------------------------------
  // Admin Coupons
  // -----------------------------------------------------------------------
  async function loadAdminCoupons() {
    setCouponLoading(true);
    try {
      const data = await apiGet('/admin/coupons');
      setCoupons(data.coupons || []);
    } catch (err) {
      console.error('Failed to load admin coupons:', err);
      setCoupons([]);
    } finally {
      setCouponLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'coupons') {
      loadAdminCoupons();
    }
  }, [activeTab]);

  async function saveAdminCoupon(e) {
    e.preventDefault();
    setCouponLoading(true);
    try {
      if (editingCoupon) {
        await apiPut(`/admin/coupons/${editingCoupon.id}`, couponForm);
        alert('Coupon updated!');
      } else {
        await apiPost('/admin/coupons', couponForm);
        alert('Coupon created!');
      }
      setEditingCoupon(null);
      setCouponForm({
        code: '',
        label: '',
        discount_type: 'flat',
        discount_value: '',
        min_booking_amount: '',
        max_discount_cap: '',
        valid_from: '',
        valid_until: '',
        max_uses: '',
        per_user_limit: '',
        applicable_sport: 'all'
      });
      loadAdminCoupons();
    } catch (err) {
      alert(err.message || 'Failed to save coupon');
    } finally {
      setCouponLoading(false);
    }
  }

  async function deleteAdminCoupon(couponId) {
    if (!confirm('Delete this coupon?')) return;
    try {
      await apiDelete(`/admin/coupons/${couponId}`);
      loadAdminCoupons();
    } catch (err) {
      alert(err.message || 'Failed to delete coupon');
    }
  }

  async function toggleAdminCoupon(c, nextActive) {
    try {
      await apiPut(`/admin/coupons/${c.id}`, { is_active: !!nextActive });
      setCoupons(prev => prev.map(x => (x.id === c.id ? { ...x, is_active: !!nextActive } : x)));
    } catch (err) {
      alert(err.message || 'Failed to update coupon');
    }
  }

  // Turf CRUD
  async function handleSaveTurf(e) {
    e.preventDefault();
    try {
      if (editingTurf) {
        await apiPut(`/admin/turfs/${editingTurf.id}`, turfForm);
      } else {
        await apiPost('/admin/turfs', turfForm);
      }
      setShowTurfForm(false);
      setEditingTurf(null);
      loadAllData();
    } catch (err) { alert(err.message); }
  }

  // Deleting archives the venue on the server (bookings, payments and refunds are kept) and hides it everywhere.
  // A venue with upcoming paid bookings / active subscriptions answers 409 first; the admin must confirm again.
  async function handleDeleteTurf(id, name = 'this venue') {
    if (!window.confirm(`Delete "${name}"?\n\nIt will be removed from the app and website and can no longer be booked. Its booking and payment history is kept.`)) return;
    try {
      let res;
      try {
        res = await apiDelete(`/admin/turfs/${id}`);
      } catch (err) {
        if (err.status !== 409 || err.data?.code !== 'VENUE_HAS_UPCOMING') throw err;
        if (!window.confirm(`${err.data.error}\n\nDelete it anyway?`)) return;
        res = await apiDelete(`/admin/turfs/${id}?force=1`);
      }
      alert(res?.message || 'Venue deleted.');
    } catch (err) {
      alert(err.status === 404 ? 'This venue no longer exists. The list has been refreshed.' : `Could not delete the venue: ${err.message}`);
    }
    loadAllData();
  }

  async function viewTurfAnalytics(turf) {
    try {
      const data = await apiGet(`/admin/turfs/${turf.id}/earnings`);
      setSelectedTurfAnalytics(turf);
      setTurfEarnings(data);
    } catch (err) {
      alert('Failed to load turf analytics: ' + err.message);
    }
  }

  async function handleDeleteTurfBookings(turfId) {
    if (!confirm('Clear abandoned booking attempts for this venue?\n\nOnly unpaid, failed or cancelled attempts where no money was taken are removed. Paid, confirmed and refunded bookings are always kept.')) return;
    try {
      const res = await apiDelete(`/admin/turfs/${turfId}/bookings`);
      alert(res?.message || 'Abandoned booking attempts cleared.');
      loadAllData();
      setSelectedTurfAnalytics(null);
    } catch (err) {
      alert(err.message);
    }
  }

  // Owner management
  async function approveOwner(id) {
    try { await apiPut(`/admin/owners/${id}/approve`); loadAllData(); }
    catch (err) { alert(err.message); }
  }

  async function rejectOwner(id) {
    try { await apiPut(`/admin/owners/${id}/reject`); loadAllData(); }
    catch (err) { alert(err.message); }
  }

  async function toggleBlockOwner(id, blocked) {
    try { await apiPut(`/admin/owners/${id}/block`, { is_blocked: !blocked }); loadAllData(); }
    catch (err) { alert(err.message); }
  }

  // Venue status toggle (block / unblock)
  async function toggleBlockTurf(turfId, currentStatus, currentIsActive) {
    const isCurrentlyBlocked = currentStatus === 'BLOCKED' || !currentIsActive;
    const newStatus = isCurrentlyBlocked ? 'ACTIVE' : 'BLOCKED';
    const confirmMsg = isCurrentlyBlocked 
      ? 'Unblock this venue and restore customer availability?'
      : 'Block this venue? Customers will not be able to book slots, and the venue will show as BLOCKED.';
    if (!confirm(confirmMsg)) return;

    try {
      await apiPut(`/admin/turfs/${turfId}/status`, { status: newStatus, is_active: newStatus === 'ACTIVE' });
      alert(`Venue ${newStatus === 'ACTIVE' ? 'unblocked' : 'blocked'}.`);
      loadAllData();
    } catch (err) {
      alert(err.message || 'Failed to update venue status');
    }
  }

  // Venue billing model configuration
  function openBillingModal(turf) {
    setBillingModalTurf(turf);
    setBillingForm({
      billing_model: turf.billing_model || 'PERCENTAGE',
      monthly_amount: turf.monthly_subscription_amount || 799,
      commission_percentage: turf.commission_percentage || 5.0,
      subscription_status: turf.subscription_status || 'ACTIVE',
      subscription_start_date: turf.subscription_start_date ? formatDate(turf.subscription_start_date) : '',
      next_billing_date: turf.next_billing_date ? formatDate(turf.next_billing_date) : ''
    });
  }

  async function handleSaveVenueBilling(e) {
    e.preventDefault();
    if (!billingModalTurf) return;
    try {
      await apiPut(`/admin/turfs/${billingModalTurf.id}/billing`, billingForm);
      alert('Venue billing configuration saved successfully!');
      setBillingModalTurf(null);
      loadAllData();
    } catch (err) {
      alert(err.message || 'Failed to update billing configuration');
    }
  }

  // Delete owner safely
  async function handleConfirmDeleteOwner(owner) {
    if (!owner) return;
    try {
      await apiDelete(`/admin/owners/${owner.id}`);
      alert(`Owner "${owner.name}" and associated venues deactivated. Historical records preserved.`);
      setDeleteOwnerModal(null);
      loadAllData();
    } catch (err) {
      alert(err.message || 'Failed to deactivate owner');
    }
  }

  // Send Promotional Notification & Email
  async function handleSendPromotion(e) {
    e.preventDefault();
    if (!promoForm.title || !promoForm.message) {
      alert('Title and message are required');
      return;
    }
    setPromoSending(true);
    try {
      const res = await apiPost('/admin/notifications/broadcast', {
        title: promoForm.title,
        message: promoForm.message,
        audience: promoForm.target_audience,
        send_email: promoForm.send_email
      });
      alert(`Promotional campaign sent! ${res.recipientCount ? `Delivered to ${res.recipientCount} users.` : ''}`);
      setPromoForm({ title: '', message: '', target_audience: 'all', send_email: false });
    } catch (err) {
      alert(err.message || 'Failed to send promotional campaign');
    } finally {
      setPromoSending(false);
    }
  }

  // Load Ads
  async function loadAds() {
    setAdsLoading(true);
    try {
      const data = await apiGet('/admin-ads');
      setAdsList(data.ads || []);
    } catch (err) {
      console.error('Failed to load ads:', err);
    } finally {
      setAdsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'ads') {
      loadAds();
    }
  }, [activeTab]);

  async function handleAdImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAdImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/admin-ads/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload ad image');
      }
      setAdForm(prev => ({ ...prev, image_url: data.url }));
    } catch (err) {
      alert(err.message || 'Image upload failed');
    } finally {
      setUploadingAdImage(false);
    }
  }

  async function handleSaveAd(e) {
    e.preventDefault();
    if (!adForm.image_url) {
      alert('Please upload an advertisement image or enter an image URL.');
      return;
    }
    try {
      await apiPost('/admin-ads', adForm);
      alert('Ad banner created successfully!');
      setShowAdForm(false);
      setAdForm({
        title: '',
        description: '',
        image_url: '',
        sponsor_name: '',
        link_url: '',
        placement: 'HOME_BANNER',
        priority: 1,
        start_date: '',
        end_date: ''
      });
      loadAds();
    } catch (err) {
      alert(err.message || 'Failed to create ad');
    }
  }

  async function toggleAdStatus(adId, currentActive) {
    try {
      await apiPut(`/admin-ads/${adId}`, { is_active: !currentActive });
      loadAds();
    } catch (err) {
      alert(err.message || 'Failed to toggle ad status');
    }
  }

  async function handleDeleteAd(adId) {
    if (!confirm('Delete this advertisement?')) return;
    try {
      await apiDelete(`/admin-ads/${adId}`);
      loadAds();
    } catch (err) {
      alert(err.message || 'Failed to delete ad');
    }
  }

  // Booking management
  async function cancelBooking(id) {
    if (!confirm('Cancel this booking?')) return;
    try { await apiPut(`/admin/bookings/${id}/cancel`); loadAllData(); }
    catch (err) { alert(err.message); }
  }

  // Commission update
  async function updateCommission() {
    // Retired: commission is configured per venue (Venue Billing). Kept as a no-op so nothing calls a removed endpoint.
    alert('Commission is now configured per venue under Venue Billing.');
  }

  // Payout toggle
  async function togglePayoutStatus(turfId, date, currentStatus) {
    try {
      const newStatus = currentStatus === 'paid' ? 'not_paid' : 'paid';
      
      // Fix: Ensure date is formatted as YYYY-MM-DD without timezone shift
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      
      console.log('Updating payout status:', { turfId, date, formattedDate, newStatus });
      
      await apiPost('/admin/payouts/mark-paid', { turf_id: turfId, date: formattedDate, status: newStatus });
      loadPayouts();
    } catch (err) {
      console.error('Payout toggle failed:', err);
      alert('Failed to update payout status: ' + err.message);
    }
  }

  function handleAdminPayoutRangeChange(value) {
    setPayoutRangeType(value);
    if (value !== 'custom') {
      const days = Math.max(1, parseInt(value, 10) || 30);
      setPayoutStartDate(getAdminDaysAgoInputDate(days - 1));
      setPayoutEndDate(getAdminTodayInputDate());
    }
  }

  function applyAdminCustomPayoutRange() {
    if (!payoutStartDate || !payoutEndDate) {
      alert('Please select both start and end dates.');
      return;
    }
    if (payoutStartDate > payoutEndDate) {
      alert('Start date cannot be after end date.');
      return;
    }
    if (getAdminDateDiffInclusive(payoutStartDate, payoutEndDate) > ADMIN_PAYOUT_HISTORY_DAYS) {
      alert('Please select a range within 90 days.');
      return;
    }
    loadPayouts({
      rangeType: 'custom',
      startDate: payoutStartDate,
      endDate: payoutEndDate
    });
  }

  function editTurf(turf) {
    setEditingTurf(turf);
    setTurfForm({
      name: turf.name, location: turf.location, address: turf.address || '',
      sport_type: turf.sport_type, price_per_hour: turf.price_per_hour,
      description: turf.description || '', images: turf.images || [], amenities: turf.amenities || [],
      owner_email: turf.owner_email || ''
    });
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

  // MATCH MANAGEMENT FUNCTIONS
  async function loadMatchData() {
    setMatchesLoading(true);
    try {
      const [statsData, matchesData] = await Promise.all([
        apiGet('/match-requests/admin/stats').catch(() => ({ stats: {} })),
        apiGet('/admin/match-requests').catch(() => ({ requests: [] }))
      ]);
      setMatchStats(statsData.stats || {});
      setMatchRequests(matchesData.requests || []);
    } catch (err) {
      console.error('Failed to load match data:', err);
    } finally {
      setMatchesLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'matches') {
      loadMatchData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'payouts') {
      loadPayouts();
    }
  }, [activeTab, payoutRangeType]);

  async function handleFeatureMatch(matchId, featured) {
    try {
      await apiPut(`/match-requests/${matchId}/feature`, { featured });
      alert(`Match ${featured ? 'featured' : 'unfeatured'}`);
      loadMatchData();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  }

  async function handleBroadcastMatch(matchId) {
    if (!confirm('Send broadcast notification to all users about this match?')) return;
    try {
      const result = await apiPost(`/match-requests/${matchId}/broadcast`, {});
      alert(`Broadcast sent to ${result.recipientCount} users`);
      loadMatchData();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  }

  async function handleRemoveMatch(matchId) {
    if (!confirm('Remove this match request?')) return;
    try {
      // admin path: the server only lets a match's own host use /match-requests/:id
      await apiDelete(`/match-requests/admin/${matchId}`);
      alert('Match removed');
      loadMatchData();
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  }

  const tabs = [
    { key: 'dashboard', icon: '📊', label: 'Dashboard' },
    { key: 'approvals', icon: '🛡️', label: 'Approvals' },
    { key: 'route', icon: '⚡', label: 'Razorpay Route' },
    { key: 'venue-billing', icon: '🧾', label: 'Venue Billing' },
    { key: 'fee-rules', icon: '💲', label: 'Fee Rules' },
    { key: 'payment-lookup', icon: '🔎', label: 'Payment Lookup' },
    { key: 'app-settings', icon: '🔐', label: 'Auth & Sports' },
    { key: 'turfs', icon: '🏟️', label: 'Turfs' },
    { key: 'owners', icon: '👥', label: 'Owners' },
    { key: 'bookings', icon: '📋', label: 'Bookings' },
    { key: 'promotions', icon: '📢', label: 'Promotions' },
    { key: 'ads', icon: '📺', label: 'Ad Banners' },
    { key: 'coupons', icon: '🎟️', label: 'Coupons' },
    { key: 'messages', icon: '📨', label: 'Inbox' },
    { key: 'matches', icon: '🤝', label: 'Match Requests' },
    { key: 'tournaments', icon: '🏆', label: 'Tournaments' },
    { key: 'revenue', icon: '💰', label: 'Revenue' },
    { key: 'payouts', icon: '💸', label: 'Daily Payouts' },
  ];

  const adminPayoutMinDate = getAdminDaysAgoInputDate(ADMIN_PAYOUT_HISTORY_DAYS - 1);
  const adminPayoutMaxDate = getAdminTodayInputDate();
  const adminPayoutLabel = payoutSummary
    ? `${formatDate(payoutSummary.start_date)} to ${formatDate(payoutSummary.end_date)}`
    : 'Selected range';

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="navbar-logo" style={{ fontSize: '1.2rem' }}>
            <img src="/images/logo.png" alt="Book Arena logo" loading="lazy" decoding="async" style={{ width: 32, height: 32, borderRadius: '4px' }} />
            <span style={{ color: 'var(--emerald-400)' }}>Book </span>Arena
          </Link>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Platform Control</p>
        </div>

        <ul className="sidebar-nav">
          {tabs.map(tab => (
            <li key={tab.key}>
              <a className={activeTab === tab.key ? 'active' : ''}
                onClick={() => { setActiveTab(tab.key); setSidebarOpen(false); }}
                style={{ cursor: 'pointer' }}>
                <span>{tab.icon}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{tab.label}</span>
                  {tab.key === 'approvals' && pendingApprovalsCount > 0 && (
                    <span style={{
                      background: '#f59e0b',
                      color: '#000',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      lineHeight: 1
                    }}>
                      {pendingApprovalsCount}
                    </span>
                  )}
                  {tab.key === 'messages' && unreadCount > 0 && (
                    <span style={{
                      background: '#ef4444',
                      color: '#fff',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      lineHeight: 1
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </span>
              </a>
            </li>
          ))}
          <li style={{ marginTop: '2rem' }}>
            <a onClick={handleLogout} style={{ cursor: 'pointer', color: '#f87171' }}>
              <span>🚪</span><span>Logout</span>
            </a>
          </li>
        </ul>
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <button className="nav-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <span></span><span></span><span></span>
          </button>
          <div style={{ textAlign: sidebarOpen ? 'left' : 'right', flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {tabs.find(t => t.key === activeTab)?.icon} {tabs.find(t => t.key === activeTab)?.label}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Welcome, {admin?.username || 'Admin'}
            </p>
          </div>
        </div>

        {/* ═══════ DASHBOARD ═══════ */}
        {activeTab === 'dashboard' && <FinanceOverview onNavigate={(key) => { setActiveTab(key); setSidebarOpen(false); }} />}

        {activeTab === 'venue-billing' && <VenueBilling />}
        {activeTab === 'fee-rules' && <FeeRules />}
        {activeTab === 'payment-lookup' && <PaymentLookup />}
        {activeTab === 'app-settings' && (<><AuthSettings /><SportCategories /></>)}

        {/* ═══════ TURFS ═══════ */}
        {activeTab === 'turfs' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <button className="btn btn-primary" onClick={() => {
                setEditingTurf(null);
                setTurfForm({ name: '', location: '', address: '', sport_type: 'cricket', price_per_hour: '', description: '', images: [], amenities: [], owner_email: '' });
                setShowTurfForm(!showTurfForm);
              }}>
                ➕ Add Turf
              </button>
            </div>

            {showTurfForm && (
              <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1.5rem' }}>
                  {editingTurf ? '✏️ Edit Turf' : '➕ Add Turf'}
                </h3>
                <form onSubmit={handleSaveTurf}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Turf Name *</label>
                      <input type="text" className="form-input" value={turfForm.name}
                        onChange={(e) => setTurfForm({ ...turfForm, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Location *</label>
                      <input type="text" className="form-input" value={turfForm.location}
                        onChange={(e) => setTurfForm({ ...turfForm, location: e.target.value })} required />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Sport Type / Play Zone *</label>
                      <select className="form-input" 
                        value={['cricket', 'football', 'badminton', 'tennis', 'basketball', 'volleyball', 'box cricket'].includes(turfForm.sport_type?.toLowerCase()) ? turfForm.sport_type.toLowerCase() : 'custom'}
                        onChange={(e) => setTurfForm({ ...turfForm, sport_type: e.target.value === 'custom' ? '' : e.target.value })}>
                        {['Cricket', 'Football', 'Badminton', 'Tennis', 'Basketball', 'Volleyball', 'Box Cricket'].map(s => (
                          <option key={s} value={s.toLowerCase()}>{s}</option>
                        ))}
                        <option value="custom">+ Add New Sport / Custom Play Zone</option>
                      </select>
                      {!['cricket', 'football', 'badminton', 'tennis', 'basketball', 'volleyball', 'box cricket'].includes(turfForm.sport_type?.toLowerCase()) && (
                        <input type="text" className="form-input" style={{ marginTop: '0.5rem' }} placeholder="Enter custom sport or play zone" 
                          value={turfForm.sport_type} onChange={(e) => setTurfForm({ ...turfForm, sport_type: e.target.value })} required />
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Price per Hour (₹) *</label>
                      <input type="number" className="form-input" value={turfForm.price_per_hour}
                        onChange={(e) => setTurfForm({ ...turfForm, price_per_hour: e.target.value })} required min="0" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Owner Notification Email *</label>
                    <input type="email" className="form-input" placeholder="email@example.com (Confirmation emails will be sent here)"
                      value={turfForm.owner_email || ''} onChange={(e) => setTurfForm({ ...turfForm, owner_email: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-input" value={turfForm.description}
                      onChange={(e) => setTurfForm({ ...turfForm, description: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Image URLs (comma separated)</label>
                    <input type="text" className="form-input" value={turfForm.images.join(', ')}
                      onChange={(e) => setTurfForm({ ...turfForm, images: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
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
                    <button type="submit" className="btn btn-primary">{editingTurf ? '💾 Update' : '➕ Add'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowTurfForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>ID</th><th>Name</th><th>Location</th><th>Sport</th><th>Price</th><th>Billing Model</th><th>Owner</th><th>This Month</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {turfs.map(t => {
                    const sport = getSportInfo(t.sport_type);
                    const isBlocked = t.status === 'BLOCKED' || !t.is_active;
                    return (
                      <tr key={t.id}>
                        <td>#{t.id}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</td>
                        <td>{t.location}</td>
                        <td>{sport.emoji} {sport.label}</td>
                        <td style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>{formatPrice(t.price_per_hour)}</td>
                        <td>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: t.billing_model === 'MONTHLY' ? '#3b82f6' : 'var(--gold-400)' }}>
                            {t.billing_model === 'MONTHLY' ? `Monthly (₹${t.monthly_subscription_amount || 799}/mo)` : `Commission (${t.commission_percentage || 5}%)`}
                          </span>
                        </td>
                        <td>{t.owner_name || '—'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--gold-400)' }}>{formatPrice(t.monthly_revenue)}</td>
                        <td>
                          <span className={`status-badge ${isBlocked ? 'status-cancelled' : 'status-confirmed'}`}>
                            {isBlocked ? 'BLOCKED' : 'ACTIVE'}
                          </span>
                        </td>
                        <td>
                          <MoreActions
                            actions={[
                              { label: 'Edit Turf', icon: '✏️', onClick: () => editTurf(t) },
                              { label: 'View Analytics', icon: '📊', onClick: () => viewTurfAnalytics(t) },
                              { label: 'Configure Billing', icon: '💳', onClick: () => openBillingModal(t) },
                              {
                                label: isBlocked ? 'Unblock Venue' : 'Block Venue',
                                icon: isBlocked ? '🔓' : '🔒',
                                danger: !isBlocked,
                                onClick: () => toggleBlockTurf(t.id, t.status, t.is_active)
                              },
                              { label: 'Delete Turf', icon: '🗑️', danger: true, onClick: () => handleDeleteTurf(t.id, t.name) }
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {turfs.length === 0 && <div className="empty-state"><div className="empty-icon">🏟️</div><h3>No turfs</h3></div>}
            </div>

            {selectedTurfAnalytics && (
              <div className="card" style={{ padding: '2rem', marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                    📊 Analytics: {selectedTurfAnalytics.name}
                  </h3>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedTurfAnalytics(null)}>✖ Close</button>
                </div>
                
                <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--emerald-400)' }}>{formatPrice(turfEarnings?.total || 0)}</div>
                    <div className="stat-label">Total Revenue</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--gold-400)' }}>{turfEarnings?.daily?.reduce((acc, d) => acc + d.total, 0) ? formatPrice(turfEarnings.daily.reduce((acc, d) => acc + d.total, 0)) : '₹0'}</div>
                    <div className="stat-label">30-Day Revenue</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value" style={{ color: '#3b82f6' }}>{turfEarnings?.monthly?.length > 0 ? formatPrice(turfEarnings.monthly[0].total) : '₹0'}</div>
                    <div className="stat-label">This Month Revenue</div>
                  </div>
                </div>

                <div className="grid-2">
                  <div>
                    <h4 style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Last 30 Days Revenue</h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '10px' }}>
                      {turfEarnings?.daily?.length > 0 ? (
                        turfEarnings.daily.map((d, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{formatDate(d.date)}</span>
                            <span style={{ fontWeight: 600, color: 'var(--emerald-400)' }}>{formatPrice(d.total)}</span>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: 'var(--text-muted)' }}>No revenue in last 30 days.</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Monthly History</h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '10px' }}>
                      {turfEarnings?.monthly?.length > 0 ? (
                        turfEarnings.monthly.map((m, i) => {
                          const dateObj = new Date(m.year, m.month - 1);
                          return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{dateObj.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                              <span style={{ fontWeight: 600, color: '#3b82f6' }}>{formatPrice(m.total)}</span>
                            </div>
                          );
                        })
                      ) : (
                        <p style={{ color: 'var(--text-muted)' }}>No monthly revenue recorded.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.5rem', background: 'rgba(239,68,68,0.05)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', marginTop: '2rem' }}>
                  <h4 style={{ color: '#ef4444', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠</span> Danger Zone
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    This action will permanently delete <strong>all booking records, payments, and revenue history</strong> associated with <strong>{selectedTurfAnalytics.name}</strong>. This action is irreversible.
                  </p>
                  <button className="btn btn-danger" onClick={() => handleDeleteTurfBookings(selectedTurfAnalytics.id)}>
                    🧹 Clear Abandoned Booking Attempts
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ OWNERS ═══════ */}
        {activeTab === 'owners' && (
          <div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Registered</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {owners.map(o => (
                    <tr key={o.id}>
                      <td>#{o.id}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{o.name}</td>
                      <td>{o.email}</td>
                      <td>{o.phone}</td>
                      <td>
                        {o.is_deleted ? (
                          <span className="status-badge status-cancelled">Deactivated</span>
                        ) : o.is_blocked ? (
                          <span className="status-badge status-cancelled">Blocked</span>
                        ) : o.is_approved ? (
                          <span className="status-badge status-confirmed">Approved</span>
                        ) : (
                          <span className="status-badge status-pending">Pending</span>
                        )}
                      </td>
                      <td>{formatDate(o.created_at)}</td>
                      <td>
                        <MoreActions
                          actions={[
                            !o.is_approved && !o.is_blocked && { label: 'Approve Owner', icon: '✅', onClick: () => approveOwner(o.id) },
                            !o.is_approved && !o.is_blocked && { label: 'Reject Owner', icon: '❌', danger: true, onClick: () => rejectOwner(o.id) },
                            {
                              label: o.is_blocked ? 'Unblock Owner' : 'Block Owner & Venues',
                              icon: o.is_blocked ? '🔓' : '🔒',
                              danger: !o.is_blocked,
                              onClick: () => toggleBlockOwner(o.id, o.is_blocked)
                            },
                            {
                              label: 'Delete Owner & Venues',
                              icon: '🗑️',
                              danger: true,
                              onClick: () => setDeleteOwnerModal(o)
                            }
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {owners.length === 0 && <div className="empty-state"><div className="empty-icon">👥</div><h3>No owners registered</h3></div>}
            </div>
          </div>
        )}

        {/* ═══════ BOOKINGS ═══════ */}
        {activeTab === 'bookings' && (
          <div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>ID</th><th>Customer</th><th>Turf</th><th>Date/Slot</th><th>Payment ID</th><th>Gross</th><th>Owner Net</th><th>Our Comm.</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {bookings.map(b => {
                    const comm = (b.amount * (stats?.commission_percent ?? 10)) / 100;
                    return (
                    <tr key={b.id}>
                      <td>#{b.id}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.customer_name}</div>
                        <div style={{ fontSize: '0.8rem' }}>{b.customer_phone}</div>
                      </td>
                      <td>{b.turf_name || `Turf #${b.turf_id}`}</td>
                      <td>{formatDate(b.booking_date)}<br/><span style={{ color: 'var(--emerald-400)' }}>{b.time_slot}</span></td>
                      <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{b.payment_id || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{formatPrice(b.amount)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatPrice(b.amount - comm)}</td>
                      <td style={{ color: 'var(--emerald-400)', fontWeight: 800 }}>+{formatPrice(comm)}</td>
                      <td><span className={`status-badge status-${b.status}`}>{b.status}</span></td>
                      <td>
                        <MoreActions
                          actions={[
                            b.status !== 'cancelled' && {
                              label: 'Cancel Booking',
                              icon: '❌',
                              danger: true,
                              onClick: () => cancelBooking(b.id)
                            }
                          ]}
                        />
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
              {bookings.length === 0 && <div className="empty-state"><div className="empty-icon">📋</div><h3>No bookings yet</h3></div>}
            </div>
          </div>
        )}

        {/* ═══════ PROMOTIONS ═══════ */}
        {activeTab === 'promotions' && (
          <div>
            <div className="card" style={{ padding: '2rem', maxWidth: '650px', margin: '0 auto', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: '1.5rem', color: '#fff' }}>
                📢 Send Promotional Campaign
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Broadcast promotional notifications and announcements directly to platform users.
              </p>
              <form onSubmit={handleSendPromotion}>
                <div className="form-group">
                  <label className="form-label">Campaign Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Weekend Special Offer 🎉"
                    required
                    value={promoForm.title}
                    onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Notification Message *</label>
                  <textarea
                    className="form-input"
                    rows="4"
                    placeholder="e.g. Get 20% off all sports bookings this weekend! Use code WEEKEND20."
                    required
                    value={promoForm.message}
                    onChange={(e) => setPromoForm({ ...promoForm, message: e.target.value })}
                  />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Target Audience</label>
                    <select
                      className="form-input"
                      value={promoForm.target_audience}
                      onChange={(e) => setPromoForm({ ...promoForm, target_audience: e.target.value })}
                    >
                      <option value="all">All Platform Users</option>
                      <option value="cricket">Cricket Enthusiasts</option>
                      <option value="football">Football Players</option>
                      <option value="badminton">Badminton Players</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.9rem' }}>
                      <input
                        type="checkbox"
                        checked={promoForm.send_email}
                        onChange={(e) => setPromoForm({ ...promoForm, send_email: e.target.checked })}
                      />
                      <span>Also Send Email Notification</span>
                    </label>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={promoSending}>
                  {promoSending ? 'Sending Campaign...' : '🚀 Broadcast Notification'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ═══════ ADS MANAGEMENT ═══════ */}
        {activeTab === 'ads' && (
          <div>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, margin: 0 }}>📺 Advertisement Banners</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  Manage banner ads across Home Banner, Entry Popup Modal, and Tournament Section.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setShowAdForm(!showAdForm)}>
                {showAdForm ? '✕ Close Form' : '➕ Create Ad Banner'}
              </button>
            </div>

            {showAdForm && (
              <div className="card" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                  ➕ New Banner Ad
                </h4>
                <form onSubmit={handleSaveAd}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Ad Title *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Weekend Sports Offer"
                        required
                        value={adForm.title}
                        onChange={(e) => setAdForm({ ...adForm, title: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Placement *</label>
                      <select
                        className="form-input"
                        value={adForm.placement}
                        onChange={(e) => setAdForm({ ...adForm, placement: e.target.value })}
                      >
                        <option value="HOME_BANNER">Home Page Main Banner Carousel</option>
                        <option value="ENTRY_AD">App / Home Entry Popup Modal</option>
                        <option value="TOURNAMENT_AD">Tournament Section Banner</option>
                      </select>
                    </div>
                  </div>

                  {/* Image Upload / URL */}
                  <div className="grid-2" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Upload Image File (JPG, PNG, WEBP, GIF, SVG)</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-input"
                        onChange={handleAdImageUpload}
                        disabled={uploadingAdImage}
                      />
                      {uploadingAdImage && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--emerald-400)', marginTop: '4px' }}>
                          Uploading image to server...
                        </p>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Or Image URL</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="https://example.com/ad-banner.jpg or /api/uploads/ads/..."
                        value={adForm.image_url}
                        onChange={(e) => setAdForm({ ...adForm, image_url: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Image Preview */}
                  {adForm.image_url && (
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Image Preview:</p>
                      <img
                        src={adForm.image_url}
                        alt="Ad Preview"
                        style={{ maxHeight: '160px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}
                      />
                    </div>
                  )}

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Sponsor / Brand Name</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Star Sports"
                        value={adForm.sponsor_name}
                        onChange={(e) => setAdForm({ ...adForm, sponsor_name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Target Link URL (Optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="https://example.com/offer"
                        value={adForm.link_url}
                        onChange={(e) => setAdForm({ ...adForm, link_url: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid-3">
                    <div className="form-group">
                      <label className="form-label">Priority (Higher = Shows First)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={adForm.priority}
                        onChange={(e) => setAdForm({ ...adForm, priority: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Start Date (Optional)</label>
                      <input
                        type="date"
                        className="form-input"
                        value={adForm.start_date}
                        onChange={(e) => setAdForm({ ...adForm, start_date: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Date (Optional)</label>
                      <input
                        type="date"
                        className="form-input"
                        value={adForm.end_date}
                        onChange={(e) => setAdForm({ ...adForm, end_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description (Optional)</label>
                    <textarea
                      className="form-input"
                      rows="2"
                      placeholder="Ad details or offer terms..."
                      value={adForm.description || ''}
                      onChange={(e) => setAdForm({ ...adForm, description: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={uploadingAdImage}>
                      💾 Save & Publish Ad
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAdForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Banner</th>
                    <th>Title</th>
                    <th>Placement</th>
                    <th>Priority</th>
                    <th>Views</th>
                    <th>Clicks</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adsList.map((a) => (
                    <tr key={a.id}>
                      <td>#{a.id}</td>
                      <td>
                        {a.image_url ? (
                          <img
                            src={a.image_url}
                            alt={a.title}
                            style={{ width: '70px', height: '42px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.title}</div>
                        {a.sponsor_name && <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>By {a.sponsor_name}</div>}
                      </td>
                      <td>
                        <span className="sport-chip" style={{ fontSize: '0.75rem' }}>
                          {a.placement}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.priority || 1}</td>
                      <td style={{ fontWeight: 700 }}>{a.impression_count || 0}</td>
                      <td style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>{a.click_count || 0}</td>
                      <td>
                        <span className={`status-badge ${a.is_active ? 'status-confirmed' : 'status-cancelled'}`}>
                          {a.is_active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td>
                        <MoreActions
                          actions={[
                            {
                              label: a.is_active ? 'Pause Ad' : 'Activate Ad',
                              icon: a.is_active ? '⏸️' : '▶️',
                              onClick: () => toggleAdStatus(a.id, a.is_active)
                            },
                            {
                              label: 'Delete Ad',
                              icon: '🗑️',
                              danger: true,
                              onClick: () => handleDeleteAd(a.id)
                            }
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {adsList.length === 0 && !adsLoading && (
                <div className="empty-state">
                  <div className="empty-icon">📺</div>
                  <h3>No advertisements created yet</h3>
                  <p>Click &quot;Create Ad Banner&quot; above to upload your first advertisement banner.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ ADMIN COUPONS ═══════ */}
        {activeTab === 'coupons' && (
          <div>
            <div className="grid-2" style={{ alignItems: 'start' }}>
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>🎟️ Create Admin Coupon</h3>
                <form onSubmit={saveAdminCoupon}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Coupon Code</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. WELCOME10"
                        required
                        value={couponForm.code}
                        onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                        disabled={!!editingCoupon}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Coupon Label (Optional)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. New User Offer"
                        value={couponForm.label}
                        onChange={(e) => setCouponForm({ ...couponForm, label: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Discount Type</label>
                      <select
                        className="form-input"
                        value={couponForm.discount_type}
                        onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })}
                      >
                        <option value="flat">Fixed Amount (₹)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Discount Value</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder={couponForm.discount_type === 'percentage' ? 'e.g. 10' : 'e.g. 50'}
                        required
                        value={couponForm.discount_value}
                        onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })}
                      />
                    </div>
                  </div>

                  {couponForm.discount_type === 'percentage' && (
                    <div className="form-group">
                      <label className="form-label">Maximum Discount Cap (Optional)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g. 150"
                        value={couponForm.max_discount_cap}
                        onChange={(e) => setCouponForm({ ...couponForm, max_discount_cap: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Min Booking Amount (₹)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g. 500"
                        value={couponForm.min_booking_amount}
                        onChange={(e) => setCouponForm({ ...couponForm, min_booking_amount: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Applicable Sport</label>
                      <select
                        className="form-input"
                        value={couponForm.applicable_sport}
                        onChange={(e) => setCouponForm({ ...couponForm, applicable_sport: e.target.value })}
                      >
                        <option value="all">All Sports</option>
                        <option value="cricket">Cricket</option>
                        <option value="football">Football</option>
                        <option value="badminton">Badminton</option>
                        <option value="tennis">Tennis</option>
                        <option value="basketball">Basketball</option>
                        <option value="volleyball">Volleyball</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Valid From (Optional)</label>
                      <input
                        type="date"
                        className="form-input"
                        value={couponForm.valid_from}
                        onChange={(e) => setCouponForm({ ...couponForm, valid_from: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valid Until (Optional)</label>
                      <input
                        type="date"
                        className="form-input"
                        value={couponForm.valid_until}
                        onChange={(e) => setCouponForm({ ...couponForm, valid_until: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Total Usage Limit (Optional)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g. 1000"
                        value={couponForm.max_uses}
                        onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Per User Limit (Optional)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="e.g. 1"
                        value={couponForm.per_user_limit}
                        onChange={(e) => setCouponForm({ ...couponForm, per_user_limit: e.target.value })}
                      />
                    </div>
                  </div>

                  <button className="btn btn-primary" style={{ width: '100%' }} disabled={couponLoading}>
                    {editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                  </button>
                  {editingCoupon && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', marginTop: '0.5rem' }}
                      onClick={() => {
                        setEditingCoupon(null);
                        setCouponForm({
                          code: '',
                          label: '',
                          discount_type: 'flat',
                          discount_value: '',
                          min_booking_amount: '',
                          max_discount_cap: '',
                          valid_from: '',
                          valid_until: '',
                          max_uses: '',
                          per_user_limit: '',
                          applicable_sport: 'all'
                        });
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </form>
              </div>

              <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>🎟️ Admin Coupons</h3>
                  <button className="btn btn-secondary btn-sm" onClick={loadAdminCoupons}>🔄 Refresh</button>
                </div>

                {couponLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto' }} />
                  </div>
                ) : coupons.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🎟️</div>
                    <h3>No admin coupons yet</h3>
                    <p>Create platform-wide coupons here.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Type</th>
                          <th>Value</th>
                          <th>Min</th>
                          <th>Used</th>
                          <th>Expiry</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coupons.map((c) => {
                          const expired = c.valid_until ? (new Date(c.valid_until) < new Date()) : false;
                          const statusLabel = expired ? 'Expired' : (c.is_active ? 'Active' : 'Disabled');
                          return (
                            <tr key={c.id}>
                              <td style={{ fontWeight: 800, fontFamily: 'monospace' }}>{c.code}</td>
                              <td>{c.discount_type}</td>
                              <td style={{ fontWeight: 700 }}>
                                {c.discount_type === 'flat' ? `₹${c.discount_value}` : `${c.discount_value}%`}
                              </td>
                              <td>₹{c.min_booking_amount || 0}</td>
                              <td>{c.max_uses ? `${c.used_count || 0}/${c.max_uses}` : `${c.used_count || 0}`}</td>
                              <td>{c.valid_until ? formatDate(c.valid_until) : '—'}</td>
                              <td>
                                <span className={`status-badge ${expired ? 'status-cancelled' : (c.is_active ? 'status-confirmed' : 'status-pending')}`}>
                                  {statusLabel}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                      setEditingCoupon(c);
                                      setCouponForm({
                                        code: c.code,
                                        label: c.label || '',
                                        discount_type: c.discount_type,
                                        discount_value: c.discount_value,
                                        min_booking_amount: c.min_booking_amount || '',
                                        max_discount_cap: c.max_discount_cap || '',
                                        valid_from: c.valid_from ? String(c.valid_from).slice(0, 10) : '',
                                        valid_until: c.valid_until ? String(c.valid_until).slice(0, 10) : '',
                                        max_uses: c.max_uses || '',
                                        per_user_limit: c.per_user_limit || '',
                                        applicable_sport: c.applicable_sport || 'all'
                                      });
                                    }}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    className={`btn btn-sm ${c.is_active ? 'btn-danger' : 'btn-primary'}`}
                                    onClick={() => toggleAdminCoupon(c, !c.is_active)}
                                    disabled={expired}
                                  >
                                    {c.is_active ? 'Disable' : 'Enable'}
                                  </button>
                                  <button className="btn btn-danger btn-sm" onClick={() => deleteAdminCoupon(c.id)}>🗑️</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ INBOX / MESSAGES ═══════ */}
        {activeTab === 'messages' && (
          <div>
            <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
              {/* Left: message list */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                      Inbox
                    </h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {unreadCount} unread · {messages.length} total
                    </p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={loadMessages}>
                    🔄 Refresh
                  </button>
                </div>

                {messagesLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto' }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <h3>No messages yet</h3>
                    <p>Messages submitted from the Contact page will appear here instantly.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '560px', overflowY: 'auto', paddingRight: '8px' }}>
                    {messages.map((m) => {
                      const isSelected = Number(selectedMessage?.id) === Number(m.id);
                      const isUnread = !m.is_read;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedMessage(m);
                            if (!m.is_read) updateMessageRead(m.id, true);
                          }}
                          className="card"
                          style={{
                            textAlign: 'left',
                            padding: '1rem',
                            cursor: 'pointer',
                            border: isSelected ? '1px solid var(--emerald-400)' : '1px solid var(--border-subtle)',
                            background: isSelected ? 'rgba(16, 185, 129, 0.06)' : (isUnread ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-card)'),
                            outline: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{m.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {isUnread && (
                                <span style={{
                                  background: '#3b82f6',
                                  color: '#fff',
                                  borderRadius: '999px',
                                  padding: '2px 8px',
                                  fontSize: '0.7rem',
                                  fontWeight: 800
                                }}>
                                  UNREAD
                                </span>
                              )}
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                {m.created_at ? new Date(m.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                            {m.email}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.6rem', lineHeight: 1.5 }}>
                            {String(m.message || '').slice(0, 140)}{String(m.message || '').length > 140 ? '…' : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: message detail */}
              <div className="card" style={{ padding: '1.25rem' }}>
                {!selectedMessage ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📨</div>
                    <h3 style={{ marginBottom: '0.5rem' }}>Select a message</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
                      Click a message on the left to read the full content.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 900 }}>
                          {selectedMessage.name}
                        </h3>
                        <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          {selectedMessage.email}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                          {selectedMessage.created_at ? new Date(selectedMessage.created_at).toLocaleString('en-IN') : ''}
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateMessageRead(selectedMessage.id, !selectedMessage.is_read)}
                      >
                        {selectedMessage.is_read ? 'Mark Unread' : 'Mark Read'}
                      </button>
                    </div>

                    <div style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      border: '1px solid var(--border-subtle)',
                      background: 'rgba(255,255,255,0.02)',
                      lineHeight: 1.8,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {selectedMessage.message}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ MATCH REQUESTS ═══════ */}
        {activeTab === 'matches' && (
          <div>
            {matchStats && (
              <div className="grid-2" style={{ marginBottom: '2rem' }}>
                <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--emerald-500)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Open Requests</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--emerald-400)' }}>{matchStats.open_requests || 0}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid #ef4444' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Urgent Matches</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ef4444' }}>{matchStats.urgent_requests || 0}</div>
                </div>
              </div>
            )}

            {matchesLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="loading-spinner" style={{ margin: '0 auto' }} />
              </div>
            ) : matchRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-card)', borderRadius: '12px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                <p style={{ color: 'var(--text-muted)' }}>No match requests at the moment</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Host</th>
                      <th>Sport</th>
                      <th>Venue</th>
                      <th>Date & Time</th>
                      <th>Players</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchRequests.map(match => {
                      const isUrgent = new Date(`${match.match_date}T${match.match_time}`) - new Date() < 2 * 60 * 60 * 1000;
                      const sport = getSportInfo(match.sport_type);
                      return (
                        <tr key={match.id}>
                          <td style={{ fontWeight: 700 }}>#{match.id}</td>
                          <td>{match.host_name}</td>
                          <td>{sport.emoji} {match.sport_type}</td>
                          <td>{match.turf_name}</td>
                          <td>
                            {formatDate(match.match_date)}<br/>
                            <span style={{ color: 'var(--emerald-400)', fontSize: '0.85rem' }}>{match.match_time.substring(0, 5)}</span>
                          </td>
                          <td>
                            <span style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>
                              {match.filled_slots}/{match.total_slots}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: match.status === 'full' ? 'rgba(107,114,128,0.2)' : 'rgba(16,185,129,0.2)',
                              color: match.status === 'full' ? '#9ca3af' : 'var(--emerald-400)',
                              textTransform: 'uppercase'
                            }}>
                              {match.status}
                              {isUrgent && ' 🔥'}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                            <button
                              className="btn btn-sm"
                              onClick={() => handleFeatureMatch(match.id, !match.is_featured)}
                              style={{ background: match.is_featured ? 'var(--emerald-500)' : 'var(--border-subtle)', marginRight: '0.5rem' }}
                            >
                              {match.is_featured ? '⭐ Unfeature' : '☆ Feature'}
                            </button>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleBroadcastMatch(match.id)}
                              style={{ marginRight: '0.5rem' }}
                            >
                              📢 Broadcast
                            </button>
                            <Link
                              to={`/match/${match.id}`}
                              className="btn btn-sm btn-secondary"
                              style={{ marginRight: '0.5rem' }}
                            >
                              👁️ View
                            </Link>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRemoveMatch(match.id)}
                            >
                              🗑️ Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════ REVENUE ═══════ */}
        {activeTab === 'revenue' && (
          <div>
            <div className="grid-3" style={{ marginBottom: '2rem' }}>
              {[
                { icon: '💰', label: 'Total Bookings Value', value: formatCompactNumber(stats?.total_revenue || 0), color: 'var(--emerald-400)' },
                { icon: '👑', label: 'Platform Revenue', value: formatCompactNumber(stats?.platform_revenue || 0), color: 'var(--gold-400)' },
                { icon: '📊', label: 'Commission Rate', value: `${stats?.commission_percent ?? 10}%`, color: '#3b82f6' },
              ].map((s, i) => (
                <div key={i} className="stat-card">
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: '1.5rem', maxWidth: '640px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Billing is now set per venue</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Commission, flat fees and subscriptions are configured for each venue under Venue Billing, with a saved history of every change.
                The customer service fee and its tax are managed centrally and are never assumed.
              </p>
              <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => setActiveTab('venue-billing')}>Open Venue Billing</button>
            </div>
          </div>
        )}

        {/* ═══════ PAYOUTS ═══════ */}
        {activeTab === 'payouts' && (
          <div>
            <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Showing payouts for <strong style={{ color: 'var(--text-secondary)' }}>{adminPayoutLabel}</strong>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                <select
                  className="form-input"
                  style={{ width: 'auto', minWidth: '160px' }}
                  value={payoutRangeType}
                  onChange={(e) => handleAdminPayoutRangeChange(e.target.value)}
                >
                  <option value="7">Last 7 days</option>
                  <option value="10">Last 10 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="custom">Custom range</option>
                </select>

                {payoutRangeType === 'custom' && (
                  <>
                    <input
                      type="date"
                      className="form-input"
                      value={payoutStartDate}
                      min={adminPayoutMinDate}
                      max={adminPayoutMaxDate}
                      onChange={(e) => setPayoutStartDate(e.target.value)}
                      style={{ width: 'auto' }}
                    />
                    <input
                      type="date"
                      className="form-input"
                      value={payoutEndDate}
                      min={payoutStartDate || adminPayoutMinDate}
                      max={adminPayoutMaxDate}
                      onChange={(e) => setPayoutEndDate(e.target.value)}
                      style={{ width: 'auto' }}
                    />
                    <button className="btn btn-primary" onClick={applyAdminCustomPayoutRange}>
                      Apply
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid-4" style={{ marginBottom: '2rem' }}>
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-value">{formatPrice(payoutSummary?.total_slot_value || 0)}</div>
                <div className="stat-label">Total Slot Value</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💳</div>
                <div className="stat-value" style={{ color: '#60a5fa' }}>{formatPrice(payoutSummary?.razorpay_collected || 0)}</div>
                <div className="stat-label">Through Razorpay</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🏟️</div>
                <div className="stat-value" style={{ color: 'var(--gold-400)' }}>{formatPrice(payoutSummary?.venue_cash || 0)}</div>
                <div className="stat-label">Venue / Cash</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-value">{`${payoutSummary?.paid_count || 0}/${(payoutSummary?.paid_count || 0) + (payoutSummary?.not_paid_count || 0)}`}</div>
                <div className="stat-label">Paid Rows</div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Turf</th>
                    <th>Owner</th>
                    <th>Total Value</th>
                    <th>Razorpay</th>
                    <th>Venue / Cash</th>
                    <th>Status</th>
                    <th>Split Bar</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{formatDate(p.date)}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.turf_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{p.turf_id}</div>
                      </td>
                      <td>{p.owner_name}</td>
                      <td style={{ fontWeight: 600 }}>{formatPrice(p.total_earnings)}</td>
                      <td style={{ color: '#60a5fa', fontWeight: 800 }}>{formatPrice(p.razorpay_collected || p.owner_payout || 0)}</td>
                      <td style={{ color: 'var(--gold-400)', fontWeight: 600 }}>{formatPrice(p.venue_cash || p.pending_balance || 0)}</td>
                      <td>
                        {p.status === 'paid' ? (
                          <span className="status-badge status-confirmed" title={`Paid at: ${p.paid_at ? new Date(p.paid_at).toLocaleString() : 'N/A'}`}>Paid</span>
                        ) : (
                          <span className="status-badge status-pending">Not Paid</span>
                        )}
                      </td>
                      <td style={{ minWidth: '180px' }}>
                        <div style={{ background: 'var(--bg-secondary)', height: '9px', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                          <div style={{
                            background: '#3b82f6',
                            height: '100%',
                            width: `${Math.max(0, Math.min(100, Number(p.total_earnings || 0) > 0 ? (Number(p.razorpay_collected || p.owner_payout || 0) / Number(p.total_earnings || 0)) * 100 : 0))}%`
                          }}></div>
                          <div style={{
                            background: '#f59e0b',
                            height: '100%',
                            width: `${Math.max(0, Math.min(100, Number(p.total_earnings || 0) > 0 ? (Number(p.venue_cash || p.pending_balance || 0) / Number(p.total_earnings || 0)) * 100 : 0))}%`
                          }}></div>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                          Razorpay {formatPrice(p.razorpay_collected || p.owner_payout || 0)} | Venue {formatPrice(p.venue_cash || p.pending_balance || 0)}
                        </div>
                      </td>
                      <td>
                        <button 
                          className={`btn btn-sm ${p.status === 'paid' ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => togglePayoutStatus(p.turf_id, p.date, p.status)}
                        >
                          {p.status === 'paid' ? 'Mark as Not Paid' : 'Mark as Paid'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payouts.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">💸</div>
                  <h3>No payouts available</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Try a different date range within the last 90 days.</p>
                </div>
              )}
            </div>
          </div>
        )}


        {/* ═══════ APPROVALS TAB ═══════ */}
        {activeTab === 'approvals' && (
          <AdminApprovals onUpdateCount={(count) => setPendingApprovalsCount(count)} />
        )}

        {/* ═══════ RAZORPAY ROUTE TAB ═══════ */}
        {activeTab === 'route' && (
          <AdminRoute />
        )}

        {/* ═══════ TOURNAMENTS TAB ═══════ */}
        {activeTab === 'tournaments' && (
          <AdminTournaments />
        )}

        {/* ═══════ BILLING MODEL MODAL ═══════ */}
        {billingModalTurf && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff' }}>
                  💳 Venue Billing Configuration
                </h3>
                <button className="btn btn-secondary btn-sm" onClick={() => setBillingModalTurf(null)}>✕</button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Configure platform monetization model for <strong>{billingModalTurf.name}</strong>.
              </p>

              <form onSubmit={handleSaveVenueBilling}>
                <div className="form-group">
                  <label className="form-label">Billing Model *</label>
                  <select
                    className="form-input"
                    value={billingForm.billing_model}
                    onChange={(e) => setBillingForm({ ...billingForm, billing_model: e.target.value })}
                  >
                    <option value="MONTHLY">Model A — Fixed Monthly Subscription</option>
                    <option value="PERCENTAGE">Model B — Percentage Commission</option>
                  </select>
                </div>

                {billingForm.billing_model === 'MONTHLY' ? (
                  <div className="form-group">
                    <label className="form-label">Fixed Monthly Subscription Amount (₹) *</label>
                    <input
                      type="number"
                      className="form-input"
                      required
                      min="0"
                      value={billingForm.monthly_amount}
                      onChange={(e) => setBillingForm({ ...billingForm, monthly_amount: e.target.value })}
                    />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Owner pays a fixed monthly platform subscription fee.
                    </p>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Commission Percentage (%) *</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      required
                      min="0"
                      max="100"
                      value={billingForm.commission_percentage}
                      onChange={(e) => setBillingForm({ ...billingForm, commission_percentage: e.target.value })}
                    />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Platform automatically retains this percentage from each slot booking.
                    </p>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Subscription Status</label>
                  <select
                    className="form-input"
                    value={billingForm.subscription_status}
                    onChange={(e) => setBillingForm({ ...billingForm, subscription_status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>💾 Save Billing Plan</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setBillingModalTurf(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════ DELETE OWNER MODAL ═══════ */}
        {deleteOwnerModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '2rem', border: '1px solid #ef4444' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: '#ef4444', marginBottom: '1rem' }}>
                ⚠️ Deactivate Owner & Venues?
              </h3>
              <p style={{ color: '#e2e8f0', fontSize: '0.95rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                Are you sure you want to deactivate owner <strong>{deleteOwnerModal.name}</strong> ({deleteOwnerModal.email})?
              </p>
              <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p style={{ fontSize: '0.85rem', color: '#fca5a5', margin: 0 }}>
                  ✓ Associated venues will be blocked from active operations.<br/>
                  ✓ Historical booking and payment records will be preserved for financial reporting.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleConfirmDeleteOwner(deleteOwnerModal)}>
                  Confirm Deactivation
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteOwnerModal(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
