import React, { useState } from 'react';
import { Mail, Lock, LogIn, Radio, RefreshCw, AlertCircle, ArrowLeft, Send } from 'lucide-react';

export default function Login({ onLoginSuccess, onGoToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Forgot Password States
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const backendUrl = import.meta.env.VITE_BACKEND_URL || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas');
      }
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) return;
    setLoading(true);
    setErrorMsg('');
    setResetSuccess('');

    try {
      const res = await fetch(`${backendUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al restablecer la contraseña');
      }
      setResetSuccess(data.message || 'Se ha enviado una nueva contraseña a tu correo electrónico.');
      setResetEmail('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isForgotMode) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-b from-[#141414] to-[#0A0A0A]">
        <div className="glass-panel border border-neutral-800/80 w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6 relative">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-extrabold tracking-wider text-white">
              Recuperar Contraseña
            </h2>
            <p className="text-xs text-neutral-400">
              Ingresa tu correo para recibir una nueva contraseña temporal
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-950/60 border border-red-800/40 p-4 rounded-2xl flex gap-3 text-xs text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {resetSuccess && (
            <div className="bg-green-950/60 border border-green-800/40 p-4 rounded-2xl flex gap-3 text-xs text-green-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{resetSuccess}</span>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Correo Electrónico</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-950/80 cursor-pointer transition disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Enviar Contraseña</span>
                </>
              )}
            </button>
          </form>

          <button
            onClick={() => {
              setIsForgotMode(false);
              setErrorMsg('');
              setResetSuccess('');
            }}
            className="w-full py-3.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-400" />
            <span>Volver al Login</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-b from-[#141414] to-[#0A0A0A]">
      <div className="glass-panel border border-neutral-800/80 w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6 relative">
        <div className="text-center space-y-2">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 items-center justify-center shadow-xl mb-2">
            <Radio className="w-8 h-8 text-red-500 animate-pulse" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-wider text-white">
            Stream<span className="text-red-600">TV</span>
          </h2>
          <p className="text-xs text-neutral-400 font-medium">
            Inicia sesión para acceder a canales y películas
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-950/60 border border-red-800/40 p-4 rounded-2xl flex gap-3 text-xs text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Correo Electrónico</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Contraseña</label>
              <button
                type="button"
                onClick={() => {
                  setIsForgotMode(true);
                  setErrorMsg('');
                }}
                className="text-[11px] font-semibold text-neutral-500 hover:text-red-500 transition cursor-pointer"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-950/80 cursor-pointer transition disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Ingresar</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-neutral-400">
            ¿No tienes cuenta?{' '}
            <button
              onClick={onGoToRegister}
              className="text-red-500 hover:text-red-400 font-bold transition cursor-pointer"
            >
              Regístrate aquí
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
