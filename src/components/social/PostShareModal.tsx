import React, { useState } from 'react';
import { 
  X, Share2, Copy, Check, MessageCircle, Send, 
  ExternalLink, CornerUpRight, ShieldCheck, Globe
} from 'lucide-react';
import { PostData } from '../../lib/supabaseData';

interface PostShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: PostData;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  onShareToFeed: (commentary: string) => Promise<void>;
  onExternalShareRecord?: (shareType: string) => void;
}

export const PostShareModal: React.FC<PostShareModalProps> = ({
  isOpen,
  onClose,
  post,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onShareToFeed,
  onExternalShareRecord,
}) => {
  const [commentary, setCommentary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://afrique-afrique.com';
  const postShareUrl = `${originUrl}/#post-${post.id}`;
  const authorName = post.author?.full_name || 'Membre Afrique Business';
  const authorInitials = authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  // Share to social feed
  const handlePublishToFeed = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onShareToFeed(commentary.trim());
      onClose();
    } catch (err: any) {
      alert(`Erreur lors du partage : ${err.message || 'Échec de publication'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy link
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(postShareUrl);
      } else {
        const input = document.createElement('input');
        input.value = postShareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      onExternalShareRecord?.('link_copy');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  // WhatsApp
  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `📢 ${authorName} sur Afrique Business :\n« ${post.content.slice(0, 160)}... »\n\n👉 Voir la publication complète : ${postShareUrl}`
    );
    onExternalShareRecord?.('whatsapp');
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  // Facebook
  const handleShareFacebook = () => {
    onExternalShareRecord?.('facebook');
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postShareUrl)}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  // Native share API (mobile device native tray)
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Publication de ${authorName} sur Afrique Business`,
          text: post.content.slice(0, 200),
          url: postShareUrl,
        });
        onExternalShareRecord?.('native_share');
      } catch (err) {
        console.warn('Native share dismissed:', err);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-lg bg-white rounded-2xl border border-[#E5E8EF] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-[#172033]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E5E8EF] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#C69A35]/15 text-[#C69A35] flex items-center justify-center">
              <Share2 className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#172033]">
                Partager la publication
              </h3>
              <p className="text-[11px] text-[#596273]">
                Sur votre fil d'actualité ou vers d'autres applications
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#596273] hover:text-[#172033] hover:bg-[#F1F4F9] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* SECTION A: PARTAGER SUR MON FIL SOCIAL */}
          <div className="p-3.5 rounded-2xl bg-[#F8F9FC] border border-[#E5E8EF] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#172033] flex items-center gap-1.5">
                <CornerUpRight className="w-3.5 h-3.5 text-[#C69A35]" />
                <span>Partager sur mon fil social panafricain</span>
              </span>
              <span className="text-[10px] font-semibold text-[#596273]">
                Visible par toute la communauté
              </span>
            </div>

            {/* Author sharing info */}
            {currentUserName && (
              <div className="flex items-center gap-2 pt-1">
                {currentUserAvatar ? (
                  <img
                    src={currentUserAvatar}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover border border-[#E5E8EF]"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#172033] text-white font-bold text-[10px] flex items-center justify-center">
                    {currentUserName[0]}
                  </div>
                )}
                <span className="text-xs font-semibold text-[#172033]">
                  {currentUserName}
                </span>
              </div>
            )}

            {/* Optional Personal Commentary */}
            <textarea
              rows={2}
              value={commentary}
              onChange={(e) => setCommentary(e.target.value)}
              placeholder="Ajoutez un avis ou commentaire personnel (optionnel)..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-[#E5E8EF] text-sm text-[#172033] placeholder-[#596273] focus:border-[#C69A35] focus:outline-none focus:ring-1 focus:ring-[#C69A35]"
            />

            {/* Original Post Preview Card (Retains Author identity, content, photos) */}
            <div className="p-3 rounded-xl bg-white border border-[#E5E8EF] space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {post.author?.avatar_url ? (
                    <img
                      src={post.author.avatar_url}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover border border-[#E5E8EF]"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#C69A35] text-[#172033] font-bold text-[10px] flex items-center justify-center">
                      {authorInitials}
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold text-[#172033] flex items-center gap-1">
                      <span>{authorName}</span>
                      {post.author?.phone_verified && (
                        <ShieldCheck className="w-3 h-3 text-[#C69A35]" />
                      )}
                    </span>
                    <span className="text-[10px] text-[#596273]">Auteur d'origine</span>
                  </div>
                </div>

                <span className="text-[10px] text-[#596273]">
                  {new Date(post.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>

              {/* Original Content Snippet */}
              <p className="text-xs text-[#172033] leading-relaxed line-clamp-3">
                {post.content}
              </p>

              {/* Photos Preview */}
              {post.images && post.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto py-1">
                  {post.images.slice(0, 3).map((img, idx) => (
                    <div
                      key={idx}
                      className="w-16 h-16 rounded-lg overflow-hidden border border-[#E5E8EF] shrink-0"
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {post.images.length > 3 && (
                    <div className="w-16 h-16 rounded-lg bg-[#F1F4F9] border border-[#E5E8EF] flex items-center justify-center text-xs font-bold text-[#596273]">
                      +{post.images.length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Confirm Publish Button */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#596273] hover:text-[#172033] hover:bg-white transition-colors"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handlePublishToFeed}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] font-bold text-xs shadow-sm hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isSubmitting ? 'Publication...' : 'Publier sur mon fil'}</span>
              </button>
            </div>
          </div>

          {/* SECTION B: AUTRES OPTIONS DE PARTAGE */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#596273] uppercase tracking-wider block">
              Autres possibilités de partage
            </span>

            <div className="grid grid-cols-2 gap-2">
              {/* WhatsApp */}
              <button
                onClick={handleShareWhatsApp}
                className="p-3 rounded-xl bg-white border border-[#E5E8EF] hover:border-emerald-500/50 hover:bg-emerald-50/30 transition-all flex items-center gap-2.5 cursor-pointer text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <MessageCircle className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#172033] block">
                    WhatsApp
                  </span>
                  <span className="text-[10px] text-[#596273]">Envoyer à un contact</span>
                </div>
              </button>

              {/* Facebook */}
              <button
                onClick={handleShareFacebook}
                className="p-3 rounded-xl bg-white border border-[#E5E8EF] hover:border-[#1877F2]/50 hover:bg-blue-50/30 transition-all flex items-center gap-2.5 cursor-pointer text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#1877F2] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#172033] block">
                    Facebook
                  </span>
                  <span className="text-[10px] text-[#596273]">Fil & Groupes</span>
                </div>
              </button>

              {/* Copier le lien */}
              <button
                onClick={handleCopyLink}
                className="p-3 rounded-xl bg-white border border-[#E5E8EF] hover:border-[#C69A35]/50 hover:bg-[#F8F9FC] transition-all flex items-center gap-2.5 cursor-pointer text-left col-span-2 sm:col-span-1"
              >
                <div className="w-8 h-8 rounded-lg bg-[#F1F4F9] text-[#172033] flex items-center justify-center shrink-0">
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#596273]" />
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold text-[#172033] block">
                    {copied ? 'Lien copié !' : 'Copier le lien'}
                  </span>
                  <span className="text-[10px] text-[#596273]">Lien direct d'accès</span>
                </div>
              </button>

              {/* Native phone applications */}
              <button
                onClick={handleNativeShare}
                className="p-3 rounded-xl bg-white border border-[#E5E8EF] hover:border-[#C69A35]/50 hover:bg-[#F8F9FC] transition-all flex items-center gap-2.5 cursor-pointer text-left col-span-2 sm:col-span-1"
              >
                <div className="w-8 h-8 rounded-lg bg-[#C69A35]/15 text-[#C69A35] flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#172033] block">
                    Plus d'applications
                  </span>
                  <span className="text-[10px] text-[#596273]">Telegram, SMS, etc.</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
