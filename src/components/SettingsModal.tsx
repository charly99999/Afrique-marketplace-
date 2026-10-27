import React, { useState, useEffect } from 'react';
import { CountryCode, StoredUser } from '../types';
import { AFRICAN_COUNTRIES, CITIES_BY_COUNTRY } from '../data/countries';
import { 
  updateProfile, uploadWebpImage, getBlockedUserIds, unblockUser,
  submitSupportTicket, rpcDeleteMyAccount, PhoneVisibility, SupportTicketKind,
  updateProfileAvatar, getAccountPhone, updateAccountPhone, testConnectionSpeed
} from '../lib/supabaseData';
import { supabase } from '../lib/supabase';
import { 
  X, User, Shield, Lock, Eye, Bell, Globe, 
  Moon, Sun, Zap, HelpCircle, Info, 
  LogOut, Trash2, Check, AlertCircle, Camera, ChevronRight, ShieldCheck, 
  Phone, Mail, MessageSquare, Star, Activity, Sparkles, AlertTriangle, Key
} from 'lucide-react';
import officialLogoImg from '../assets/images/logo_afrique_business_1792378287169.jpg';
import { PWAInstallButton } from './PWAInstallButton';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: StoredUser | null;
  onUpdateUser: (updatedUser: StoredUser) => void;
  selectedCountry: CountryCode;
  onSelectCountry: (code: CountryCode) => void;
  dataSaver: boolean;
  onToggleDataSaver: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenAdminFacebook?: () => void;
}

