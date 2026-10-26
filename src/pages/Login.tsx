import { useState } from 'react';
import { useAuth } from '@/store/auth';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Music } from 'lucide-react';

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validasi sederhana
    if (username.trim().length < 3) {
      return setError('Username minimal 3 karakter');
    }
    if (passcode.length < 4) {
      return setError('Passcode minimal 4 karakter');
    }

    // Proses login atau register
    const res = isRegister 
      ? await register(username, passcode) 
      : await login(username, passcode);
    
    if (res.success) {
      navigate('/'); // Pindah ke Home kalau berhasil
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background dekorasi (opsional, karena AmbientBackground mungkin nggak kepanggil di luar router) */}
      <div className="absolute inset-0 -z-10 bg-[#0b0b0f]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] -z-10" />

      <div className="glass-strong rounded-[28px] p-8 max-w-sm w-full space-y-6 shadow-2xl">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-accent to-emerald-700 flex items-center justify-center shadow-lg mb-4">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isRegister ? 'Buat Akun Baru' : 'Selamat Datang'}
          </h1>
          <p className="text-white/60 text-sm mt-1">
            {isRegister ? 'Daftarkan username & passcode kamu' : 'Masuk ke Liquid Music Player'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-400 text-sm p-3 rounded-xl border border-red-500/30 text-center animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Username (tanpa spasi)"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white outline-none focus:border-accent transition-colors"
              required
            />
          </div>
          
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="password"
              placeholder="Passcode (angka/huruf)"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white outline-none focus:border-accent transition-colors"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-semibold rounded-full py-3 tap hover:bg-gray-100 transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Memproses...' : isRegister ? 'Daftar' : 'Masuk'}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="text-sm text-white/60 hover:text-white transition-colors tap"
          >
            {isRegister ? 'Udah punya akun? Masuk di sini' : 'Belum punya akun? Daftar sekarang'}
          </button>
        </div>
      </div>
    </div>
  );
}
