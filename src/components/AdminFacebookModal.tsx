import React, { useState, useEffect } from 'react';
import { 
  X, RefreshCw, CheckCircle, AlertTriangle, ShieldCheck, 
  ExternalLink, Key, Eye, EyeOff, Clock, Server, Check, 
  HelpCircle, Sparkles, MessageSquare, Package, AlertCircle
} from 'lucide-react';
import { StoredUser } from '../types';
import { supabase } from '../lib/supabase';

interface AdminFacebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: StoredUser | null;
  onRefreshData?: () => void;
}

interface FacebookStatusResponse {
  success: boolean;
  configured: boolean;
  pageId: string;
  fullPageId: string;
  hasToken: boolean;
  pageName: string;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  stats: {
    totalImported: number;
    listingsCount: number;
    postsCount: number;
    draftsCount: number;
  };
  recentLogs: Array<{
    id: string;
    timestamp: string;
    trigger: string;
    status: 'success' | 'warning' | 'error';
    importedCount: number;
    importedListings: number;
    importedPosts: number;
    ignoredCount: number;
    draftCount: number;
    errorMessage?: string | null;
    details: string;
  }>;
  unreadNotifsCount: number;
}

export const AdminFacebookModal: React.FC<AdminFacebookModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onRefreshData,
}) => {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusData, setStatusData] = useState<FacebookStatusResponse | null>(null);

  // Form states
  const [pageIdInput, setPageIdInput] = useState('');
  const [pageTokenInput, setPageTokenInput] = useState('');
  const [pageNameInput, setPageNameInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    imported?: number;
    importedListings?: number;
    importedPosts?: number;
    ignored?: number;
    drafts?: number;
    errors?: number;
    hasMore?: boolean;
    error?: string;
  } | null>(null);

  // Logs & Imported items
  const [activeTab, setActiveTab] = useState<'sync' | 'config' | 'logs' | 'items'>('sync');
  const [logs, setLogs] = useState<any[]>([]);
  const [importedItems, setImportedItems] = useState<any[]>([]);

  // Headers for admin calls
  const getAdminHeaders = async () => {
    let bearerToken = '';
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        bearerToken = `Bearer ${data.session.access_token}`;
      }
    } catch {
      // ignore
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-admin-id': currentUser?.id || 'd2882463-6bcf-414a-8844-6c06279e50e0',
      'x-admin-email': currentUser?.email || 'marcarnaudkonan2@gmail.com',
      'x-admin-phone': currentUser?.phone || '+2250565242349',
    };
    if (bearerToken) {
      headers['Authorization'] = bearerToken;
    }
    return headers;
  };

  const loadStatus = async () => {
    try {
      setLoadingStatus(true);
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/facebook-status', {
        headers,
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        console.warn('Réponse non-JSON reçue pour facebook-status:', text.slice(0, 100));
        return;
      }

      if (data?.success) {
        setStatusData(data);
        setPageIdInput(data.fullPageId || '');
        setPageNameInput(data.pageName || '');
      }
    } catch (err) {
      console.error('Error loading facebook status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadLogsAndItems = async () => {
    try {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/facebook-logs', {
        headers,
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        console.warn('Réponse non-JSON reçue pour facebook-logs:', text.slice(0, 100));
        return;
      }

      if (data?.success) {
        setLogs(data.logs || []);
        setImportedItems(data.items || []);
      }
    } catch (err) {
      console.error('Error loading facebook logs:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      loadLogsAndItems();
      setSyncResult(null);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handlers
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setTestResult(null);

    try {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/facebook-config', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pageId: pageIdInput.trim(),
          pageToken: pageTokenInput.trim() || undefined,
          pageName: pageNameInput.trim(),
        }),
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        setTestResult({ success: false, message: 'Le serveur a mis trop de temps, réessaie.' });
        return;
      }

      if (data?.success) {
        setPageTokenInput('');
        loadStatus();
        setTestResult({ success: true, message: 'Configuration enregistrée sur le serveur avec succès.' });
      } else {
        setTestResult({ success: false, message: data.message || 'Erreur lors de l’enregistrement.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Le serveur a mis trop de temps, réessaie.' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/facebook-test', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pageId: pageIdInput.trim() || undefined,
          pageToken: pageTokenInput.trim() || undefined,
        }),
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        setTestResult({ success: false, message: 'Le serveur a mis trop de temps, réessaie.' });
        return;
      }

      if (data?.success) {
        setTestResult({
          success: true,
          message: `Connexion réussie ! Page validée : "${data.pageName}" (ID : ${data.pageId}).`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Erreur de validation du jeton Graph API.',
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: 'Le serveur a mis trop de temps, réessaie.' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const headers = await getAdminHeaders();
      const res = await fetch('/api/admin/facebook-sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pageId: pageIdInput.trim() || undefined,
          pageToken: pageTokenInput.trim() || undefined,
        }),
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        // Handle upstream request timeout or HTML gateway errors (Point 4)
        setSyncResult({
          success: false,
          error: 'Le serveur a mis trop de temps, réessaie.',
        });
        return;
      }

      if (data?.success) {
        setSyncResult({
          success: true,
          imported: data.imported,
          importedListings: data.importedListings,
          importedPosts: data.importedPosts,
          ignored: data.ignored,
          drafts: data.drafts,
          errors: data.errors || 0,
          hasMore: Boolean(data.hasMore),
        });
        loadStatus();
        loadLogsAndItems();
        onRefreshData?.();
      } else {
        setSyncResult({
          success: false,
          error: data.error || 'Erreur lors de la synchronisation.',
          errors: data.errors || 0,
        });
        loadStatus();
        loadLogsAndItems();
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        error: 'Le serveur a mis trop de temps, réessaie.',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-slide-up">
      <div className="relative w-full max-w-2xl bg-[#121217] border border-[#D4AF37]/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-linear-to-r from-[#181820] to-[#121217] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1877F2]/15 border border-[#1877F2]/40 text-[#1877F2] flex items-center justify-center shrink-0 shadow-md">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white">Import Facebook Automatique</h3>
                <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-bold border border-[#D4AF37]/30">
                  Espace Admin
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Synchronisation Graph API v26.0 & analyse intelligente par Gemini AI
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-gray-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 bg-[#0E0E12] px-4 pt-2 gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sync'
                ? 'bg-[#181820] text-[#D4AF37] border-t-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Synchronisation</span>
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'bg-[#181820] text-[#D4AF37] border-t-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Jeton & Configuration</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-[#181820] text-[#D4AF37] border-t-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Journal des imports</span>
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'items'
                ? 'bg-[#181820] text-[#D4AF37] border-t-2 border-[#D4AF37]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Articles importés</span>
            {statusData?.stats?.totalImported ? (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] text-zinc-300">
                {statusData.stats.totalImported}
              </span>
            ) : null}
          </button>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs text-gray-300">
          {/* TAB 1: SYNCHRONIZATION */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">Page Facebook :</span>
                    <span className="text-[#D4AF37] font-extrabold">{statusData?.pageName || 'Non configurée'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-[11px]">
                    <span className={`w-2 h-2 rounded-full ${statusData?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    <span>{statusData?.configured ? 'Jeton d’accès Page actif' : 'Jeton manquant ou incomplet'}</span>
                    <span>•</span>
                    <span>ID : {statusData?.pageId || 'Non défini'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-zinc-800 text-[11px] text-gray-300">
                  <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Auto-sync : Toutes les heures</span>
                </div>
              </div>

              {/* Sync Trigger Action */}
              <div className="p-5 rounded-2xl bg-linear-to-b from-[#1C1C24] to-[#141418] border border-[#D4AF37]/35 text-center space-y-3 shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-[#D4AF37]/20 to-[#F59E0B]/20 border border-[#D4AF37]/50 text-[#D4AF37] flex items-center justify-center mx-auto">
                  <RefreshCw className={`w-6 h-6 ${syncing ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">Importer les dernières publications</h4>
                  <p className="text-[11px] text-gray-400 max-w-md mx-auto mt-0.5">
                    L'IA Gemini analyse le texte de vos posts récents sur Facebook, détecte les annonces commerciales, extrait le prix en FCFA, la ville et le téléphone, et crée les annonces actives ou brouillons.
                  </p>
                </div>

                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] hover:brightness-110 text-black font-black text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 min-h-[46px]"
                >
                  <RefreshCw className={`w-4 h-4 stroke-[3] ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Synchronisation en cours...' : 'Synchroniser maintenant'}</span>
                </button>
              </div>

              {/* Sync Result Banner */}
              {syncResult && (
                <div
                  className={`p-4 rounded-2xl border animate-fade-slide-up space-y-2 ${
                    syncResult.success
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                      : 'bg-red-950/30 border-red-500/40 text-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {syncResult.success ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span>Synchronisation terminée avec succès !</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                        <span>Échec de la synchronisation</span>
                      </>
                    )}
                  </div>

                  {syncResult.success ? (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/25">
                          <span className="text-base font-black text-emerald-400 block">{syncResult.imported || 0}</span>
                          <span className="text-[10px] text-gray-400">Importées</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/40 border border-amber-500/25">
                          <span className="text-base font-black text-amber-300 block">{syncResult.drafts || 0}</span>
                          <span className="text-[10px] text-gray-400">En brouillon</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-700/40">
                          <span className="text-base font-black text-gray-300 block">{syncResult.ignored || 0}</span>
                          <span className="text-[10px] text-gray-400">Ignorées (déjà là)</span>
                        </div>
                        <div className={`p-2.5 rounded-xl bg-black/40 border ${syncResult.errors ? 'border-red-500/40' : 'border-zinc-700/40'}`}>
                          <span className={`text-base font-black block ${syncResult.errors ? 'text-red-400' : 'text-gray-400'}`}>{syncResult.errors || 0}</span>
                          <span className="text-[10px] text-gray-400">En erreur</span>
                        </div>
                      </div>

                      {syncResult.hasMore && (
                        <div className="p-2.5 rounded-xl bg-linear-to-r from-amber-500/10 to-amber-600/5 border border-[#D4AF37]/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#D4AF37]">
                          <span>D’autres publications restent à importer (curseur mémorisé).</span>
                          <button
                            onClick={handleSyncNow}
                            disabled={syncing}
                            className="px-3 py-1.5 rounded-lg bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black font-extrabold text-[11px] cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                          >
                            Importer le lot suivant (5 max) →
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed">{syncResult.error}</p>
                  )}
                </div>
              )}

              {/* Quick Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-3 rounded-xl bg-[#181820] border border-zinc-800 text-center">
                  <span className="text-lg font-black text-[#D4AF37] block">{statusData?.stats?.totalImported || 0}</span>
                  <span className="text-[11px] text-gray-400">Total importés</span>
                </div>
                <div className="p-3 rounded-xl bg-[#181820] border border-zinc-800 text-center">
                  <span className="text-lg font-black text-white block">{statusData?.stats?.listingsCount || 0}</span>
                  <span className="text-[11px] text-gray-400">Annonces actives</span>
                </div>
                <div className="p-3 rounded-xl bg-[#181820] border border-zinc-800 text-center">
                  <span className="text-lg font-black text-amber-400 block">{statusData?.stats?.draftsCount || 0}</span>
                  <span className="text-[11px] text-gray-400">Brouillons en attente</span>
                </div>
                <div className="p-3 rounded-xl bg-[#181820] border border-zinc-800 text-center">
                  <span className="text-lg font-black text-sky-400 block">{statusData?.stats?.postsCount || 0}</span>
                  <span className="text-[11px] text-gray-400">Publications sociales</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIGURATION */}
          {activeTab === 'config' && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#181820] border border-zinc-800 space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-200 block mb-1">
                    Nom de votre Page Facebook
                  </label>
                  <input
                    type="text"
                    value={pageNameInput}
                    onChange={(e) => setPageNameInput(e.target.value)}
                    placeholder="Ex: Afrique Business Officiel"
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Ce nom sera affiché sous la mention « Publié par [Nom de page] » sur toutes vos annonces importées.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-200 block mb-1">
                    Identifiant de la Page (FACEBOOK_PAGE_ID)
                  </label>
                  <input
                    type="text"
                    value={pageIdInput}
                    onChange={(e) => setPageIdInput(e.target.value)}
                    placeholder="Ex: 104829104829012"
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white font-mono focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Trouvez cet ID dans la section "À propos" de votre page Facebook ou dans l'URL de gestion Meta Business Suite.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-200">
                      Jeton d'accès de Page (FACEBOOK_PAGE_TOKEN)
                    </label>
                    <span className={`text-[10px] font-bold ${statusData?.hasToken ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {statusData?.hasToken ? 'Jeton actuellement configuré' : 'Aucun jeton configuré'}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={pageTokenInput}
                      onChange={(e) => setPageTokenInput(e.target.value)}
                      placeholder={statusData?.hasToken ? '••••••••••••••••••••••••••••••••••••••••' : 'Collez votre jeton d’accès Page (EAA...)'}
                      className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-[#121216] border border-zinc-700 text-sm text-white font-mono focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Ce jeton reste strictement côté serveur (jamais transmis au navigateur). Si vous ne souhaitez pas modifier le jeton existant, laissez ce champ vide.
                  </p>
                </div>
              </div>

              {/* Feedback messages */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-950/30 border-red-500/40 text-red-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 min-h-[44px]"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{savingConfig ? 'Enregistrement...' : 'Enregistrer la configuration'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-zinc-700 disabled:opacity-50 min-h-[44px]"
                >
                  <Server className="w-4 h-4 text-[#D4AF37]" />
                  <span>{testingConnection ? 'Test en cours...' : 'Tester la connexion API'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h4 className="font-extrabold text-white text-xs">Historique des synchronisations & erreurs</h4>
                <button
                  onClick={loadLogsAndItems}
                  className="text-[11px] text-[#D4AF37] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Rafraîchir</span>
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#181820] border border-zinc-800 text-center space-y-1">
                  <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-gray-400">Aucun historique de synchronisation enregistré pour l'instant.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3.5 rounded-xl border space-y-1.5 ${
                        log.status === 'success'
                          ? 'bg-[#141814] border-emerald-900/40 text-gray-300'
                          : log.status === 'warning'
                          ? 'bg-[#181610] border-amber-900/40 text-gray-300'
                          : 'bg-[#181212] border-red-900/40 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              log.status === 'success'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : log.status === 'warning'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {log.status === 'success' ? 'Succès' : log.status === 'warning' ? 'Avertissement' : 'Erreur'}
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono">
                            {new Date(log.timestamp).toLocaleString('fr-FR')}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 capitalize">
                          {log.trigger === 'manual' ? 'Déclenchement Manuel' : 'Tâche horaire planifiée'}
                        </span>
                      </div>

                      {log.errorMessage ? (
                        <p className="text-xs font-bold text-red-400 leading-relaxed">
                          {log.errorMessage}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-200">
                          {log.details}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[10px] text-gray-400 pt-1 border-t border-zinc-800/60">
                        <span>Annonces créées : <strong className="text-white">{log.importedListings || 0}</strong></span>
                        <span>Brouillons : <strong className="text-amber-300">{log.draftCount || 0}</strong></span>
                        <span>Ignorés : <strong className="text-gray-300">{log.ignoredCount || 0}</strong></span>
                        <span>En erreur : <strong className={log.errorCount ? 'text-red-400' : 'text-gray-300'}>{log.errorCount || 0}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: IMPORTED ITEMS */}
          {activeTab === 'items' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h4 className="font-extrabold text-white text-xs">Dernières publications Facebook traitées</h4>
                <span className="text-[11px] text-gray-400">{importedItems.length} publications enregistrées</span>
              </div>

              {importedItems.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#181820] border border-zinc-800 text-center space-y-1">
                  <Package className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-gray-400">Aucune publication n'a encore été importée.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {importedItems.map((item) => (
                    <div
                      key={item.facebookPostId}
                      className="p-3.5 rounded-xl bg-[#181820] border border-zinc-800 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'draft'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : item.targetType === 'listing'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            }`}
                          >
                            {item.status === 'draft' ? 'Brouillon à compléter' : item.targetType === 'listing' ? 'Annonce active' : 'Post fil social'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(item.importedAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <h5 className="font-bold text-white text-xs truncate max-w-md">
                          {item.title}
                        </h5>

                        {item.price ? (
                          <span className="text-[#D4AF37] font-black text-xs block">
                            {item.price.toLocaleString('fr-FR')} FCFA
                          </span>
                        ) : null}

                        {item.rawSnippet && (
                          <p className="text-[11px] text-gray-400 line-clamp-1 italic">
                            « {item.rawSnippet} »
                          </p>
                        )}
                      </div>

                      <a
                        href={item.permalinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-[#1877F2]/15 hover:bg-[#1877F2]/25 text-[#1877F2] font-bold text-[11px] inline-flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Facebook</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-[#0E0E12] flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
            <span>Sécurité : Les jetons et appels d'API s'exécutent exclusivement côté serveur.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold cursor-pointer transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
