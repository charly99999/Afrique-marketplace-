import React, { useState, useEffect } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { FeedView } from './components/FeedView';
import { ExploreView } from './components/ExploreView';
import { PublishView } from './components/PublishView';
import { MessagesView } from './components/MessagesView';
import { CommunityView } from './components/CommunityView';
import { ProfileView } from './components/ProfileView';
import { CountryModal } from './components/CountryModal';
import { ListingDetailModal } from './components/ListingDetailModal';
import { AuthModal } from './components/AuthModal';
import { SettingsModal } from './components/SettingsModal';
import { TermsModal } from './components/TermsModal';
import { PWAUpdateToast } from './components/PWAUpdateToast';
import { AdminFacebookModal } from './components/AdminFacebookModal';

import { Listing, CountryCode, StoredUser, AppNotification } from './types';
import { 
  getCurrentUser, setCurrentUser, getStoredNotifications, 
  addNotification, markNotificationsAsRead, isValidUuid
} from './lib/storage';
import { supabase } from './lib/supabase';
import { 
  fetchListings, createListing, updateListing, deleteListing, 
  rpcStartConversation, getProfile, subscribeToRealtime, getAccountPhone
} from './lib/supabaseData';
import { AFRICAN_COUNTRIES } from './data/countries';
import { MessageSquare, ShoppingBag } from 'lucide-react';

