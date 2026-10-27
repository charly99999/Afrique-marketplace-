import React, { useState, useEffect } from 'react';
import { StoredUser, CountryCode } from '../types';
import { setCurrentUser } from '../lib/storage';
import { sendSMSOTP, verifySMSOTP, supabase } from '../lib/supabase';
import { getProfile, getAccountPhone } from '../lib/supabaseData';
import { AFRICAN_COUNTRIES } from '../data/countries';
import { 
  X, Lock, Phone, Mail, User, CheckCircle2, AlertCircle, 
  ShieldCheck, Smartphone, RefreshCw, KeyRound
} from 'lucide-react';
import officialLogoImg from '../assets/images/logo_afrique_business_1792378287169.jpg';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: StoredUser) => void;
  defaultMode?: 'LOGIN' | 'REGISTER' | 'SMS_OTP';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  defaultMode = 'LOGIN',
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'SMS_VERIFY' | 'SMS_LOGIN' | 'FORGOT'>('LOGIN');

  // Register type: Phone or Email
  const [regType, setRegType] = useState<'phone' | 'email'>('phone');

  // Login form
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form common
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regCountry, setRegCountry] = useState<CountryCode>('CI');
  const [regCity, setRegCity] = useState('Abidjan');

  // Register form specific
  const [regPhone, setRegPhone] = useState('+225 ');
  const [regEmail, setRegEmail] = useState('');

  // SMS Verification
  const [targetPhone, setTargetPhone] = useState('');
  const [smsOtpCode, setSmsOtpCode] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);

  // Forgot password
  const [forgotType, setForgotType] = useState<'phone' | 'email'>('phone');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtpCode, setForgotOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');

  // Feedback & Loading
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (defaultMode === 'REGISTER') setMode('REGISTER');
    else if (defaultMode === 'SMS_OTP') setMode('SMS_LOGIN');
    else setMode('LOGIN');
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [defaultMode, isOpen]);

  useEffect(() => {
    let timer: any;
    if ((mode === 'SMS_VERIFY' || mode === 'SMS_LOGIN' || (mode === 'FORGOT' && forgotStep === 'verify')) && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [mode, forgotStep, countdown]);

  if (!isOpen) return null;

  // 1. Password Login (Phone or Real Email)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      // Resolve phone or email to login credential
      const resolveRes = await fetch('/api/auth/resolve-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginIdentifier }),
      });
      const resolveData = await resolveRes.json();

      if (!resolveData.success || !resolveData.loginEmail) {
        setErrorMsg("Identifiant introuvable. Veuillez vérifier ou créer un compte.");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: resolveData.loginEmail,
        password: loginPassword,
      });

      if (authError || !authData.user) {
        setErrorMsg("Identifiant ou mot de passe incorrect. Veuillez vérifier vos accès.");
        return;
      }

      // Load profile and private phone from Supabase
      const profile = await getProfile(authData.user.id);
      const privatePhone = await getAccountPhone(authData.user.id);
      const fullName = profile?.full_name || authData.user.user_metadata?.full_name || 'Utilisateur';
      const nameParts = fullName.split(' ');

      const isCleanEmail = authData.user.email && !authData.user.email.includes('@afrique-business.app') && !authData.user.email.includes('@afrique-business.internal');

      const loggedUser: StoredUser = {
        id: authData.user.id,
        firstName: nameParts[0] || 'Utilisateur',
        lastName: nameParts.slice(1).join(' ') || '',
        fullName,
        email: isCleanEmail ? authData.user.email : undefined,
        phone: privatePhone || authData.user.phone || (loginIdentifier.startsWith('+') ? loginIdentifier : undefined),
        country: (profile?.country as CountryCode) || 'CI',
        city: profile?.city || 'Abidjan',
        avatarUrl: profile?.avatar_url,
        phone_verified: Boolean(profile?.phone_verified),
        activeRole: 'BUYER',
        kycLevel: 1,
        trustScore: 5.0,
        walletBalance: 0,
        registeredAt: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      };

      setCurrentUser(loggedUser);
      onAuthSuccess(loggedUser);
      onClose();
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg("Erreur lors de la connexion. Veuillez vérifier vos identifiants.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Start Registration -> Phone or Email
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('Veuillez renseigner votre prénom et votre nom.');
      return;
    }

    if (!regPassword || regPassword.length < 6) {
      setErrorMsg('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Les deux mots de passe ne correspondent pas.');
      return;
    }

    // Branch A: Phone Registration with SMS code verification via Twilio
    if (regType === 'phone') {
      const cleanPhone = regPhone.trim();
      const phoneRegex = /^\+?[0-9]{8,15}$/;
      if (!cleanPhone || !phoneRegex.test(cleanPhone.replace(/[\s\-\(\)]/g, ''))) {
        setErrorMsg('Veuillez saisir un numéro de téléphone valide avec indicatif pays (ex: +2250707070707).');
        return;
      }

      setIsLoading(true);
      setTargetPhone(cleanPhone);

      const result = await sendSMSOTP(cleanPhone);
      setIsLoading(false);

      if (result.success) {
        setCountdown(60);
        if (result.simulated && result.otp) {
          setSimulatedCode(result.otp);
          setSmsOtpCode(result.otp);
        }
        setSuccessMsg('Un code de confirmation SMS a été envoyé à votre numéro.');
        setMode('SMS_VERIFY');
      } else {
        setErrorMsg(result.message || 'Impossible d’envoyer le SMS. Vérifiez votre numéro.');
      }
      return;
    }

    // Branch B: Real Email Registration (Vérification normale)
    if (regType === 'email') {
      const cleanEmail = regEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        setErrorMsg('Veuillez saisir une adresse e-mail valide (ex: contact@exemple.com).');
        return;
      }

      setIsLoading(true);
      try {
        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: regPassword,
          options: {
            data: {
              full_name: fullName,
              city: regCity.trim() || 'Abidjan',
              country: regCountry,
            },
          },
        });

        if (signUpErr || !signUpData.user) {
          throw new Error(signUpErr?.message || 'Erreur lors de la création du compte par e-mail.');
        }

        // Create profile in profiles table with phone_verified = false
        await supabase.from('profiles').upsert({
          id: signUpData.user.id,
          full_name: fullName,
          city: regCity.trim() || 'Abidjan',
          country: regCountry,
          phone_verified: false,
        });

        if (signUpData.session) {
          const newUser: StoredUser = {
            id: signUpData.user.id,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            fullName,
            email: cleanEmail,
            country: regCountry,
            city: regCity.trim() || 'Abidjan',
            phone_verified: false,
            activeRole: 'BUYER',
            kycLevel: 1,
            trustScore: 5.0,
            walletBalance: 0,
            registeredAt: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          };
          setCurrentUser(newUser);
          onAuthSuccess(newUser);
          onClose();
        } else {
          setSuccessMsg('Compte créé ! Veuillez vérifier votre boîte e-mail pour confirmer votre inscription.');
          setMode('LOGIN');
        }
      } catch (err: any) {
        console.error('Email registration error:', err);
        setErrorMsg(err.message || 'Erreur lors de l’inscription par e-mail.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 3. Confirm SMS OTP & Finish Phone Registration
  const handleVerifyRegisterOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!smsOtpCode.trim() || smsOtpCode.trim().length < 4) {
      setErrorMsg('Veuillez saisir le code à 6 chiffres reçu par SMS.');
      return;
    }

    setIsLoading(true);
    const result = await verifySMSOTP(targetPhone, smsOtpCode.trim());

    if (!result.success) {
      setIsLoading(false);
      setErrorMsg(result.message || 'Code SMS incorrect ou expiré.');
      return;
    }

    try {
      // Create user with verified phone via backend (which registers into Supabase Auth + profiles + profile_private)
      const regRes = await fetch('/api/auth/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,
          password: regPassword,
          fullName: `${firstName.trim()} ${lastName.trim()}`,
          city: regCity.trim() || 'Abidjan',
          country: regCountry,
        }),
      });
      const regJson = await regRes.json();

      if (!regJson.success || !regJson.userId) {
        throw new Error(regJson.message || 'Échec de la création du compte.');
      }

      // Sign in on client to establish Supabase Auth Session
      const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: regJson.loginEmail,
        password: regPassword,
      });

      if (signInErr || !authData.user) {
        throw new Error(signInErr?.message || 'Erreur lors de l’initialisation de la session.');
      }

      const newUser: StoredUser = {
        id: regJson.userId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        phone: targetPhone,
        country: regCountry,
        city: regCity.trim() || 'Abidjan',
        phone_verified: true,
        activeRole: 'BUYER',
        kycLevel: 1,
        trustScore: 5.0,
        walletBalance: 0,
        registeredAt: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      };

      setCurrentUser(newUser);
      onAuthSuccess(newUser);
      onClose();
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMsg(err.message || 'Erreur lors de la finalisation du compte.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Quick SMS OTP Login
  const handleSMSLoginRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!targetPhone.trim() || targetPhone.trim().length < 8) {
      setErrorMsg('Veuillez saisir un numéro de téléphone avec indicatif pays (ex: +225...)');
      return;
    }

    setIsLoading(true);
    const result = await sendSMSOTP(targetPhone);
    setIsLoading(false);

    if (result.success) {
      setCountdown(60);
      if (result.simulated && result.otp) {
        setSimulatedCode(result.otp);
        setSmsOtpCode(result.otp);
      }
      setSuccessMsg('Code de connexion SMS envoyé.');
      setMode('SMS_VERIFY');
    } else {
      setErrorMsg(result.message || 'Erreur lors de l’envoi du SMS.');
    }
  };

  // 5. Forgot Password -> SMS or Real Email
  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (forgotType === 'phone') {
      if (!forgotPhone.trim()) {
        setErrorMsg('Veuillez saisir votre numéro de téléphone.');
        return;
      }

      setIsLoading(true);
      const result = await sendSMSOTP(forgotPhone);
      setIsLoading(false);

      if (result.success) {
        setForgotStep('verify');
        setCountdown(60);
        if (result.simulated && result.otp) {
          setForgotOtpCode(result.otp);
        }
        setSuccessMsg('Code de réinitialisation envoyé par SMS.');
      } else {
        setErrorMsg(result.message || 'Numéro introuvable.');
      }
    } else {
      if (!forgotEmail.trim()) {
        setErrorMsg('Veuillez saisir votre adresse e-mail.');
        return;
      }

      setIsLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
        redirectTo: window.location.origin,
      });
      setIsLoading(false);

      if (error) {
        setErrorMsg(`Impossible d’envoyer le lien : ${error.message}`);
      } else {
        setSuccessMsg('Un lien de réinitialisation a été envoyé à votre adresse e-mail.');
      }
    }
  };

  // 6. Forgot Password -> Confirm SMS code and update password in Supabase Auth
  const handleForgotVerifySMS = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!forgotOtpCode.trim()) {
      setErrorMsg('Veuillez saisir le code SMS à 6 chiffres reçu.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: forgotPhone,
          code: forgotOtpCode.trim(),
          newPassword,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'Échec de la réinitialisation du mot de passe.');
      }

      setSuccessMsg('Votre mot de passe a été modifié avec succès ! Vous pouvez vous connecter.');
      setMode('LOGIN');
      setLoginIdentifier(forgotPhone);
      setLoginPassword('');
    } catch (err: any) {
      console.error('Password reset error:', err);
      setErrorMsg(err.message || 'Erreur lors de la réinitialisation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-zinc-800 p-5 sm:p-6 shadow-2xl text-white max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#D4AF37]/50 bg-black flex items-center justify-center">
              <img src={officialLogoImg} alt="Afrique Business" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                {mode === 'LOGIN' && 'Connexion à votre compte'}
                {mode === 'REGISTER' && 'Créer un compte gratuit'}
                {mode === 'SMS_VERIFY' && 'Vérification par code SMS'}
                {mode === 'SMS_LOGIN' && 'Connexion rapide par SMS'}
                {mode === 'FORGOT' && 'Mot de passe oublié'}
              </h3>
              <p className="text-[10px] text-gray-400">Marché panafricain 100% sécurisé</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message banner */}
        {errorMsg && (
          <div className="mt-3.5 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3.5 p-3 rounded-xl bg-amber-950/60 border border-[#D4AF37]/40 text-[#D4AF37] text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-snug">{successMsg}</span>
          </div>
        )}

        {/* ---------------- MODE: LOGIN ---------------- */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} className="py-4 space-y-3.5">
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">
                Numéro de téléphone ou Adresse e-mail *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Ex: +2250707070707 ou amadou@gmail.com"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none placeholder-zinc-500 text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-300">Mot de passe *</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('FORGOT');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-[11px] text-[#D4AF37] hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none placeholder-zinc-500 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 active:scale-99 transition-all cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isLoading ? 'Connexion en cours...' : 'Se connecter'}
            </button>

            <div className="pt-2 text-center text-xs">
              <span className="text-gray-400">Pas encore de compte ? </span>
              <button
                type="button"
                onClick={() => {
                  setMode('REGISTER');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="font-bold text-[#D4AF37] hover:underline"
              >
                Créer un compte
              </button>
            </div>
          </form>
        )}

        {/* ---------------- MODE: REGISTER ---------------- */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} className="py-4 space-y-3">
            {/* Method Toggle: Numéro de téléphone OU Adresse e-mail */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1.5">Méthode d'inscription *</label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#181820] border border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setRegType('phone');
                    setErrorMsg(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    regType === 'phone'
                      ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Par Téléphone</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegType('email');
                    setErrorMsg(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    regType === 'email'
                      ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Par E-mail</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Prénom *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex: Amadou"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Nom *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ex: Koné"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none text-sm"
                />
              </div>
            </div>

            {/* Input according to chosen method */}
            {regType === 'phone' ? (
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">
                  Numéro de téléphone avec indicatif *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+225 07 07 07 07 07"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white font-mono focus:border-[#D4AF37] focus:outline-none text-sm"
                  />
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Un code SMS de vérification sécurisé vous sera envoyé par Twilio.
                </span>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">
                  Adresse e-mail réelle *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="amadou.kone@gmail.com"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none text-sm"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Pays *</label>
                <select
                  value={regCountry}
                  onChange={(e) => setRegCountry(e.target.value as CountryCode)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none text-sm"
                >
                  {Object.values(AFRICAN_COUNTRIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">Ville *</label>
                <input
                  type="text"
                  value={regCity}
                  onChange={(e) => setRegCity(e.target.value)}
                  placeholder="Abidjan"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">Mot de passe *</label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="6 caractères minimum"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">
                Confirmer le mot de passe *
              </label>
              <input
                type="password"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 active:scale-99 transition-all cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isLoading
                ? 'Traitement...'
                : regType === 'phone'
                ? 'Continuer et recevoir le code SMS'
                : 'Créer mon compte'}
            </button>

            <div className="pt-2 text-center text-xs">
              <span className="text-gray-400">Déjà inscrit ? </span>
              <button
                type="button"
                onClick={() => {
                  setMode('LOGIN');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="font-bold text-[#D4AF37] hover:underline"
              >
                Se connecter
              </button>
            </div>
          </form>
        )}

        {/* ---------------- MODE: SMS OTP VERIFICATION ---------------- */}
        {mode === 'SMS_VERIFY' && (
          <form onSubmit={handleVerifyRegisterOTP} className="py-4 space-y-3.5">
            <div className="p-3.5 rounded-xl bg-[#181820] border border-zinc-800 text-xs">
              <span className="text-gray-400 block mb-0.5">Code envoyé au numéro :</span>
              <span className="font-bold text-white font-mono">{targetPhone}</span>
            </div>

            {simulatedCode && (
              <div className="p-2.5 rounded-lg bg-amber-950/40 border border-[#D4AF37]/30 text-[11px] text-[#D4AF37] flex items-center justify-between">
                <span>Code de confirmation reçu :</span>
                <span className="font-mono font-bold tracking-widest text-white bg-black/60 px-2 py-0.5 rounded">
                  {simulatedCode}
                </span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">
                Saisissez le code à 6 chiffres reçu *
              </label>
              <input
                type="text"
                maxLength={6}
                value={smsOtpCode}
                onChange={(e) => setSmsOtpCode(e.target.value)}
                placeholder="Ex: 123456"
                required
                className="w-full px-3.5 py-3 rounded-xl border border-zinc-700 bg-[#181820] text-center font-mono text-xl tracking-widest text-white focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 active:scale-99 transition-all cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isLoading ? 'Vérification en cours...' : 'Confirmer le code et valider mon compte'}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs text-gray-400">
              <button
                type="button"
                onClick={() => setMode('REGISTER')}
                className="hover:text-white"
              >
                Changer de numéro
              </button>

              <button
                type="button"
                disabled={countdown > 0 || isLoading}
                onClick={async () => {
                  setIsLoading(true);
                  const res = await sendSMSOTP(targetPhone);
                  setIsLoading(false);
                  if (res.success) {
                    setCountdown(60);
                    if (res.simulated && res.otp) {
                      setSimulatedCode(res.otp);
                      setSmsOtpCode(res.otp);
                    }
                    setSuccessMsg('Nouveau code envoyé par SMS.');
                  }
                }}
                className={`font-semibold ${
                  countdown > 0 ? 'text-gray-500 cursor-not-allowed' : 'text-[#D4AF37] hover:underline cursor-pointer'
                }`}
              >
                {countdown > 0 ? `Renvoyer (${countdown}s)` : 'Renvoyer le code SMS'}
              </button>
            </div>
          </form>
        )}

        {/* ---------------- MODE: FORGOT PASSWORD ---------------- */}
        {mode === 'FORGOT' && (
          <div className="py-4 space-y-3.5">
            {/* Method choice for password reset */}
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1.5">Méthode de réinitialisation *</label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#181820] border border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setForgotType('phone');
                    setForgotStep('request');
                    setErrorMsg(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    forgotType === 'phone'
                      ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Par SMS (Téléphone)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotType('email');
                    setForgotStep('request');
                    setErrorMsg(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    forgotType === 'email'
                      ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Par E-mail</span>
                </button>
              </div>
            </div>

            {forgotType === 'phone' ? (
              forgotStep === 'request' ? (
                <form onSubmit={handleForgotRequest} className="space-y-3">
                  <p className="text-xs text-gray-300">
                    Saisissez le numéro de téléphone associé à votre compte. Un code SMS de réinitialisation vous sera envoyé.
                  </p>
                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">Numéro de téléphone *</label>
                    <input
                      type="tel"
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      placeholder="Ex: +2250707070707"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none text-sm font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isLoading ? 'Envoi...' : 'Envoyer le code SMS'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotVerifySMS} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">Code reçu par SMS *</label>
                    <input
                      type="text"
                      value={forgotOtpCode}
                      onChange={(e) => setForgotOtpCode(e.target.value)}
                      placeholder="Code à 6 chiffres"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white font-mono focus:border-[#D4AF37] focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">Nouveau mot de passe *</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="6 caractères minimum"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">Confirmer le nouveau mot de passe *</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Répétez le nouveau mot de passe"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isLoading ? 'Mise à jour...' : 'Réinitialiser mon mot de passe'}
                  </button>
                </form>
              )
            ) : (
              <form onSubmit={handleForgotRequest} className="space-y-3">
                <p className="text-xs text-gray-300">
                  Saisissez votre adresse e-mail. Nous vous enverrons un lien sécurisé pour définir un nouveau mot de passe.
                </p>
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Adresse e-mail *</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="amadou.kone@gmail.com"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-base text-white focus:border-[#D4AF37] focus:outline-none text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isLoading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className="w-full text-center text-xs text-gray-400 hover:text-white pt-2 cursor-pointer"
            >
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
