import React, { useState } from 'react';
import { Mail, User, UserPlus, Radio, RefreshCw, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

export default function Register({ onGoToLogin }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !name) return;
    setLoading(true);
    setErrorMsg('');

    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';

    try {
      const res = await fetch(`${backendUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear la cuenta');
      }
      setSuccess(true);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-b from-[#141414] to-[#0A0A0A]">
        <div className="glass-panel border border-neutral-800/80 w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6 text-center">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-green-950/40 border border-green-800/40 items-center justify-center shadow-xl mb-2 text-green-400">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-extrabold text-white">¡Registro Exitoso!</h2>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Hemos creado tu cuenta de prueba y generado una contraseña de acceso.
          </p>
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl text-xs text-neutral-400 leading-relaxed">
            Por favor, <strong>revisa tu correo electrónico</strong> (incluyendo la carpeta de Spam) para obtener tus credenciales e iniciar sesión.
          </div>
          <button
            onClick={onGoToLogin}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm transition shadow-lg shadow-red-950/80 cursor-pointer"
          >
            Ir al Inicio de Sesión
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
            Crea tu cuenta beta de prueba
          </p>
        </div>

        {/* Beta Notice Banner */}
        <div className="bg-amber-950/40 border border-amber-800/30 p-4 rounded-2xl flex gap-3 text-[11px] text-amber-400 leading-relaxed">
          <Sparkles className="w-5 h-5 flex-shrink-0 text-amber-500" />
          <span>
            <strong>¡Modo Beta Activo!</strong> Al registrarte tendrás acceso completo de prueba gratis por <strong>6 horas</strong>. Un administrador podrá extender tu cuenta después.
          </span>
        </div>

        {errorMsg && (
          <div className="bg-red-950/60 border border-red-800/40 p-4 rounded-2xl flex gap-3 text-xs text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Nombre Completo</label>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition"
              />
            </div>
          </div>

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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-950/80 cursor-pointer transition disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Registrarme y Recibir Acceso</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-neutral-400">
            ¿Ya tienes cuenta?{' '}
            <button
              onClick={onGoToLogin}
              className="text-red-500 hover:text-red-400 font-bold transition cursor-pointer"
            >
              Inicia sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