export default function App() {
  // Splash Screen (2 seconds as required)
  const [showSplash, setShowSplash] = useState(true);

  // App Navigation
  const [activeTab, setActiveTab] = useState<NavTab>('feed');
  const [showCommunityView, setShowCommunityView] = useState(false);

  // Country & Devise
  const [currentCountry, setCurrentCountry] = useState<CountryCode>('CI');
  const [scopeAllAfrica, setScopeAllAfrica] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Display & Data Saver (Dark mode default matching the obsidian & gold logo)
  const [dataSaver, setDataSaver] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // User & Auth State (Real user or null if not yet signed in)
  const [currentUser, setCurrentUserState] = useState<StoredUser | null>(() => {
    const u = getCurrentUser();
    return u && isValidUuid(u.id) ? u : null;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authDefaultMode, setAuthDefaultMode] = useState<'LOGIN' | 'REGISTER' | 'SMS_OTP'>('LOGIN');

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showAdminFacebookModal, setShowAdminFacebookModal] = useState(false);

  // Real Listings Store
  const [listings, setListings] = useState<Listing[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>(getStoredNotifications());
  const [unreadMessagesTotal, setUnreadMessagesTotal] = useState(0);

  // Detail Modal & Edit state
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);

  // Active chat conversation ID when jumping from listing to message
  const [targetChatConvId, setTargetChatConvId] = useState<string | null>(null);

  // Dark Mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Supabase Auth Persistence & Session Restoration
  useEffect(() => {
    // 1. Check existing session on boot
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await getProfile(session.user.id);
        const fullName = profile?.full_name || session.user.user_metadata?.full_name || 'Utilisateur';
        const nameParts = fullName.split(' ');
        const privPhone = await getAccountPhone(session.user.id);
        const cleanEmail = (session.user.email && !session.user.email.includes('@afrique-business.internal') && !session.user.email.includes('@afrique-business.app'))
          ? session.user.email
          : undefined;

        const userObj: StoredUser = {
          id: session.user.id,
          firstName: nameParts[0] || 'Utilisateur',
          lastName: nameParts.slice(1).join(' ') || '',
          fullName,
          email: cleanEmail,
          phone: privPhone || session.user.phone,
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
        setCurrentUserState(userObj);
        setCurrentUser(userObj);
      }
    });

    // 2. Realtime Auth State Listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await getProfile(session.user.id);
        const privPhone = await getAccountPhone(session.user.id);
        const fullName = profile?.full_name || session.user.user_metadata?.full_name || 'Utilisateur';
        const nameParts = fullName.split(' ');
        const cleanEmail = (session.user.email && !session.user.email.includes('@afrique-business.internal') && !session.user.email.includes('@afrique-business.app'))
          ? session.user.email
          : undefined;

        const userObj: StoredUser = {
          id: session.user.id,
          firstName: nameParts[0] || 'Utilisateur',
          lastName: nameParts.slice(1).join(' ') || '',
          fullName,
          email: cleanEmail,
          phone: privPhone || session.user.phone,
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
        setCurrentUserState(userObj);
        setCurrentUser(userObj);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUserState(null);
        setCurrentUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Load real listings on mount and when country changes
  const loadListings = async () => {
    try {
      const data = await fetchListings({
        country: scopeAllAfrica ? 'ALL' : currentCountry,
        limit: 200,
      });
      const mapped: Listing[] = (data || []).map((l: any) => ({
        id: l.id,
        user_id: l.user_id,
        title: l.title,
        description: l.description,
        price: Number(l.price),
        currency: l.currency,
        category: l.category,
        country: l.country,
        city: l.city,
        images: l.images || [],
        condition: l.condition,
        contact_phone: l.contact_phone || undefined,
        whatsapp_phone: l.whatsapp_phone || undefined,
        status: l.status,
        createdAt: l.created_at,
        edited_at: l.edited_at,
        seller: {
          id: l.seller?.id || l.user_id,
          name: l.seller?.full_name || 'Vendeur',
          phone: l.contact_phone || l.seller?.phone,
          whatsapp: l.whatsapp_phone || l.contact_phone || l.seller?.phone,
          avatarUrl: l.seller?.avatar_url,
          avatar_url: l.seller?.avatar_url,
          verified: Boolean(l.seller?.phone_verified),
          phone_verified: Boolean(l.seller?.phone_verified),
          city: l.seller?.city || l.city,
          country: l.seller?.country || l.country,
        },
      }));

      // Garantie stricte anti-doublon côté client (par ID et signature d'annonce)
      const seenIds = new Set<string>();
      const seenSignatures = new Set<string>();
      const uniqueListings: Listing[] = [];

      for (const item of mapped) {
        if (!item.id || seenIds.has(item.id)) continue;
        const normTitle = (item.title || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 20);
        const sig = `${item.price}_${normTitle}_${item.city}`;
        if (seenSignatures.has(sig)) continue;

        seenIds.add(item.id);
        seenSignatures.add(sig);
        uniqueListings.push(item);
      }

      setListings(uniqueListings);
    } catch (err: any) {
      console.error('loadListings error:', err);
    }
  };

  useEffect(() => {
    loadListings();

    // Subscribe to realtime listing changes
    const unsub = subscribeToRealtime('listings', () => {
      loadListings();
    });

    return () => {
      unsub();
    };
  }, [currentCountry, scopeAllAfrica]);

  // Check for Admin Facebook alerts (token expiration, rate limit, etc.)
  useEffect(() => {
    if (!currentUser) return;
    const isAdmin =
      currentUser.email === 'marcarnaudkonan2@gmail.com' ||
      currentUser.fullName?.toLowerCase().includes('marc') ||
      currentUser.phone?.includes('2250565242349') ||
      currentUser.id === 'd2882463-6bcf-414a-8844-6c06279e50e0';

    if (!isAdmin) return;

    const checkAdminAlerts = async () => {
      try {
        const res = await fetch('/api/admin/facebook-notifications', {
          headers: {
            'x-admin-id': currentUser.id,
            'x-admin-email': currentUser.email || '',
            'x-admin-phone': currentUser.phone || '',
          },
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.notifications)) {
          const unread = data.notifications.filter((n: any) => !n.read);
          if (unread.length > 0) {
            unread.forEach((n: any) => {
              addNotification({
                title: n.title,
                message: n.message,
                type: 'SYSTEM',
              });
            });
            setNotifications(getStoredNotifications());
            // Mark read on server so not spammed
            await fetch('/api/admin/facebook-notifications/read', {
              method: 'POST',
              headers: {
                'x-admin-id': currentUser.id,
                'x-admin-email': currentUser.email || '',
              },
            });
          }
        }
      } catch {
        // Ignore background polling errors
      }
    };

    checkAdminAlerts();
    const interval = setInterval(checkAdminAlerts, 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Viewer Currency
  const viewerCurrency = AFRICAN_COUNTRIES[currentCountry]?.currency || 'XOF';

  // Handler: When user logs in or registers
  const handleAuthSuccess = async (user: StoredUser) => {
    setCurrentUserState(user);
    setCurrentUser(user);
    if (user.country) setCurrentCountry(user.country);

    addNotification({
      title: 'Connexion réussie',
      message: `Bienvenue sur Afrique Business, ${user.fullName} !`,
      type: 'AUTH',
    });
    setNotifications(getStoredNotifications());
    await loadListings();
  };

  // Handler: Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setCurrentUserState(null);
    addNotification({
      title: 'Déconnexion effectuée',
      message: 'Vous êtes désormais déconnecté. Vos annonces restent en ligne.',
      type: 'AUTH',
    });
    setNotifications(getStoredNotifications());
  };

  // Handler: Save / Publish Listing (Create or Edit)
  const handlePublishSuccess = async (listingData: Listing, isEdit: boolean) => {
    if (!currentUser || !isValidUuid(currentUser.id)) {
      setAuthDefaultMode('LOGIN');
      setShowAuthModal(true);
      return;
    }

    try {
      if (isEdit) {
        await updateListing(listingData.id, currentUser.id, {
          title: listingData.title,
          description: listingData.description,
          price: listingData.price,
          currency: listingData.currency,
          condition: listingData.condition === 'occasion' ? 'occasion' : 'neuf',
          city: listingData.city,
          country: listingData.country,
          images: listingData.images,
          contact_phone: listingData.contact_phone,
          whatsapp_phone: listingData.whatsapp_phone,
          category: listingData.category as any,
          subcategory: listingData.subcategory || null,
        });

        addNotification({
          title: 'Annonce mise à jour !',
          message: `Les modifications de « ${listingData.title} » sont désormais en ligne.`,
          type: 'LISTING',
        });
      } else {
        await createListing({
          user_id: currentUser.id,
          title: listingData.title,
          category: listingData.category as any,
          subcategory: listingData.subcategory || null,
          description: listingData.description,
          price: listingData.price,
          currency: listingData.currency,
          condition: listingData.condition === 'occasion' ? 'occasion' : 'neuf',
          country: listingData.country,
          city: listingData.city,
          images: listingData.images,
          contact_phone: listingData.contact_phone,
          whatsapp_phone: listingData.whatsapp_phone,
          status: 'active',
        });

        addNotification({
          title: 'Annonce publiée avec succès !',
          message: `Votre annonce « ${listingData.title} » est visible par tous les acheteurs.`,
          type: 'LISTING',
        });
      }

      await loadListings();
      setEditingListing(null);
      setActiveTab('feed');
      setShowCommunityView(false);
    } catch (err: any) {
      console.error('handlePublishSuccess error:', err);
      alert(`Publication impossible : ${err.message || 'Erreur lors de l’enregistrement dans Supabase.'}`);
    }
  };

  // Handler: Delete Listing
  const handleDeleteListing = async (listingId: string) => {
    if (!currentUser) return;
    try {
      await deleteListing(listingId, currentUser.id);
      await loadListings();
      setSelectedListing(null);

      addNotification({
        title: 'Annonce supprimée',
        message: 'Votre annonce a été retirée définitivement du catalogue.',
        type: 'LISTING',
      });
    } catch (err: any) {
      alert(`Suppression impossible : ${err.message}`);
    }
  };

  // Handler: Status change (sold, paused, active)
  const handleStatusChange = async (listingId: string, newStatus: 'active' | 'sold' | 'paused') => {
    if (!currentUser) return;
    try {
      await updateListing(listingId, currentUser.id, { status: newStatus });
      await loadListings();
      if (selectedListing && selectedListing.id === listingId) {
        setSelectedListing({ ...selectedListing, status: newStatus });
      }
    } catch (err: any) {
      alert(`Mise à jour impossible : ${err.message}`);
    }
  };

  // Start chat from Listing detail
  const handleStartChatFromListing = async (sellerId: string, listingId: string, listingTitle: string) => {
    if (!currentUser) {
      setAuthDefaultMode('LOGIN');
      setShowAuthModal(true);
      return;
    }

    try {
      const convId = await rpcStartConversation(sellerId, listingId);
      setTargetChatConvId(convId);
      setActiveTab('messages');
      setShowCommunityView(false);
      setSelectedListing(null);
    } catch (err) {
      console.error('Error starting conversation:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F8FAFC]">
      {/* Splash Screen on cold start (2s duration) */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {/* Main Container */}
      <div className="max-w-md sm:max-w-2xl lg:max-w-5xl mx-auto min-h-screen flex flex-col bg-[#09090B] shadow-2xl relative">
        {/* App Header */}
        <Header
          currentCountry={currentCountry}
          onOpenCountryModal={() => setShowCountryModal(true)}
          onOpenSettingsModal={() => setShowSettingsModal(true)}
          onOpenAuthModal={() => {
            setAuthDefaultMode('LOGIN');
            setShowAuthModal(true);
          }}
          onOpenTermsModal={() => setShowTermsModal(true)}
          notifications={notifications}
          onMarkNotificationsRead={() => {
            markNotificationsAsRead();
            setNotifications(getStoredNotifications());
          }}
          currentUser={currentUser}
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            if (activeTab !== 'feed' && activeTab !== 'explore') {
              setActiveTab('feed');
            }
          }}
          onLogoClick={() => {
            setActiveTab('feed');
            setShowCommunityView(false);
          }}
        />

        {/* View Switcher Bar: Marketplace vs Fil Social */}
        <div className="bg-[#121216] border-b border-zinc-800 px-3 py-1.5 flex items-center justify-between text-xs font-bold">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowCommunityView(false);
                if (activeTab === 'sell') setActiveTab('feed');
              }}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                !showCommunityView && activeTab !== 'sell'
                  ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Marketplace</span>
            </button>

            <button
              onClick={() => setShowCommunityView(true)}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                showCommunityView
                  ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Fil Social Panafricain</span>
            </button>
          </div>

          <button
            onClick={() => {
              setScopeAllAfrica(!scopeAllAfrica);
            }}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
              scopeAllAfrica
                ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]'
                : 'bg-zinc-800 border-zinc-700 text-gray-400 hover:text-white'
            }`}
          >
            {scopeAllAfrica ? '🌍 Toute Afrique' : `📍 ${currentCountry}`}
          </button>
        </div>

        {/* Main View Router */}
        <main className="flex-1">
          {showCommunityView ? (
            <CommunityView
              currentUserId={currentUser?.id}
              currentUserName={currentUser?.fullName}
              currentUserAvatar={currentUser?.avatarUrl}
              onRequireAuth={() => {
                setAuthDefaultMode('LOGIN');
                setShowAuthModal(true);
              }}
            />
          ) : activeTab === 'feed' ? (
            <FeedView
              listings={listings}
              currentCountry={currentCountry}
              scopeAllAfrica={scopeAllAfrica}
              viewerCurrency={viewerCurrency}
              dataSaver={dataSaver}
              onSelectListing={(l) => setSelectedListing(l)}
              onQuickSell={() => {
                if (!currentUser) {
                  setAuthDefaultMode('REGISTER');
                  setShowAuthModal(true);
                } else {
                  setEditingListing(null);
                  setActiveTab('sell');
                }
              }}
              onOpenScopeModal={() => setShowCountryModal(true)}
            />
          ) : activeTab === 'explore' ? (
            <ExploreView
              listings={listings}
              currentCountry={currentCountry}
              viewerCurrency={viewerCurrency}
              onSelectListing={(l) => setSelectedListing(l)}
              onQuickSell={() => {
                if (!currentUser) {
                  setAuthDefaultMode('REGISTER');
                  setShowAuthModal(true);
                } else {
                  setEditingListing(null);
                  setActiveTab('sell');
                }
              }}
            />
          ) : activeTab === 'sell' ? (
            <PublishView
              currentCountry={currentCountry}
              currentUser={currentUser}
              editingListing={editingListing}
              onPublishSuccess={handlePublishSuccess}
              onCancel={() => {
                setEditingListing(null);
                setActiveTab('feed');
              }}
              onRequireAuth={() => {
                setAuthDefaultMode('REGISTER');
                setShowAuthModal(true);
              }}
            />
          ) : activeTab === 'messages' ? (
            <MessagesView
              currentUserId={currentUser?.id}
              activeConversationId={targetChatConvId}
              onSelectConversation={(cid) => setTargetChatConvId(cid)}
              onNavigateExplore={() => setActiveTab('explore')}
              onRequireAuth={() => {
                setAuthDefaultMode('LOGIN');
                setShowAuthModal(true);
              }}
            />
          ) : activeTab === 'profile' ? (
            <ProfileView
              currentUser={currentUser}
              currentCountry={currentCountry}
              onOpenSettings={() => setShowSettingsModal(true)}
              onOpenPublish={() => {
                setEditingListing(null);
                setActiveTab('sell');
              }}
              onEditListing={(listing) => {
                setEditingListing(listing);
                setActiveTab('sell');
              }}
              onRequireAuth={() => {
                setAuthDefaultMode('LOGIN');
                setShowAuthModal(true);
              }}
              onSelectListing={(l) => setSelectedListing(l)}
              onOpenAdminFacebook={() => setShowAdminFacebookModal(true)}
            />
          ) : null}
        </main>

        {/* Bottom Navigation */}
        <BottomNav
          activeTab={showCommunityView ? 'feed' : activeTab}
          onTabChange={(tab) => {
            setShowCommunityView(false);
            if (tab === 'sell' && !currentUser) {
              setAuthDefaultMode('REGISTER');
              setShowAuthModal(true);
              return;
            }
            if (tab === 'sell') {
              setEditingListing(null);
            }
            setActiveTab(tab);
          }}
          unreadMessagesCount={unreadMessagesTotal}
        />
      </div>

      {/* ---------------- ACTIVE ACTION MODALS ---------------- */}
      {/* 1. Country & Currency Modal */}
      <CountryModal
        isOpen={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        selectedCountry={currentCountry}
        onSelectCountry={(c) => {
          setCurrentCountry(c);
          setShowCountryModal(false);
        }}
      />

      {/* 2. Listing Detail Modal */}
      <ListingDetailModal
        listing={selectedListing}
        isOpen={Boolean(selectedListing)}
        onClose={() => setSelectedListing(null)}
        viewerCurrency={viewerCurrency}
        currentUserId={currentUser?.id}
        onStartChat={handleStartChatFromListing}
        onEditListing={(listing) => {
          setEditingListing(listing);
          setSelectedListing(null);
          setActiveTab('sell');
          setShowCommunityView(false);
        }}
        onStatusChange={handleStatusChange}
        onDeleteListing={handleDeleteListing}
        onRequireAuth={() => {
          setAuthDefaultMode('LOGIN');
          setShowAuthModal(true);
        }}
      />

      {/* 3. Auth Modal (Login / Register / SMS OTP / Forgot) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
        defaultMode={authDefaultMode}
      />

      {/* 4. Complete Settings Modal (Facebook Style) */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentUser={currentUser}
        onUpdateUser={(updated) => {
          setCurrentUserState(updated);
          setCurrentUser(updated);
        }}
        selectedCountry={currentCountry}
        onSelectCountry={(c) => setCurrentCountry(c)}
        dataSaver={dataSaver}
        onToggleDataSaver={() => setDataSaver(!dataSaver)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onOpenAuth={() => {
          setAuthDefaultMode('LOGIN');
          setShowAuthModal(true);
        }}
        onLogout={handleLogout}
        onOpenAdminFacebook={() => setShowAdminFacebookModal(true)}
      />

      {/* 5. Legal Terms & Charter Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />

      {/* 6. Admin Facebook Import & Sync Modal */}
      <AdminFacebookModal
        isOpen={showAdminFacebookModal}
        onClose={() => setShowAdminFacebookModal(false)}
        currentUser={currentUser}
        onRefreshData={() => {
          loadListings();
        }}
      />

      {/* 7. PWA Update & Offline Notifications */}
      <PWAUpdateToast />
    </div>
  );
}
