/* Mock Database for purely client-side simulation */

// Helper to get from local storage
const loadDB = () => {
  if (typeof window === 'undefined') return { turfs: [], bookings: [], owners: [], blocked: [], commission: 10 };
  const data = localStorage.getItem('bma_db');
  if (data) return JSON.parse(data);
  
  // Initial demo data
  const defaultDB = {
    turfs: [
      { id: 1, name: 'Green Field Arena', location: 'Anna Nagar, Chennai', address: 'Plot 12, 3rd Avenue', sport_type: 'cricket', price_per_hour: 1200, is_active: true, owner_id: 1, images: ['https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80'], amenities: ['Floodlights'], created_at: new Date().toISOString() },
      { id: 2, name: 'Thunder Football Ground', location: 'Velachery, Chennai', address: 'Near Velachery Main', sport_type: 'football', price_per_hour: 1500, is_active: true, owner_id: 1, images: ['https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80'], amenities: ['Floodlights'], created_at: new Date().toISOString() }
    ],
    bookings: [],
    owners: [
      { id: 1, name: 'Demo Owner', email: 'owner@demo.com', phone: '1234567890', is_approved: true, is_blocked: false, created_at: new Date().toISOString() }
    ],
    blocked: [],
    commission: 10
  };
  localStorage.setItem('bma_db', JSON.stringify(defaultDB));
  return defaultDB;
};

// Helper to save to local storage
const saveDB = (db) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('bma_db', JSON.stringify(db));
  }
};

export const mockGet = async (endpoint) => {
  const db = loadDB();
  
  // GET /turfs
  if (endpoint.startsWith('/turfs') && !endpoint.includes('slots') && !endpoint.match(/\/turfs\/\d+$/)) {
    const urlParams = new URLSearchParams(endpoint.split('?')[1]);
    const sport = urlParams.get('sport');
    let activeTurfs = db.turfs.filter(t => t.is_active);
    if (sport && sport !== 'all') activeTurfs = activeTurfs.filter(t => t.sport_type === sport);
    return { turfs: activeTurfs };
  }
  
  // GET /turfs/:id
  const turfMatch = endpoint.match(/^\/turfs\/(\d+)$/);
  if (turfMatch) {
    const turf = db.turfs.find(t => t.id === parseInt(turfMatch[1]));
    if (!turf) throw new Error('Turf not found');
    return { turf };
  }
  
  // GET /turfs/:id/slots
  if (endpoint.includes('/slots')) {
    const turfId = parseInt(endpoint.split('/')[2]);
    const date = new URLSearchParams(endpoint.split('?')[1]).get('date');
    const turfBookings = db.bookings.filter(b => b.turf_id === turfId && b.booking_date === date && b.status !== 'cancelled');
    const turfBlocked = db.blocked.filter(b => b.turf_id === turfId && b.block_date === date);
    
    const slots = [];
    for (let h = 6; h <= 22; h++) {
      const time = `${h.toString().padStart(2, '0')}:00 - ${(h + 1).toString().padStart(2, '0')}:00`;
      let status = 'available';
      if (turfBookings.some(b => b.time_slot === time)) status = 'booked';
      if (turfBlocked.some(b => b.time_slot === time)) status = 'blocked';
      slots.push({ time, status });
    }
    return { slots };
  }

  // GET /owners/turfs
  if (endpoint === '/owners/turfs') {
    const ownerId = 1; // Assuming owner 1 for demo
    return { turfs: db.turfs.filter(t => t.owner_id === ownerId).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) };
  }

  // GET /owners/bookings
  if (endpoint === '/owners/bookings') {
    const ownerId = 1;
    const ownerTurfIds = db.turfs.filter(t => t.owner_id === ownerId).map(t => t.id);
    const bookings = db.bookings.filter(b => ownerTurfIds.includes(b.turf_id));
    return { bookings: bookings.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) };
  }

  // GET /owners/earnings
  if (endpoint === '/owners/earnings') {
    const ownerId = 1;
    const ownerTurfIds = db.turfs.filter(t => t.owner_id === ownerId).map(t => t.id);
    const validBookings = db.bookings.filter(b => ownerTurfIds.includes(b.turf_id) && b.payment_status === 'success');
    
    const total = validBookings.reduce((sum, b) => parseFloat(sum) + parseFloat(b.amount || 0), 0);
    const today = validBookings.filter(b => new Date(b.created_at).toDateString() === new Date().toDateString()).reduce((sum, b) => parseFloat(sum) + parseFloat(b.amount || 0), 0);
    const commissionDeducted = total * (db.commission / 100);
    
    return {
      total, today, monthly: total, commission_percent: db.commission,
      commission_deducted: commissionDeducted, net_earnings: total - commissionDeducted
    };
  }

  /* Admin Routes */
  if (endpoint === '/admin/dashboard') {
    const total_revenue = db.bookings.filter(b => b.payment_status === 'success').reduce((sum, b) => parseFloat(sum) + parseFloat(b.amount || 0), 0);
    return { stats: {
      total_turfs: db.turfs.length,
      total_owners: db.owners.length,
      total_bookings: db.bookings.length,
      total_revenue: total_revenue,
      platform_revenue: total_revenue * (db.commission / 100),
      commission_percent: db.commission
    }};
  }
  if (endpoint === '/admin/turfs') return { turfs: db.turfs };
  if (endpoint === '/admin/owners') return { owners: db.owners };
  if (endpoint === '/admin/bookings') return { bookings: db.bookings };

  throw new Error('Not implemented');
};

