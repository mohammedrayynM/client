
import { useGoogleOneTapLogin } from '@react-oauth/google';
import { apiPost } from '@/lib/api';

export default function OneTapLogin() {
  useGoogleOneTapLogin({
    onSuccess: async (credentialResponse) => {
      try {
        const data = await apiPost('/users/google-login', {
          idToken: credentialResponse.credential
        });

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
