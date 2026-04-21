'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { apiGet, apiPost } from '@/lib/api';
import { getSportInfo, formatPrice, DEFAULT_TURF_IMAGES } from '@/lib/constants';

function formatContinuousSlots(slotsList) {
  if (!slotsList || slotsList.length === 0) return 'Select slots';

  const parseTime = (timeStr) => {
    const [time, modifier] = timeStr.trim().split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const parsedSlots = slotsList.map(slot => {
    const [startStr, endStr] = slot.split('-');
    return {
      slot: slot,
      start: parseTime(startStr),
      end: parseTime(endStr),
      startStr: startStr.trim(),
      endStr: endStr.trim()
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

  return merged.map(group => `${group.startStr} - ${group.endStr}`).join(', ');
}


export default function TurfDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [turf, setTurf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
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
  const [showAllDates, setShowAllDates] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Coupon state
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponSuccess, setCouponSuccess] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

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

  const displayedDates = showAllDates ? availableDates : availableDates.slice(0, 3);

  // Auto carousel effect
  useEffect(() => {
    if (!turf || !turf.images) return;
    const interval = setInterval(() => {
      setActiveImage(prev => (prev + 1) % (turf.images.length || 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [turf]);

  useEffect(() => {
    // Default to Today's local date
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${dd}`);

    const userData = localStorage.getItem('userData');
    if (userData) {
      const user = JSON.parse(userData);
      setCurrentUser(user);
      setBookingData({ name: user.name, phone: '', email: user.email });
    }
  }, []);

  useEffect(() => {
    loadTurf();
  }, [params.id]);

  useEffect(() => {
    if (selectedDate && turf) {
      loadSlots();
    }
  }, [selectedDate, turf]);

  // Load available coupons when turf loads
  useEffect(() => {
    if (turf && turf.id) {
      loadAvailableCoupons();
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

  const [pricingBreakdown, setPricingBreakdown] = useState(null);

  async function calculatePricing(currentSlots, currentCoupon) {
    if (!currentSlots || currentSlots.length === 0 || !selectedDate) return;
    
    try {
      const data = await apiPost('/bookings/calculate-price', {
        turf_id: parseInt(params.id),
        booking_date: selectedDate,
        time_slots: currentSlots,
        coupon_code: currentCoupon || undefined
      });
      setPricingBreakdown(data);
      setDiscountAmount(data.discountAmount);
      setServiceFee(data.serviceFee);
      return data;
    } catch (err) {
      console.error('Pricing calculation failed:', err);
      // Fallback or error handling
    }
  }

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    if (selectedSlots.length === 0) {
      setCouponError('Please select a time slot first');
      return;
    }
    
    setCouponLoading(true);
    setCouponError('');
    
    try {
      const breakdown = await calculatePricing(selectedSlots, couponCode.trim());
      
      if (breakdown && breakdown.coupon) {
        setAppliedCoupon(breakdown.coupon);
        setCouponError('');
        setCouponSuccess('applied coupoun successfully');
      } else {
        setCouponError('Invalid coupon code');
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError(err.message || 'Invalid coupon code');
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    setCouponSuccess('');
    calculatePricing(selectedSlots, null);
  }

  async function loadTurf() {
    try {
      const data = await apiGet(`/turfs/${params.id}`);
      setTurf(data.turf);
    } catch (err) {
      console.error(err);
      setTurf(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadSlots() {
    setSlotsLoading(true);
    setSelectedSlots([]);
    try {
      const data = await apiGet(`/turfs/${params.id}/slots?date=${selectedDate}`);
      setSlots(data.slots || []);
      if (data.serviceFee) setServiceFee(data.serviceFee);
    } catch (err) {
      console.error(err);
    } finally {
      setSlotsLoading(false);
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
        turf_id: parseInt(params.id),
        customer_name: bookingData.name,
        customer_phone: bookingData.phone,
        customer_email: bookingData.email,
        booking_date: selectedDate,
        time_slots: selectedSlots,
        coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
        user_id: currentUser ? currentUser.id : null
      });

      // Helper: always send confirmation
      const sendConfirmation = async () => {
        try {
          await fetch('http://localhost:5000/api/notify/booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_email: bookingData.email,
              customer_name: bookingData.name,
              turf_name: turf.name,
              booking_date: selectedDate,
              time_slot: selectedSlots.join(', '),
              amount: data.amount,
              service_fee: data.serviceFee,
              discount_amount: data.discountAmount
            }),
          });
        } catch (emailErr) {
          console.warn('Email notification failed (non-critical):', emailErr.message);
        }
      };

      // Initialize Razorpay if keys are not placeholders
      // Initialize Razorpay
      console.log('📦 API Response:', data);
      
      if (data.order_id && data.key_id) {
        if (typeof window === 'undefined' || !window.Razorpay) {
          alert("Razorpay object failed to initialize. Please refresh the page and ensure your ad-blocker is off.");
          setBookingLoading(false);
          return;
        }

        const options = {
          key: data.key_id,
          amount: data.amount * 100,
          currency: data.currency,
          name: 'Book Arena',
          description: `Booking at ${turf.name}`,
          order_id: data.order_id,
          handler: async function (response) {
            setVerifying(true);
            try {
              console.log('✅ Payment success, verifying signature...');
              await apiPost('/bookings/verify', {
                booking_id: data.booking_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              await sendConfirmation();
              router.push(`/booking/success?id=${data.booking_id}`);
            } catch (err) {
              console.error('❌ Verification Error:', err);
              alert('Payment verification failed: ' + err.message);
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
            ondismiss: function() {
              console.log('👋 Checkout modal closed');
              setBookingLoading(false);
            }
          }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Fallback for unexpected failures
        console.error('❌ Missing payment details in API response:', data);
        alert(`Booking creation failed: Missing ${!data.order_id ? 'Order ID' : 'Key ID'}. Please check server console.`);
        setBookingLoading(false);
      }
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
        <div className="loading-page">
          <div className="loading-spinner" />
          <p style={{ color: 'var(--text-muted)' }}>Loading turf details...</p>
        </div>
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
          <Link href="/turfs" className="btn btn-primary">Browse All Turfs</Link>
        </div>
      </div>
    );
  }

  const sport = getSportInfo(turf.sport_type);
  const images = turf.images && turf.images.length > 0 ? turf.images : DEFAULT_TURF_IMAGES;

  return (
    <div className="page-wrapper">
      <Navbar />
      <Script 
        src="https://checkout.razorpay.com/v1/checkout.js" 
        strategy="lazyOnload"
        onLoad={() => console.log('✅ Razorpay SDK Loaded')}
        onError={(e) => console.error('❌ Razorpay SDK Failed to load', e)}
      />

      <section style={{ paddingTop: '100px', paddingBottom: '3rem' }}>
        <div className="container">
          {/* Breadcrumb */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem'
          }}>
            <Link href="/" style={{ color: 'var(--text-muted)' }}>Home</Link>
            <span>›</span>
            <Link href="/turfs" style={{ color: 'var(--text-muted)' }}>Turfs</Link>
            <span>›</span>
            <span style={{ color: 'var(--emerald-400)' }}>{turf.name}</span>
          </div>

          {/* Image Carousel */}
          <div className="detail-carousel">
            <div className="detail-carousel-inner" style={{ transform: `translateX(-${activeImage * 100}%)` }}>
              {images.map((img, idx) => (
                <div key={idx} className="detail-slide">
                  <img src={img} alt={`${turf.name} photo ${idx + 1}`} />
                </div>
              ))}
            </div>
            
            <div className="carousel-dots">
                {images.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`carousel-dot ${activeImage === idx ? 'active' : ''}`}
                        onClick={() => setActiveImage(idx)}
                    />
                ))}
            </div>
          </div>

          {/* Turf Info + Booking Section */}
          <div className="booking-layout">
            {/* Left: Details */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <span className="card-badge badge-sport" style={{ position: 'static' }}>
                  {sport.emoji} {sport.label}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>⭐ 4.{5 + (parseInt(params.id) % 5)} rating</span>
              </div>

              <h1 style={{
                fontFamily: 'var(--font-display)', fontSize: '1.5rem',
                fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)'
              }}>
                {turf.name}
              </h1>

              <p style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '1.5rem'
              }}>
                📍 {turf.location}
                {turf.address && ` — ${turf.address}`}
              </p>

              <div className="card-price" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '1.2rem' }}>{formatPrice(parseFloat(turf.price_per_hour) + 200)}</span>
                <span className="amount" style={{ fontSize: '2.5rem' }}>{formatPrice(turf.price_per_hour)}</span>
                <span className="period" style={{ fontSize: '1rem' }}>per hour</span>
              </div>

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
              {turf.amenities && turf.amenities.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                    Amenities
                  </h3>
                  <div className="amenity-tags">
                    {turf.amenities.map((a, i) => (
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ⏰ Select Time Slot
                        </h3>
                        {!showAllDates && (
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ borderRadius: 'var(--radius-full)', padding: '6px 14px', fontSize: '0.75rem' }}
                            onClick={() => setShowAllDates(true)}
                          >
                            📅 Other Dates
                          </button>
                        )}
                    </div>
                    
                    {/* Date Capsule Picker */}
                    <div className="date-picker-container">
                        <div className="date-picker-scroll">
                            {displayedDates.map((d) => (
                                <div 
                                    key={d.full}
                                    className={`date-capsule ${selectedDate === d.full ? 'active' : ''}`}
                                    onClick={() => setSelectedDate(d.full)}
                                >
                                    <span className="day">{d.day}</span>
                                    <span className="date">{d.date}</span>
                                    <span className="month">{d.month}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                 {slotsLoading ? (
                   <div className="flex-center" style={{ padding: '2rem' }}>
                     <div className="loading-spinner" />
                   </div>
                 ) : slots.length > 0 ? (
                   <div className="slot-grid-modern" id="slot-grid">
                     {slots.map((slot) => (
                       <div
                         key={slot.time}
                         className={`slot-capsule ${
                           slot.status === 'available'
                             ? selectedSlots.includes(slot.time) ? 'available selected' : 'available'
                             : slot.status === 'booked' ? 'booked' : 'blocked'
                         }`}
                         onClick={() => {
                           if (slot.status === 'available') {
                             let newSlots = [...selectedSlots];
                             if (newSlots.includes(slot.time)) {
                               newSlots = newSlots.filter(t => t !== slot.time);
                             } else {
                               newSlots.push(slot.time);
                             }
                             setSelectedSlots(newSlots);
                             if (newSlots.length > 0) {
                               setShowBookingForm(true);
                               calculatePricing(newSlots, appliedCoupon?.code);
                             } else {
                               setShowBookingForm(false);
                               setPricingBreakdown(null);
                             }
                           }
                         }}
                       >
                         {slot.offerLabel && (
                           <div style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--gold-400)', color: '#000', fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 2 }}>
                             {slot.offerLabel}
                           </div>
                         )}
                         {!slot.offerLabel && slot.offerPercentage && (
                           <div style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--gold-400)', color: '#000', fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 2 }}>
                             🔥 {slot.offerPercentage}% OFF
                           </div>
                         )}
                         <div style={{ fontWeight: 600 }}>{slot.time}</div>
                          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                            <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: '6px' }}>{formatPrice(parseFloat(slot.price) + 200)}</span>
                            <span style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>{formatPrice(slot.price)}</span>
                          </div>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="empty-state-small">
                     <p style={{ color: 'var(--text-muted)' }}>No slots available for this date</p>
                   </div>
                 )}
              </div>
            </div>

            {/* Right: Booking Card */}
            <div>
              <div className="card" style={{ padding: '1.5rem', position: 'sticky', top: '100px' }}>
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
                            setCouponCode(coupon.code);
                            // Auto-trigger calculation
                            apiPost('/bookings/calculate-price', {
                              turf_id: parseInt(params.id),
                              booking_date: selectedDate,
                              time_slots: selectedSlots,
                              coupon_code: coupon.code
                            }).then(data => {
                              setPricingBreakdown(data);
                              setDiscountAmount(data.discountAmount);
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
                  
                  {pricingBreakdown && (
                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Official Price (Striked)</span>
                        <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through', fontSize: '0.9rem' }}>
                          {formatPrice(pricingBreakdown.displayPrice)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--emerald-400)', fontSize: '0.85rem' }}>BookArena Exclusive Deal</span>
                        <span style={{ color: 'var(--emerald-400)', fontWeight: 600, fontSize: '0.9rem' }}>
                          -{formatPrice(pricingBreakdown.markupAmount)} OFF
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', padding: '8px 0', borderBottom: '1px dashed var(--border-subtle)' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>Special Discounted Price</span>
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
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Service Fee (Admin)</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                          +{formatPrice(pricingBreakdown.serviceFee)}
                        </span>
                      </div>
                      
                      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>Total Final Amount</span>
                        <span style={{ color: 'var(--emerald-400)', fontWeight: 800, fontSize: '1.4rem' }}>
                          {formatPrice(pricingBreakdown.finalAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coupon Input */}
                {showBookingForm && selectedSlots.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">🎟️ Have a Coupon?</label>
                    {appliedCoupon ? (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        background: 'rgba(16,185,129,0.1)', 
                        borderRadius: 'var(--radius-md)', 
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--emerald-500)'
                      }}>
                        <div>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--emerald-600)' }}>{appliedCoupon.code}</span>
                          <span style={{ marginLeft: '0.5rem', color: 'var(--emerald-600)', fontSize: '0.85rem' }}>
                            -{appliedCoupon.discountType === 'flat' ? `₹${appliedCoupon.discountValue}` : `${appliedCoupon.discountValue}%`} OFF
                          </span>
                          <div style={{ fontSize: '0.75rem', marginTop: '2px', fontWeight: 600 }}>
                            ✅ {couponSuccess || 'applied coupoun successfully'}
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={removeCoupon}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.2rem' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Enter coupon code"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          style={{ flex: 1, textTransform: 'uppercase', fontFamily: 'monospace' }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleApplyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {couponLoading ? 'Checking...' : 'Apply'}
                        </button>
                      </div>
                    )}
                    {couponError && (
                      <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem' }}>{couponError}</p>
                    )}
                  </div>
                )}
                  

                {/* Booking Form */}
                {showBookingForm && selectedSlots.length > 0 ? (
                  !currentUser ? (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                      <p style={{ color: '#f87171', marginBottom: '1rem' }}>Login is compulsory to secure your booking.</p>
                      <Link href={`/login?redirect=/turfs/${params.id}`} className="btn btn-primary" style={{ width: '100%', display: 'inline-block' }}>
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
                        placeholder="Enter your phone number"
                        value={bookingData.phone}
                        onChange={(e) => setBookingData({ ...bookingData, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email *</label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="Enter your email"
                        value={bookingData.email}
                        onChange={(e) => setBookingData({ ...bookingData, email: e.target.value })}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg"
                      style={{ width: '100%' }}
                      disabled={bookingLoading}
                    >
                      {bookingLoading ? (
                        <>
                          <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                          Processing...
                        </>
                      ) : (
                        `💳 Pay ${formatPrice(pricingBreakdown ? pricingBreakdown.finalAmount : (selectedSlots.length * (selectedSlotPrice || turf.price_per_hour) + serviceFee - discountAmount))} & Book`
                      )}
                    </button>
                  </form>
                  )
                ) : (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                    <p>👆 Select a time slot to proceed</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function getDemoTurf(id) {
  const turfs = {
    1: { id: 1, name: 'Green Field Arena', location: 'Anna Nagar, Chennai', address: 'Plot 12, 3rd Avenue, Anna Nagar', sport_type: 'cricket', price_per_hour: 1200, description: 'Premium cricket ground with world-class pitch and professional-grade floodlights. Perfect for day and night matches.', images: ['https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80', 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80', 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80'], amenities: ['Floodlights', 'Parking', 'Changing Room', 'Drinking Water', 'First Aid', 'CCTV'] },
    2: { id: 2, name: 'Thunder Football Ground', location: 'Velachery, Chennai', address: 'Near Velachery Main Road', sport_type: 'football', price_per_hour: 1500, description: 'Full-size football ground with premium artificial turf, perfect for 5v5, 7v7, and 11v11 matches.', images: ['https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80', 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800&q=80'], amenities: ['Floodlights', 'Washroom', 'Cafeteria', 'Seating Area'] },
  };
  return turfs[id] || turfs[1];
}

function generateDemoSlots() {
  const slots = [];
  const format12Hour = (hour) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h}:00 ${ampm}`;
  };

  for (let h = 6; h <= 22; h++) {
    slots.push({
      time: `${format12Hour(h)} - ${format12Hour(h + 1)}`,
      status: Math.random() > 0.7 ? 'booked' : 'available'
    });
  }
  return slots;
}