export const mockPost = async (endpoint, body) => {
  const db = loadDB();
  
  if (endpoint === '/bookings') {
    const turf = db.turfs.find(t => t.id === body.turf_id);
    const newBooking = {
      id: db.bookings.length + 1,
      ...body,
      turf_name: turf?.name || 'Unknown Turf',
      amount: turf?.price_per_hour || 1000,
      payment_status: 'success',
      status: 'confirmed',
      created_at: new Date().toISOString()
    };
    db.bookings.push(newBooking);
    saveDB(db);
    return { booking_id: newBooking.id, amount: newBooking.amount, success: true };
  }
  
  if (endpoint === '/owners/turfs' || endpoint === '/admin/turfs') {
    const newTurf = {
      id: db.turfs.length ? Math.max(...db.turfs.map(t=>t.id)) + 1 : 1,
      ...body,
      price_per_hour: parseFloat(body.price_per_hour || 0),
      is_active: true,
      owner_id: 1,
      created_at: new Date().toISOString()
    };
    db.turfs.push(newTurf);
    saveDB(db);
    return { success: true, turf_id: newTurf.id };
  }

  if (endpoint.includes('/block-slot')) {
    const turfId = parseInt(endpoint.split('/')[2]);
    db.blocked.push({ ...body, turf_id: turfId, created_at: new Date().toISOString() });
    saveDB(db);
    return { success: true };
  }

  throw new Error('Not implemented');
};

export const mockPut = async (endpoint, body) => {
  const db = loadDB();
  
  if (endpoint.startsWith('/owners/turfs/') || endpoint.startsWith('/admin/turfs/')) {
    const id = parseInt(endpoint.split('/')[3]);
    const idx = db.turfs.findIndex(t => t.id === id);
    if (idx !== -1) {
      db.turfs[idx] = { ...db.turfs[idx], ...body };
      saveDB(db);
      return { success: true };
    }
  }

  if (endpoint.startsWith('/admin/bookings/') && endpoint.endsWith('/cancel')) {
    const id = parseInt(endpoint.split('/')[3]);
    const b = db.bookings.find(b => b.id === id);
    if (b) { b.status = 'cancelled'; saveDB(db); return { success: true }; }
  }

  if (endpoint === '/admin/settings/commission') {
    db.commission = body.commission_percent;
    saveDB(db);
    return { success: true };
  }
  
  if (endpoint.startsWith('/admin/owners/')) {
    const id = parseInt(endpoint.split('/')[3]);
    const op = endpoint.split('/')[4];
    const o = db.owners.find(o => o.id === id);
    if (o) {
      if (op === 'approve') o.is_approved = true;
      if (op === 'reject') o.is_approved = false;
      if (op === 'block') o.is_blocked = body.is_blocked;
      saveDB(db);
      return { success: true };
    }
  }

  throw new Error('Not implemented');
};

export const mockDelete = async (endpoint) => {
  const db = loadDB();
  
  if (endpoint.startsWith('/owners/turfs/') || endpoint.startsWith('/admin/turfs/')) {
    const id = parseInt(endpoint.split('/')[3]);
    db.turfs = db.turfs.filter(t => t.id !== id);
    saveDB(db);
    return { success: true };
  }

  throw new Error('Not implemented');
};
