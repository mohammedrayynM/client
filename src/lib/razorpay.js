// Client Razorpay Web Helper

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout({
  keyId,
  orderId,
  amount, // in rupees or paise
  currency = 'INR',
  name = 'Book Arena',
  description = 'Booking Payment',
  prefill = {},
  themeColor = '#10b981',
}) {
  const loaded = await loadRazorpayScript();
  if (!loaded || typeof window === 'undefined' || !window.Razorpay) {
    throw new Error('Razorpay SDK could not be loaded. Please ensure your ad-blocker is disabled.');
  }

  return new Promise((resolve, reject) => {
    const options = {
      key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_z3yv8sA6hTxbwB',
      order_id: orderId,
      currency,
      name,
      description,
      prefill: {
        name: prefill.name || '',
        email: prefill.email || '',
        contact: prefill.phone || prefill.contact || '',
      },
      theme: {
        color: themeColor,
      },
      handler: function (response) {
        resolve({
          status: 'success',
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: function () {
          reject(new Error('PAYMENT_DISMISSED'));
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
      reject(new Error(response?.error?.description || 'Payment failed'));
    });
    rzp.open();
  });
}

export const loadRazorpay = loadRazorpayScript;
