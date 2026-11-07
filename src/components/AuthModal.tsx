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
  defaultMode?: 'LOGIN' | 'REGISTER' | 'SMS_OTP' | 'RESET_NEW_PASSWORD';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  defaultMode = 'LOGIN',
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'SMS_VERIFY' | 'SMS_LOGIN' | 'FORGOT' | 'RESET_NEW_PASSWORD'>('LOGIN');
  const [smsSource, setSmsSource] = useState<'register' | 'login'>('login');

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
    else if (defaultMode === 'RESET_NEW_PASSWORD') setMode('RESET_NEW_PASSWORD');
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

  // 1. Password Login (Phone or Real Email) - Multi-tier verification
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      // Step A: First verify against server credential store (salted scrypt hash)
      try {
        const loginRes = await fetch('/api/auth/login-with-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: loginIdentifier.trim(),
            password: loginPassword,
          }),
        });
        const loginData = await loginRes.json();

        if (loginData.success && loginData.user) {
          const loggedUser: StoredUser = {
            id: loginData.user.id,
            firstName: loginData.user.firstName || 'Utilisateur',
            lastName: loginData.user.lastName || '',
            fullName: loginData.user.fullName || 'Utilisateur',
            email: loginData.user.email,
            phone: loginData.user.phone,
            country: (loginData.user.country as CountryCode) || 'CI',
            city: loginData.user.city || 'Abidjan',
            avatarUrl: loginData.user.avatarUrl,
            phone_verified: Boolean(loginData.user.phone_verified),
            activeRole: 'BUYER',
            kycLevel: 1,
            trustScore: 5.0,
            walletBalance: 0,
            registeredAt: loginData.user.registeredAt || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          };

          setCurrentUser(loggedUser);
          onAuthSuccess(loggedUser);
          onClose();
          return;
        }
      } catch (backendErr) {
        console.warn('Backend login attempt error:', backendErr);
      }

      // Step B: Resolve account candidate emails and try Supabase Auth
      const resolveRes = await fetch('/api/auth/resolve-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginIdentifier }),
      });
      const resolveData = await resolveRes.json();

      const candidateEmails: string[] = resolveData.candidateEmails || [resolveData.loginEmail || loginIdentifier.trim()];

      let supabaseSuccess = false;
      let authenticatedUser: any = null;

      for (const email of candidateEmails) {
        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password: loginPassword,
          });
          if (!authError && authData?.user) {
            supabaseSuccess = true;
            authenticatedUser = authData.user;
            break;
          }
        } catch {
          // try next candidate
        }
      }

      if (supabaseSuccess && authenticatedUser) {
        const profile = await getProfile(authenticatedUser.id);
        const privatePhone = await getAccountPhone(authenticatedUser.id);
        const fullName = profile?.full_name || authenticatedUser.user_metadata?.full_name || 'Utilisateur';
        const nameParts = fullName.split(' ');
        const isCleanEmail = authenticatedUser.email && !authenticatedUser.email.includes('@afrique-business.');

        const loggedUser: StoredUser = {
          id: authenticatedUser.id,
          firstName: nameParts[0] || 'Utilisateur',
          lastName: nameParts.slice(1).join(' ') || '',
          fullName,
          email: isCleanEmail ? authenticatedUser.email : undefined,
          phone: privatePhone || authenticatedUser.phone || (loginIdentifier.startsWith('+') ? loginIdentifier : undefined),
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
        return;
      }

      setErrorMsg("Mot de passe incorrect ou compte introuvable. Vous pouvez vous connecter rapidement par code SMS ou réinitialiser votre mot de passe ci-dessous.");
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
        setSmsSource('register');
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

  // 3. Confirm SMS OTP & Finish Phone Registration or Quick SMS Login
  const handleVerifyRegisterOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!smsOtpCode.trim() || smsOtpCode.trim().length < 4) {
      setErrorMsg('Veuillez saisir le code à 6 chiffres reçu par SMS.');
      return;
    }

    setIsLoading(true);

    try {
      // Branch 1: Quick SMS Login
      if (smsSource === 'login') {
        const loginRes = await fetch('/api/auth/quick-sms-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: targetPhone,
            code: smsOtpCode.trim(),
          }),
        });
        const loginData = await loginRes.json();

        if (!loginData.success || !loginData.user) {
          throw new Error(loginData.message || 'Code SMS incorrect ou expiré.');
        }

        const loggedUser: StoredUser = {
          id: loginData.user.id,
          firstName: loginData.user.firstName || 'Utilisateur',
          lastName: loginData.user.lastName || '',
          fullName: loginData.user.fullName || 'Utilisateur',
          phone: loginData.user.phone || targetPhone,
          email: loginData.user.email,
          country: (loginData.user.country as CountryCode) || 'CI',
          city: loginData.user.city || 'Abidjan',
          avatarUrl: loginData.user.avatarUrl,
          phone_verified: true,
          activeRole: 'BUYER',
          kycLevel: 1,
          trustScore: 5.0,
          walletBalance: 0,
          registeredAt: loginData.user.registeredAt || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        };

        setCurrentUser(loggedUser);
        onAuthSuccess(loggedUser);
        onClose();
        return;
      }

      // Branch 2: Phone Registration
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

      // Try client signInWithPassword if Supabase Auth user was created
      try {
        await supabase.auth.signInWithPassword({
          email: regJson.loginEmail,
          password: regPassword,
        });
      } catch {
        // Proceed with profile session
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
      console.error('Registration/SMS login error:', err);
      setErrorMsg(err.message || 'Erreur lors de la vérification.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Quick SMS OTP Login Request
  const handleSMSLoginRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!targetPhone.trim() || targetPhone.trim().length < 8) {
      setErrorMsg('Veuillez saisir un numéro de téléphone avec indicatif pays (ex: +225...)');
      return;
    }

    setIsLoading(true);
    setSmsSource('login');
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
      const appOrigin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://afrique-afrique.com';
      const redirectUrl = `${appOrigin}/#reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
        redirectTo: redirectUrl,
      });
      setIsLoading(false);

      if (error) {
        if (error.message.includes('rate limit')) {
          setErrorMsg("Limite d'envoi d'e-mails atteinte temporairement. Si votre compte est associé à votre numéro de téléphone, utilisez l'onglet « Par SMS » pour réinitialiser immédiatement votre mot de passe sans attente.");
        } else {
          setErrorMsg(`Impossible d’envoyer le lien : ${error.message}. Vous pouvez également utiliser la réinitialisation par SMS.`);
        }
      } else {
        setSuccessMsg(`Un lien sécurisé de réinitialisation a été envoyé à ${forgotEmail}. Ouvrez ce lien sur votre téléphone ou ordinateur pour définir votre nouveau mot de passe.`);
      }
    }
  };

  // 6. Forgot Password -> Confirm SMS code and update password (Auto-login on success!)
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

      setSuccessMsg('Votre mot de passe a été modifié avec succès !');

      if (data.user) {
        const loggedUser: StoredUser = {
          id: data.user.id,
          firstName: data.user.firstName || 'Utilisateur',
          lastName: data.user.lastName || '',
          fullName: data.user.fullName || 'Utilisateur',
          phone: data.user.phone || forgotPhone,
          email: data.user.email,
          country: (data.user.country as CountryCode) || 'CI',
          city: data.user.city || 'Abidjan',
          avatarUrl: data.user.avatarUrl,
          phone_verified: true,
          activeRole: 'BUYER',
          kycLevel: 1,
          trustScore: 5.0,
          walletBalance: 0,
          registeredAt: data.user.registeredAt || new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        };

        setCurrentUser(loggedUser);
        onAuthSuccess(loggedUser);
        setTimeout(() => onClose(), 1200);
      } else {
        setMode('LOGIN');
        setLoginIdentifier(forgotPhone);
        setLoginPassword(newPassword);
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      setErrorMsg(err.message || 'Erreur lors de la réinitialisation.');
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Define New Password from Email Recovery Link (Full loop closure)
  const handleUpdatePasswordFromRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

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
      // 1. Update password in Supabase Auth using the authenticated recovery session
      const { data: updateData, error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        throw updateErr;
      }

      const sessionUser = updateData.user;
      if (sessionUser) {
        // 2. Sync to server credentials store
        try {
          await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: sessionUser.id,
              newPassword,
            }),
          });
        } catch (syncErr) {
          console.warn('Backend sync warning on recovery:', syncErr);
        }

        const profile = await getProfile(sessionUser.id);
        const privPhone = await getAccountPhone(sessionUser.id);
        const fullName = profile?.full_name || sessionUser.user_metadata?.full_name || 'Utilisateur';
        const nameParts = fullName.split(' ');

        const loggedUser: StoredUser = {
          id: sessionUser.id,
          firstName: nameParts[0] || 'Utilisateur',
          lastName: nameParts.slice(1).join(' ') || '',
          fullName,
          email: sessionUser.email && !sessionUser.email.includes('@afrique-business.') ? sessionUser.email : undefined,
          phone: privPhone || sessionUser.phone,
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
      }

      if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      setSuccessMsg('Votre nouveau mot de passe a été enregistré avec succès ! Vous êtes connecté.');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Password recovery update error:', err);
      setErrorMsg(err.message || 'Erreur lors de la mise à jour du mot de passe.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white border border-[#E5E8EF] p-5 sm:p-6 shadow-2xl text-[#172033] max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#E5E8EF]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#C69A35]/50 bg-[#F8F9FC] flex items-center justify-center">
              <img src={officialLogoImg} alt="Afrique Business" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#172033]">
                {mode === 'LOGIN' && 'Connexion à votre compte'}
                {mode === 'REGISTER' && 'Créer un compte gratuit'}
                {mode === 'SMS_VERIFY' && 'Vérification par code SMS'}
                {mode === 'SMS_LOGIN' && 'Connexion rapide par SMS'}
                {mode === 'FORGOT' && 'Mot de passe oublié'}
                {mode === 'RESET_NEW_PASSWORD' && 'Définir un nouveau mot de passe'}
              </h3>
              <p className="text-[10px] text-[#596273]">Marché panafricain 100% sécurisé</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#596273] hover:text-[#172033] hover:bg-[#F8F9FC] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message banner */}
        {errorMsg && (
          <div className="mt-3.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3.5 p-3 rounded-xl bg-amber-50 border border-[#C69A35]/40 text-[#A27B20] text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C69A35] shrink-0 mt-0.5" />
            <span className="leading-snug">{successMsg}</span>
          </div>
        )}

        {/* ---------------- MODE: LOGIN ---------------- */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} className="py-4 space-y-3.5">
            <div>
              <label className="text-xs font-bold text-[#172033] block mb-1">
                Numéro de téléphone ou Adresse e-mail *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#596273] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Ex: +2250707070707 ou amadou@gmail.com"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none placeholder-gray-400 text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#172033]">Mot de passe *</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('FORGOT');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-[11px] text-[#C69A35] font-bold hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#596273] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none placeholder-gray-400 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black hover:brightness-105 active:scale-99 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading ? 'Connexion en cours...' : 'Se connecter'}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="grow border-t border-[#E5E8EF]"></div>
              <span className="shrink mx-3 text-[10px] text-[#596273] uppercase font-bold tracking-wider">ou</span>
              <div className="grow border-t border-[#E5E8EF]"></div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMode('SMS_LOGIN');
                setErrorMsg(null);
                setSuccessMsg(null);
                if (loginIdentifier.trim().startsWith('+') || /^\d{8,}$/.test(loginIdentifier.replace(/[^\d]/g, ''))) {
                  setTargetPhone(loginIdentifier.trim());
                }
              }}
              className="w-full py-2.5 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF] text-[#172033] text-xs font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Smartphone className="w-4 h-4 text-[#C69A35]" />
              <span>Connexion rapide par code SMS</span>
            </button>

            <div className="pt-2 text-center text-xs">
              <span className="text-[#596273]">Pas encore de compte ? </span>
              <button
                type="button"
                onClick={() => {
                  setMode('REGISTER');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="font-black text-[#C69A35] hover:underline"
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
              <label className="text-xs font-bold text-[#172033] block mb-1.5">Méthode d'inscription *</label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF]">
                <button
                  type="button"
                  onClick={() => {
                    setRegType('phone');
                    setErrorMsg(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    regType === 'phone'
                      ? 'bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] shadow-xs'
                      : 'text-[#596273] hover:text-[#172033]'
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
                      ? 'bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] shadow-xs'
                      : 'text-[#596273] hover:text-[#172033]'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Par E-mail</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">Prénom *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex: Amadou"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm placeholder-gray-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">Nom *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ex: Koné"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm placeholder-gray-400"
                />
              </div>
            </div>

            {/* Input according to chosen method */}
            {regType === 'phone' ? (
              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Numéro de téléphone avec indicatif *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#596273] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="+225 07 07 07 07 07"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] font-mono focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm"
                  />
                </div>
                <span className="text-[10px] text-[#596273] mt-1 block">
                  Un code SMS de vérification sécurisé vous sera envoyé par Twilio.
                </span>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">
                  Adresse e-mail réelle *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#596273] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="amadou.kone@gmail.com"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm placeholder-gray-400"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">Pays *</label>
                <select
                  value={regCountry}
                  onChange={(e) => setRegCountry(e.target.value as CountryCode)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm"
                >
                  {Object.values(AFRICAN_COUNTRIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#172033] block mb-1">Ville *</label>
                <input
                  type="text"
                  value={regCity}
                  onChange={(e) => setRegCity(e.target.value)}
                  placeholder="Abidjan"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm placeholder-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#172033] block mb-1">Mot de passe *</label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="6 caractères minimum"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm placeholder-gray-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#172033] block mb-1">
                Confirmer le mot de passe *
              </label>
              <input
                type="password"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm placeholder-gray-400"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black hover:brightness-105 active:scale-99 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading
                ? 'Traitement...'
                : regType === 'phone'
                ? 'Continuer et recevoir le code SMS'
                : 'Créer mon compte'}
            </button>

            <div className="pt-2 text-center text-xs">
              <span className="text-[#596273]">Déjà inscrit ? </span>
              <button
                type="button"
                onClick={() => {
                  setMode('LOGIN');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="font-black text-[#C69A35] hover:underline"
              >
                Se connecter
              </button>
            </div>
          </form>
        )}

        {/* ---------------- MODE: SMS OTP VERIFICATION ---------------- */}
        {mode === 'SMS_VERIFY' && (
          <form onSubmit={handleVerifyRegisterOTP} className="py-4 space-y-3.5">
            <div className="p-3.5 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF] text-xs">
              <span className="text-[#596273] block mb-0.5">Code envoyé au numéro :</span>
              <span className="font-bold text-[#172033] font-mono">{targetPhone}</span>
            </div>

            {simulatedCode && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-[#C69A35]/30 text-[11px] text-[#A27B20] flex items-center justify-between">
                <span>Code de confirmation reçu :</span>
                <span className="font-mono font-bold tracking-widest text-[#172033] bg-white border border-[#E5E8EF] px-2 py-0.5 rounded">
                  {simulatedCode}
                </span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-[#172033] block mb-1">
                Saisissez le code à 6 chiffres reçu *
              </label>
              <input
                type="text"
                maxLength={6}
                value={smsOtpCode}
                onChange={(e) => setSmsOtpCode(e.target.value)}
                placeholder="Ex: 123456"
                required
                className="w-full px-3.5 py-3 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-center font-mono text-xl tracking-widest text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black hover:brightness-105 active:scale-99 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading
                ? 'Vérification en cours...'
                : smsSource === 'login'
                ? 'Confirmer le code et me connecter'
                : 'Confirmer le code et valider mon compte'}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs text-[#596273]">
              <button
                type="button"
                onClick={() => setMode(smsSource === 'login' ? 'SMS_LOGIN' : 'REGISTER')}
                className="hover:text-[#172033]"
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
                  countdown > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-[#C69A35] hover:underline cursor-pointer'
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
              <label className="text-xs font-bold text-[#172033] block mb-1.5">Méthode de réinitialisation *</label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF]">
                <button
                  type="button"
                  onClick={() => {
                    setForgotType('phone');
                    setForgotStep('request');
                    setErrorMsg(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    forgotType === 'phone'
                      ? 'bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] shadow-xs'
                      : 'text-[#596273] hover:text-[#172033]'
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
                      ? 'bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] shadow-xs'
                      : 'text-[#596273] hover:text-[#172033]'
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
                  <p className="text-xs text-[#596273]">
                    Saisissez le numéro de téléphone associé à votre compte. Un code SMS de réinitialisation vous sera envoyé.
                  </p>
                  <div>
                    <label className="text-xs font-bold text-[#172033] block mb-1">Numéro de téléphone *</label>
                    <input
                      type="tel"
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      placeholder="Ex: +2250707070707"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black hover:brightness-105 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isLoading ? 'Envoi...' : 'Envoyer le code SMS'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotVerifySMS} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-[#172033] block mb-1">Code reçu par SMS *</label>
                    <input
                      type="text"
                      value={forgotOtpCode}
                      onChange={(e) => setForgotOtpCode(e.target.value)}
                      placeholder="Code à 6 chiffres"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] font-mono focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#172033] block mb-1">Nouveau mot de passe *</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="6 caractères minimum"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#172033] block mb-1">Confirmer le nouveau mot de passe *</label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Répétez le nouveau mot de passe"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm placeholder-gray-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black hover:brightness-105 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isLoading ? 'Mise à jour...' : 'Réinitialiser mon mot de passe'}
                  </button>
                </form>
              )
            ) : (
              <form onSubmit={handleForgotRequest} className="space-y-3">
                <p className="text-xs text-[#596273]">
                  Saisissez votre adresse e-mail. Nous vous enverrons un lien sécurisé pour définir un nouveau mot de passe.
                </p>
                <div>
                  <label className="text-xs font-bold text-[#172033] block mb-1">Adresse e-mail *</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="amadou.kone@gmail.com"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm placeholder-gray-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black hover:brightness-105 cursor-pointer shadow-md disabled:opacity-50"
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
              className="w-full text-center text-xs text-[#596273] hover:text-[#172033] pt-2 cursor-pointer font-medium"
            >
              Retour à la connexion
            </button>
          </div>
        )}

        {/* ---------------- MODE: RESET NEW PASSWORD (FROM EMAIL RECOVERY LINK) ---------------- */}
        {mode === 'RESET_NEW_PASSWORD' && (
          <form onSubmit={handleUpdatePasswordFromRecovery} className="py-4 space-y-3.5">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-[#C69A35]/30 text-xs">
              <span className="font-bold text-[#172033] block mb-0.5">Lien de réinitialisation vérifié</span>
              <span className="text-[#596273]">Saisissez votre nouveau mot de passe pour mettre à jour vos accès en toute sécurité.</span>
            </div>

            <div>
              <label className="text-xs font-bold text-[#172033] block mb-1">
                Nouveau mot de passe *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#596273] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="6 caractères minimum"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm placeholder-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#172033] block mb-1">
                Confirmer le nouveau mot de passe *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#596273] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Répétez le nouveau mot de passe"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base text-[#172033] focus:border-[#C69A35] focus:bg-white focus:outline-none text-sm placeholder-gray-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black hover:brightness-105 active:scale-99 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {isLoading ? 'Enregistrement...' : 'Enregistrer mon nouveau mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