type SettingsSection = 
  | 'menu'
  | 'personal_details'
  | 'phone_number'
  | 'change_email'
  | 'language'
  | 'notifications'
  | 'connection_test'
  | 'rate_us'
  | 'about'
  | 'change_password'
  | 'theme'
  | 'delete_account';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  selectedCountry,
  onSelectCountry,
  dataSaver,
  onToggleDataSaver,
  darkMode,
  onToggleDarkMode,
  onOpenAuth,
  onLogout,
  onOpenAdminFacebook,
}) => {
  const [section, setSection] = useState<SettingsSection>('menu');

  // --- 1. Personal Details States ---
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [city, setCity] = useState(currentUser?.city || '');
  const [country, setCountry] = useState<CountryCode>(currentUser?.country || selectedCountry);
  const [birthDate, setBirthDate] = useState<string>(currentUser?.birth_date || '');
  const [gender, setGender] = useState<'masculin' | 'feminin' | ''>(
    (currentUser?.gender as any) || ''
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);

  // --- 2. Phone Number State (profile_private.phone) ---
  const [phoneInput, setPhoneInput] = useState(currentUser?.phone || '');
  const [savingPhone, setSavingPhone] = useState(false);

  // --- 3. Email Update State (Supabase Auth) ---
  const [newEmail, setNewEmail] = useState(currentUser?.email || '');
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // --- 4. Language State (fr / en) ---
  const [language, setLanguage] = useState<'fr' | 'en'>(currentUser?.language || 'fr');

  // --- 5. Chats Enabled Toggle ---
  const [chatsEnabled, setChatsEnabled] = useState<boolean>(
    currentUser?.chats_enabled !== false
  );
  const [savingChatsToggle, setSavingChatsToggle] = useState(false);

  // --- 6. Notifications State ---
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifOffers, setNotifOffers] = useState(true);
  const [notifSms, setNotifSms] = useState(true);

  // --- 7. Connection Speed Test State ---
  const [isTestingSpeed, setIsTestingSpeed] = useState(false);
  const [speedResult, setSpeedResult] = useState<{
    latencyMs: number;
    status: 'bonne' | 'moyenne' | 'faible';
    advice: string;
  } | null>(null);

  // --- 8. Rate Us State (1-5 stars + comment) ---
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);

  // --- 9. Theme State (system / light / dark) ---
  const [themePreference, setThemePreference] = useState<'system' | 'light' | 'dark'>(
    currentUser?.theme || (darkMode ? 'dark' : 'light')
  );

  // --- 10. Password Change States ---
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  // --- 11. Delete Account Double Confirmation ---
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Feedback banner
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      // Split full name into first and last name
      const parts = (currentUser.fullName || '').trim().split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      setBio(currentUser.bio || '');
      setCity(currentUser.city || '');
      setCountry(currentUser.country || selectedCountry);
      setBirthDate(currentUser.birth_date || '');
      setGender((currentUser.gender as any) || '');
      setPhoneInput(currentUser.phone || '');
      setNewEmail(currentUser.email || '');
      setLanguage(currentUser.language || 'fr');
      setChatsEnabled(currentUser.chats_enabled !== false);
      setThemePreference(currentUser.theme || (darkMode ? 'dark' : 'light'));

      // Fetch private phone from profile_private
      getAccountPhone(currentUser.id).then((p) => {
        if (p) setPhoneInput(p);
      });
    }
  }, [currentUser, selectedCountry]);

  if (!isOpen) return null;

  // --- Handlers ---

  // 1. Save Personal Details (only allowed columns: full_name, bio, city, country, avatar_url, birth_date, gender, phone_visibility, notif_prefs, data_saver, theme, chats_enabled, language)
  const handleSavePersonalDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSavingPersonal(true);
    setMessage(null);

    const full_name = `${firstName.trim()} ${lastName.trim()}`.trim() || currentUser.fullName;

    try {
      await updateProfile(currentUser.id, {
        full_name,
        bio: bio.trim(),
        city: city.trim(),
        country,
        birth_date: birthDate || null,
        gender: gender || null,
      });

      const updated: StoredUser = {
        ...currentUser,
        fullName: full_name,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        bio: bio.trim(),
        city: city.trim(),
        country,
        birth_date: birthDate || null,
        gender: (gender as any) || null,
      };

      onUpdateUser(updated);
      setMessage({ type: 'success', text: 'Détails personnels enregistrés avec succès dans Supabase.' });
      setTimeout(() => setMessage(null), 3500);
    } catch (err: any) {
      console.error('Save personal details error:', err);
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la mise à jour des détails personnels.' });
    } finally {
      setSavingPersonal(false);
    }
  };

  // Avatar upload with WebP compression
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setAvatarUploading(true);
    setMessage(null);
    try {
      const refreshedUrl = await updateProfileAvatar(currentUser.id, file, currentUser.avatarUrl);
      const updated = { ...currentUser, avatarUrl: refreshedUrl, avatar_url: refreshedUrl };
      onUpdateUser(updated);
      setMessage({ type: 'success', text: 'Photo de profil mise à jour avec succès (WebP optimisé).' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      setMessage({ type: 'error', text: err.message || 'Erreur lors du téléversement de la photo.' });
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  // 2. Save Phone to profile_private.phone
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSavingPhone(true);
    setMessage(null);

    const phoneRegex = /^\+?[0-9]{8,15}$/;
    const cleanPhone = phoneInput.trim();
    if (cleanPhone && !phoneRegex.test(cleanPhone)) {
      setMessage({ type: 'error', text: 'Numéro invalide. Utilisez le format international : +2250707070707.' });
      setSavingPhone(false);
      return;
    }

    try {
      await updateAccountPhone(currentUser.id, cleanPhone);
      const updated = { ...currentUser, phone: cleanPhone };
      onUpdateUser(updated);
      setMessage({ type: 'success', text: 'Numéro de téléphone enregistré avec succès dans vos données privées.' });
      setTimeout(() => setMessage(null), 3500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la modification du téléphone.' });
    } finally {
      setSavingPhone(false);
    }
  };

  // 3. Update Email via Supabase Auth
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsUpdatingEmail(true);
    setEmailStatusMsg(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;

      setEmailStatusMsg(`Un email de confirmation a été envoyé à ${newEmail.trim()}. Veuillez cliquer sur le lien reçu pour valider la nouvelle adresse.`);
      setMessage({ type: 'success', text: 'Lien de confirmation envoyé par email.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Impossible de mettre à jour l’adresse email.' });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // 4. Change Language (fr / en)
  const handleSelectLanguage = async (lang: 'fr' | 'en') => {
    setLanguage(lang);
    if (!currentUser) return;
    try {
      await updateProfile(currentUser.id, { language: lang });
      const updated = { ...currentUser, language: lang };
      onUpdateUser(updated);
      setMessage({ type: 'success', text: lang === 'fr' ? 'Langue définie sur Français.' : 'Language set to English.' });
      setTimeout(() => setMessage(null), 2500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // 5. Toggle Chats Enabled
  const handleToggleChats = async () => {
    if (!currentUser) return;
    const newVal = !chatsEnabled;
    setSavingChatsToggle(true);
    try {
      await updateProfile(currentUser.id, { chats_enabled: newVal });
      setChatsEnabled(newVal);
      const updated = { ...currentUser, chats_enabled: newVal };
      onUpdateUser(updated);
      setMessage({
        type: 'success',
        text: newVal ? 'Messages privés activés.' : 'Messages privés désactivés. Les acheteurs verront "Ce vendeur a désactivé les messages".',
      });
      setTimeout(() => setMessage(null), 3500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSavingChatsToggle(false);
    }
  };

  // 6. Test Supabase Connection Speed
  const handleRunConnectionTest = async () => {
    setIsTestingSpeed(true);
    setSpeedResult(null);
    try {
      const res = await testConnectionSpeed();
      setSpeedResult(res);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Impossible de tester la connexion.' });
    } finally {
      setIsTestingSpeed(false);
    }
  };

  // 7. Submit Rate Us (1-5 stars + comment -> support_tickets)
  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setRatingSubmitting(true);
    setMessage(null);

    try {
      await submitSupportTicket({
        user_id: currentUser.id,
        kind: 'suggestion',
        subject: `Évaluation ${ratingStars}/5`,
        message: ratingComment.trim() || `Évaluation utilisateur : ${ratingStars} étoiles sur 5.`,
      });

      setRatingSuccess(true);
      setMessage({ type: 'success', text: 'Merci pour votre note ! Votre avis a été enregistré.' });
      setTimeout(() => {
        setRatingSuccess(false);
        setSection('menu');
      }, 2500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de l’envoi de votre évaluation.' });
    } finally {
      setRatingSubmitting(false);
    }
  };

  // 8. Theme Change (system / light / dark)
  const handleSelectTheme = async (theme: 'system' | 'light' | 'dark') => {
    setThemePreference(theme);
    if (theme === 'dark' && !darkMode) onToggleDarkMode();
    if (theme === 'light' && darkMode) onToggleDarkMode();

    if (currentUser) {
      try {
        await updateProfile(currentUser.id, { theme });
        const updated = { ...currentUser, theme };
        onUpdateUser(updated);
        setMessage({ type: 'success', text: `Thème ${theme} appliqué.` });
        setTimeout(() => setMessage(null), 2500);
      } catch (err: any) {
        console.error('Theme update error:', err);
      }
    }
  };

  // 9. Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Les deux nouveaux mots de passe ne correspondent pas.' });
      return;
    }

    setPasswordUpdating(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setMessage({ type: 'success', text: 'Mot de passe modifié avec succès dans Supabase.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setMessage(null);
        setSection('menu');
      }, 2500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors du changement de mot de passe.' });
    } finally {
      setPasswordUpdating(false);
    }
  };

  // 10. Delete Account (Double confirmation + RPC delete_my_account)
  const handleExecuteDeleteAccount = async () => {
    if (deleteConfirmationText.trim() !== 'SUPPRIMER') {
      setMessage({ type: 'error', text: 'Veuillez saisir exactement le mot SUPPRIMER pour confirmer.' });
      return;
    }

    setIsDeletingAccount(true);
    try {
      await rpcDeleteMyAccount();
      onLogout();
      onClose();
      alert('Votre compte et vos données ont été définitivement supprimés.');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la suppression du compte.' });
      setIsDeletingAccount(false);
    }
  };

  const citiesList = CITIES_BY_COUNTRY[country] || ['Abidjan', 'Bouaké', 'Dakar', 'Lagos'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-[#141418] border border-zinc-800 shadow-2xl text-white max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-[#16161D]">
          <div className="flex items-center gap-2.5">
            {section !== 'menu' && (
              <button
                type="button"
                onClick={() => setSection('menu')}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 cursor-pointer transition-colors"
                title="Retour aux paramètres"
              >
                ←
              </button>
            )}
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#D4AF37]/40 bg-black flex items-center justify-center">
              <img src={officialLogoImg} alt="Afrique Business" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                {section === 'menu' && 'Paramètres'}
                {section === 'personal_details' && 'Détails Personnels'}
                {section === 'phone_number' && 'Numéro de Téléphone'}
                {section === 'change_email' && 'Modifier l’Email'}
                {section === 'language' && 'Langue'}
                {section === 'notifications' && 'Notifications'}
                {section === 'connection_test' && 'Vérifier la Connexion'}
                {section === 'rate_us' && 'Évaluez-nous'}
                {section === 'about' && 'À propos d’Afrique Business'}
                {section === 'theme' && 'Mode Sombre & Thème'}
                {section === 'change_password' && 'Changer le Mot de Passe'}
                {section === 'delete_account' && 'Supprimer mon Compte'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-white bg-zinc-800/80 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback message banner */}
        {message && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-amber-950/70 text-[#D4AF37] border-b border-[#D4AF37]/40'
                : 'bg-red-950/70 text-red-200 border-b border-red-800'
            }`}
          >
            {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* ========================================================
              SECTION: MAIN MENU
             ======================================================== */}
          {section === 'menu' && (
            <div className="space-y-4">
              {/* Account Quick Card */}
              {currentUser ? (
                <div className="p-3.5 rounded-2xl bg-[#1A1A22] border border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {currentUser.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover border border-[#D4AF37]/50 bg-zinc-900"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-linear-to-tr from-[#D4AF37] to-[#F59E0B] text-black font-extrabold flex items-center justify-center text-sm shadow-md">
                        {currentUser.fullName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{currentUser.fullName}</span>
                        {currentUser.phone_verified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                        )}
                      </h4>
                      <p className="text-[11px] text-gray-400">{currentUser.phone || currentUser.email}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSection('personal_details')}
                    className="px-3 py-1.5 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-xs font-bold text-[#D4AF37] border border-[#D4AF37]/40 cursor-pointer min-h-[44px]"
                  >
                    Détails
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[#1A1A22] border border-zinc-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Vous n'êtes pas connecté</h4>
                    <p className="text-[11px] text-gray-400">Connectez-vous pour gérer votre compte</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuth();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-extrabold cursor-pointer shadow-md min-h-[44px]"
                  >
                    Se connecter
                  </button>
                </div>
              )}

              {/* Navigation List with Colorful Icons */}
              <div className="divide-y divide-zinc-800/80 rounded-2xl bg-[#181820] border border-zinc-800 overflow-hidden text-xs">
                
                {/* 1. Détails Personnels */}
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => setSection('personal_details')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left min-h-[48px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-[#D4AF37] flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-white block">Détails Personnels</span>
                        <span className="text-[10px] text-gray-400">Photo, nom, prénom, ville, date de naissance, sexe</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                )}

                {/* 2. Numéro de téléphone */}
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => setSection('phone_number')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left min-h-[48px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-white block">Numéro de Téléphone</span>
                        <span className="text-[10px] text-gray-400">
                          {currentUser.phone ? currentUser.phone : 'Ajouter un numéro'} (profile_private.phone)
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                )}

                {/* 3. Modifier l'email */}
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => setSection('change_email')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left min-h-[48px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-white block">Modifier l'Email</span>
                        <span className="text-[10px] text-gray-400">Via Supabase Auth avec confirmation par email</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                )}

                {/* 4. Changer de langue */}
                <button
                  type="button"
                  onClick={() => setSection('language')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">Changer de Langue</span>
                      <span className="text-[10px] text-gray-400">
                        {language === 'fr' ? 'Français (FR)' : 'English (EN)'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                {/* 5. Désactiver les chats */}
                {currentUser && (
                  <div className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors min-h-[48px]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-white block">Messagerie privée</span>
                        <span className="text-[10px] text-gray-400">
                          {chatsEnabled ? 'Activé (les acheteurs peuvent vous écrire)' : 'Désactivé ("Ce vendeur a désactivé les messages")'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={savingChatsToggle}
                      onClick={handleToggleChats}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer min-h-[36px] ${
                        chatsEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-zinc-800 text-gray-400 border border-zinc-700'
                      }`}
                    >
                      {chatsEnabled ? 'Activé' : 'Désactivé'}
                    </button>
                  </div>
                )}

                {/* 6. Gérer les notifications */}
                <button
                  type="button"
                  onClick={() => setSection('notifications')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/15 text-yellow-400 flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">Gérer les Notifications</span>
                      <span className="text-[10px] text-gray-400">Alertes messages, SMS et emails (notif_prefs)</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                {/* 7. Vérifier la connexion */}
                <button
                  type="button"
                  onClick={() => {
                    setSection('connection_test');
                    handleRunConnectionTest();
                  }}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">Vérifier la Connexion</span>
                      <span className="text-[10px] text-gray-400">Mesure réelle du temps de réponse vers Supabase</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                {/* 8. Évaluez-nous */}
                <button
                  type="button"
                  onClick={() => setSection('rate_us')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-[#D4AF37] flex items-center justify-center">
                      <Star className="w-4 h-4 fill-[#D4AF37]" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">Évaluez-nous</span>
                      <span className="text-[10px] text-gray-400">Note de 1 à 5 étoiles et retour utilisateur</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                {/* 9. Mode sombre */}
                <button
                  type="button"
                  onClick={() => setSection('theme')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-500/15 text-slate-300 flex items-center justify-center">
                      <Moon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">Mode Sombre</span>
                      <span className="text-[10px] text-gray-400">
                        {themePreference === 'system' ? 'Système' : themePreference === 'dark' ? 'Sombre' : 'Clair'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                {/* 10. À propos d'Afrique Business */}
                <button
                  type="button"
                  onClick={() => setSection('about')}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                      <Info className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">À propos d'Afrique Business</span>
                      <span className="text-[10px] text-gray-400">Version 2.4.0, CGU, confidentialité, règles</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                {/* Espace Admin • Import Facebook (Réservé à l'administrateur) */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdminFacebook?.();
                  }}
                  className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left min-h-[48px] bg-linear-to-r from-[#1877F2]/10 via-[#181820] to-transparent border-t border-b border-[#1877F2]/25"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1877F2]/20 text-[#1877F2] flex items-center justify-center font-bold shrink-0">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white block">Espace Admin • Import Facebook</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30">Admin</span>
                      </div>
                      <span className="text-[10px] text-gray-400">Synchronisation Graph API v26, logs & Gemini IA</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>

                {/* 11. Changer le mot de passe */}
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => setSection('change_password')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left min-h-[48px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center">
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-white block">Changer le Mot de Passe</span>
                        <span className="text-[10px] text-gray-400">Ancien + nouveau mot de passe</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                )}

                {/* 12. Supprimer définitivement mon compte */}
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => setSection('delete_account')}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-red-950/20 transition-colors cursor-pointer text-left min-h-[48px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-red-400 block">Supprimer définitivement mon compte</span>
                        <span className="text-[10px] text-gray-400">Action irréversible avec double confirmation</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                )}

                {/* 13. Se déconnecter */}
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer text-left text-gray-400 hover:text-white min-h-[48px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 text-gray-300 flex items-center justify-center">
                        <LogOut className="w-4 h-4" />
                      </div>
                      <span className="font-bold">Se déconnecter</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              SECTION: DÉTAILS PERSONNELS (Prompt #3)
             ======================================================== */}
          {section === 'personal_details' && currentUser && (
            <form onSubmit={handleSavePersonalDetails} className="space-y-4">
              {/* Avatar Upload (Bucket 'avatars', WebP) */}
              <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 text-center">
                <div className="relative w-24 h-24 mx-auto mb-3">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-full h-full rounded-full object-cover border-2 border-[#D4AF37] bg-black shadow-lg"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-linear-to-tr from-[#D4AF37] to-[#F59E0B] text-black font-black text-2xl flex items-center justify-center border-2 border-[#D4AF37]">
                      {currentUser.fullName.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <label className="absolute bottom-0 right-0 p-2 rounded-full bg-[#D4AF37] text-black cursor-pointer hover:bg-amber-400 shadow-md min-h-[36px] min-w-[36px] flex items-center justify-center">
                    <Camera className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      disabled={avatarUploading}
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <p className="text-xs font-bold text-white">
                  {avatarUploading ? 'Compression WebP et téléversement...' : 'Modifier la photo de profil'}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Enregistré dans le bucket Supabase "avatars" au format WebP optimisé.
                </p>
              </div>

              {/* Name Fields: Prénom & Nom */}
              <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">Prénom *</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ex: Amadou"
                      required
                      className="w-full px-3 py-2.5 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
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
                      className="w-full px-3 py-2.5 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Emplacement: Sélecteur Ville */}
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Emplacement (Ville) *
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                  >
                    <option value="">Sélectionner une ville...</option>
                    {citiesList.map((c) => (
                      <option key={c} value={c}>
                        {c} ({AFRICAN_COUNTRIES[country]?.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date de naissance (profiles.birth_date) */}
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Date de naissance (profiles.birth_date)
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                  />
                </div>

                {/* Sexe (profiles.gender: masculin ou feminin, facultatif) */}
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Sexe (facultatif)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGender('masculin')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer min-h-[44px] ${
                        gender === 'masculin'
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                          : 'bg-[#121216] text-gray-300 border-zinc-700 hover:text-white'
                      }`}
                    >
                      Masculin
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('feminin')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer min-h-[44px] ${
                        gender === 'feminin'
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                          : 'bg-[#121216] text-gray-300 border-zinc-700 hover:text-white'
                      }`}
                    >
                      Féminin
                    </button>
                  </div>
                </div>

                {/* Bio courte */}
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Bio / Présentation</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Présentez brièvement vos activités ou votre boutique..."
                    className="w-full px-3 py-2.5 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              {/* Bouton Enregistrer */}
              <button
                type="submit"
                disabled={savingPersonal}
                className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-[#D4AF37] via-[#F59E0B] to-[#C5A059] text-black text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 min-h-[48px]"
              >
                <Check className="w-5 h-5 stroke-[2.5]" />
                <span>{savingPersonal ? 'Enregistrement dans Supabase...' : 'Enregistrer les détails personnels'}</span>
              </button>
            </form>
          )}

          {/* ========================================================
              SECTION: NUMÉRO DE TÉLÉPHONE (profile_private.phone)
             ======================================================== */}
          {section === 'phone_number' && (
            <form onSubmit={handleSavePhone} className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 space-y-3">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Votre numéro de téléphone est stocké de manière sécurisée dans la table privée <code className="text-[#D4AF37]">profile_private.phone</code> et sert à vous contacter pour vos annonces.
                </p>
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Numéro de téléphone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+2250707070707"
                      required
                      className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white font-mono focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 block">Exemple avec indicatif pays : +225, +221, +237...</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPhone}
                className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[48px]"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{savingPhone ? 'Enregistrement...' : 'Enregistrer le numéro'}</span>
              </button>
            </form>
          )}

          {/* ========================================================
              SECTION: MODIFIER L'EMAIL (Supabase Auth)
             ======================================================== */}
          {section === 'change_email' && (
            <form onSubmit={handleUpdateEmail} className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 space-y-3">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Modifiez l'adresse email associée à votre compte. Un lien de confirmation sera envoyé par Supabase Auth pour valider le changement.
                </p>
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Nouvelle adresse email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-blue-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="nouvelle-adresse@domaine.com"
                      required
                      className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                    />
                  </div>
                </div>

                {emailStatusMsg && (
                  <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-800 text-xs text-blue-200">
                    {emailStatusMsg}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isUpdatingEmail}
                className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[48px]"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{isUpdatingEmail ? 'Envoi du lien...' : 'Confirmer le nouvel email'}</span>
              </button>
            </form>
          )}

          {/* ========================================================
              SECTION: LANGUE (fr / en)
             ======================================================== */}
          {section === 'language' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 space-y-2">
                <button
                  type="button"
                  onClick={() => handleSelectLanguage('fr')}
                  className={`w-full p-3.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer min-h-[48px] ${
                    language === 'fr'
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white font-bold'
                      : 'bg-[#121216] border-zinc-700 text-gray-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🇫🇷</span>
                    <span>Français (Afrique francophone)</span>
                  </div>
                  {language === 'fr' && <Check className="w-4 h-4 text-[#D4AF37]" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectLanguage('en')}
                  className={`w-full p-3.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer min-h-[48px] ${
                    language === 'en'
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white font-bold'
                      : 'bg-[#121216] border-zinc-700 text-gray-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🇬🇧</span>
                    <span>English (Pan-African English)</span>
                  </div>
                  {language === 'en' && <Check className="w-4 h-4 text-[#D4AF37]" />}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              SECTION: NOTIFICATIONS (notif_prefs)
             ======================================================== */}
          {section === 'notifications' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-xs font-bold text-white block">Messages privés</span>
                    <span className="text-[10px] text-gray-400">Alerte lorsqu'un acheteur vous écrit</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifMessages}
                    onChange={(e) => setNotifMessages(e.target.checked)}
                    className="accent-[#D4AF37] w-5 h-5 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-t border-zinc-800">
                  <div>
                    <span className="text-xs font-bold text-white block">Offres et opportunités</span>
                    <span className="text-[10px] text-gray-400">Offres de prix et promotions dans votre pays</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifOffers}
                    onChange={(e) => setNotifOffers(e.target.checked)}
                    className="accent-[#D4AF37] w-5 h-5 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-t border-zinc-800">
                  <div>
                    <span className="text-xs font-bold text-white block">Alertes SMS de sécurité</span>
                    <span className="text-[10px] text-gray-400">Connexion suspecte ou réinitialisation</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSms}
                    onChange={(e) => setNotifSms(e.target.checked)}
                    className="accent-[#D4AF37] w-5 h-5 cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!currentUser) return;
                  await updateProfile(currentUser.id, {
                    notif_prefs: { messages: notifMessages, new_listings: notifOffers, comments: notifSms },
                  });
                  setMessage({ type: 'success', text: 'Préférences de notifications enregistrées dans Supabase.' });
                  setTimeout(() => setMessage(null), 2500);
                }}
                className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-bold cursor-pointer min-h-[48px]"
              >
                Enregistrer les préférences
              </button>
            </div>
          )}

          {/* ========================================================
              SECTION: VÉRIFIER LA CONNEXION (Prompt #4)
             ======================================================== */}
          {section === 'connection_test' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-teal-500/15 text-teal-400 flex items-center justify-center mx-auto">
                  <Activity className={`w-6 h-6 ${isTestingSpeed ? 'animate-pulse' : ''}`} />
                </div>
                <h4 className="text-sm font-bold text-white">Diagnostic Réseau Supabase</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Ce test effectue un appel direct et mesure en millisecondes le temps d’accès à la base de données Supabase.
                </p>

                {isTestingSpeed ? (
                  <div className="py-6 space-y-2">
                    <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
                    <span className="text-xs text-gray-300">Mesure de la latence en cours...</span>
                  </div>
                ) : speedResult ? (
                  <div className="p-4 rounded-xl bg-[#121216] border border-zinc-700 space-y-3 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Temps de réponse :</span>
                      <span className="text-base font-black text-[#D4AF37] font-mono tabular-nums">
                        {speedResult.latencyMs} ms
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Qualité de connexion :</span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                          speedResult.status === 'bonne'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : speedResult.status === 'moyenne'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-red-500/20 text-red-400 border border-red-500/40'
                        }`}
                      >
                        Connexion {speedResult.status}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-zinc-800 text-xs text-gray-300 leading-relaxed">
                      💡 <strong>Conseil :</strong> {speedResult.advice}
                    </div>

                    {speedResult.status !== 'bonne' && !dataSaver && (
                      <button
                        type="button"
                        onClick={() => {
                          onToggleDataSaver();
                          setMessage({ type: 'success', text: 'Mode économie de données activé.' });
                        }}
                        className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-[#D4AF37] font-bold text-xs border border-[#D4AF37]/40 transition-colors cursor-pointer min-h-[44px]"
                      >
                        Activer le mode économie de données
                      </button>
                    )}
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={isTestingSpeed}
                  onClick={handleRunConnectionTest}
                  className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold cursor-pointer transition-colors min-h-[44px]"
                >
                  Relancer le test de connexion
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              SECTION: ÉVALUEZ-NOUS (Prompt #4 -> support_tickets)
             ======================================================== */}
          {section === 'rate_us' && (
            <form onSubmit={handleSubmitRating} className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 space-y-4 text-center">
                <div>
                  <h4 className="text-sm font-bold text-white">Votre avis compte pour Afrique Business</h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Sélectionnez une note de 1 à 5 étoiles et partagez vos suggestions d’amélioration.
                  </p>
                </div>

                {/* 1 to 5 Stars selector */}
                <div className="flex items-center justify-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingStars(star)}
                      className="p-1 cursor-pointer transition-transform hover:scale-110 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title={`${star} étoile(s)`}
                    >
                      <Star
                        className={`w-8 h-8 ${
                          star <= ratingStars
                            ? 'text-[#D4AF37] fill-[#D4AF37]'
                            : 'text-zinc-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div className="text-xs font-extrabold text-[#D4AF37]">
                  {ratingStars === 5 && 'Exceptionnel !'}
                  {ratingStars === 4 && 'Très bien !'}
                  {ratingStars === 3 && 'Moyen, peut mieux faire.'}
                  {ratingStars === 2 && 'Décevant.'}
                  {ratingStars === 1 && 'Très insatisfait.'}
                </div>

                <div className="text-left">
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Commentaire ou suggestion
                  </label>
                  <textarea
                    rows={4}
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Qu'avez-vous particulièrement apprécié ou que devrions-nous améliorer ?"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={ratingSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[48px]"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{ratingSubmitting ? 'Enregistrement dans support_tickets...' : 'Envoyer mon évaluation'}</span>
              </button>
            </form>
          )}

          {/* ========================================================
              SECTION: MODE SOMBRE & THÈME
             ======================================================== */}
          {section === 'theme' && (
            <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 space-y-2">
              {(['system', 'dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleSelectTheme(t)}
                  className={`w-full p-3.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer min-h-[48px] ${
                    themePreference === t
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white font-bold'
                      : 'bg-[#121216] border-zinc-700 text-gray-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {t === 'dark' && <Moon className="w-4 h-4 text-slate-300" />}
                    {t === 'light' && <Sun className="w-4 h-4 text-amber-400" />}
                    {t === 'system' && <Zap className="w-4 h-4 text-[#D4AF37]" />}
                    <span className="capitalize">
                      {t === 'system' ? 'Système (automatique)' : t === 'dark' ? 'Sombre' : 'Clair'}
                    </span>
                  </div>
                  {themePreference === t && <Check className="w-4 h-4 text-[#D4AF37]" />}
                </button>
              ))}
            </div>
          )}

          {/* ========================================================
              SECTION: À PROPOS (Prompt #4)
             ======================================================== */}
          {section === 'about' && (
            <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 space-y-4 text-xs leading-relaxed text-gray-300">
              <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-black border border-[#D4AF37]/40 flex items-center justify-center shrink-0">
                  <img src={officialLogoImg} alt="Afrique Business" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">Afrique Business</h4>
                  <span className="text-[11px] text-[#D4AF37] font-semibold">Version 2.4.0 (PWA Production)</span>
                </div>
              </div>

              {/* Install PWA Button */}
              <div className="p-3 rounded-xl bg-black/40 border border-[#D4AF37]/30 space-y-2">
                <p className="text-[11px] text-gray-300 font-medium">
                  Installez l'application sur votre écran d'accueil pour profiter d'un accès rapide 1-clic et du mode hors-ligne.
                </p>
                <PWAInstallButton variant="button" />
              </div>

              <div>
                <h5 className="font-bold text-white mb-1">Notre Mission</h5>
                <p>
                  Connecter les entrepreneurs, commerçants, artisans et acheteurs à travers toute l'Afrique grâce à une place de marché fluide, vérifiée et adaptée aux réalités locales (connexions 3G/4G, Mobile Money, contact direct WhatsApp et appel téléphonique).
                </p>
              </div>

              <div>
                <h5 className="font-bold text-white mb-1">Conditions Générales d'Utilisation</h5>
                <p>
                  Toute annonce publiée doit correspondre à un produit ou service réel, disponible et légal dans le pays de diffusion. Les arnaques, faux profils et contenus prohibés sont immédiatement supprimés.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-white mb-1">Politique de Confidentialité</h5>
                <p>
                  Vos coordonnées privées (téléphone, email, date de naissance) ne sont jamais revendues. Elles restent protégées par les politiques RLS strictes de Supabase.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-white mb-1">Règles de la Communauté</h5>
                <p>
                  Respect mutuel, transparence sur les prix affichés en monnaie locale et honnêteté lors des remises en main propre.
                </p>
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <h5 className="font-bold text-white mb-1">Contact & Support</h5>
                <p>Email officiel : <span className="text-[#D4AF37]">support@afrique-business.app</span></p>
                <p>WhatsApp assistance : <span className="text-emerald-400">+225 07 00 00 00 00</span></p>
              </div>
            </div>
          )}

          {/* ========================================================
              SECTION: CHANGER LE MOT DE PASSE (Prompt #4)
             ======================================================== */}
          {section === 'change_password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Ancien mot de passe</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Nouveau mot de passe (min 6 caractères)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">Confirmer le nouveau mot de passe</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordUpdating}
                className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[48px]"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{passwordUpdating ? 'Mise à jour dans Supabase...' : 'Mettre à jour le mot de passe'}</span>
              </button>
            </form>
          )}

          {/* ========================================================
              SECTION: SUPPRIMER DÉFINITIVEMENT MON COMPTE (Prompt #4)
             ======================================================== */}
          {section === 'delete_account' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-red-950/30 border border-red-800 space-y-3">
                <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>Avertissement irréversible</span>
                </div>
                <p className="text-xs text-red-200 leading-relaxed">
                  La suppression de votre compte effacera définitivement toutes vos annonces en ligne, vos messages, vos avis et vos coordonnées de la base de données.
                </p>
                <div className="pt-2">
                  <label className="text-xs font-bold text-white block mb-1">
                    Écrivez <strong className="text-red-400">SUPPRIMER</strong> ci-dessous pour confirmer :
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    placeholder="SUPPRIMER"
                    className="w-full px-3 py-2.5 rounded-xl bg-black border border-red-800 text-sm text-red-200 font-mono tracking-widest focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={deleteConfirmationText.trim() !== 'SUPPRIMER' || isDeletingAccount}
                onClick={handleExecuteDeleteAccount}
                className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed min-h-[48px]"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingAccount ? 'Suppression en cours...' : 'Confirmer la suppression définitive'}</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
