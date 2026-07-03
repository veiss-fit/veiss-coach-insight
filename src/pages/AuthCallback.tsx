import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        navigate('/login?error=confirmation_failed');
        return;
      }
      navigate('/');
    };
    handleCallback();
  }, [navigate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #071c32 0%, #205783 100%)' }}
    >
      <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: '#f5b400', borderTopColor: 'transparent' }}
        />
        <p className="text-sm font-medium" style={{ color: '#071c32' }}>
          Confirming your account...
        </p>
      </div>
    </div>
  );
}
