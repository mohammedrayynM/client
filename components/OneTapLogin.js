'use client';

import { useGoogleOneTapLogin } from '@react-oauth/google';
import { useRouter } from 'next/navigation';

export default function OneTapLogin() {
  const router = useRouter();

  useGoogleOneTapLogin({
    onSuccess: async (credentialResponse) => {
      try {
        const api_base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const res = await fetch(`${api_base}/users/google-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: credentialResponse.credential })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Google Login failed');

        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));

        // Reload to update UI
        window.location.reload();
      } catch (err) {
        console.error('One Tap Error:', err);
      }
    },
    onError: () => {
      console.log('One Tap Login Failed');
    },
    disabled: !!(typeof window !== 'undefined' && localStorage.getItem('userToken')),
  });

  return null;
}
