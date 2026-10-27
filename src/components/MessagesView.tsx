import React, { useState, useEffect, useRef } from 'react';
import { 
  fetchConversations, fetchMessages, sendMessage, markConversationAsRead, 
  rpcGetContactPhone, uploadWebpImage, subscribeToRealtime, 
  ConversationData, MessageData 
} from '../lib/supabaseData';
import { 
  Send, Phone, ArrowLeft, Image as ImageIcon, 
  MessageSquare, CheckCheck, Compass, ShieldCheck
} from 'lucide-react';

interface MessagesViewProps {
  currentUserId?: string;
  activeConversationId?: string | null;
  onSelectConversation?: (convId: string) => void;
  onNavigateExplore: () => void;
  onRequireAuth: () => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  currentUserId,
  activeConversationId,
  onSelectConversation,
  onNavigateExplore,
  onRequireAuth,
}) => {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(activeConversationId || null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const [loadingConv, setLoadingConv] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadConvs = async () => {
    if (!currentUserId) {
      setLoadingConv(false);
      return;
    }
    const list = await fetchConversations(currentUserId);
    setConversations(list);
    setLoadingConv(false);
    if (!selectedConvId && list.length > 0) {
      setSelectedConvId(list[0].id);
    }
  };

  useEffect(() => {
    loadConvs();
  }, [currentUserId]);

  useEffect(() => {
    if (activeConversationId) {
      setSelectedConvId(activeConversationId);
    }
  }, [activeConversationId]);

  const activeConv = conversations.find((c) => c.id === selectedConvId);

  // Load messages when selected conversation changes
  useEffect(() => {
    if (!selectedConvId || !currentUserId) return;

    fetchMessages(selectedConvId).then((msgs) => {
      setMessages(msgs);
      markConversationAsRead(selectedConvId, currentUserId);
    });

    // Fetch other user phone via RPC
    if (activeConv) {
      rpcGetContactPhone(activeConv.other_user.id).then((phone) => {
        setContactPhone(phone);
      });
    }

    // Subscribe to realtime messages
    const unsub = subscribeToRealtime('messages', (newMsg: MessageData) => {
      if (newMsg.conversation_id === selectedConvId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        if (newMsg.sender_id !== currentUserId) {
          markConversationAsRead(selectedConvId, currentUserId);
        }
      }
      loadConvs();
    });

    return () => {
      unsub();
    };
  }, [selectedConvId, currentUserId, activeConv?.other_user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedConvId || !currentUserId) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      const newMsg = await sendMessage(selectedConvId, currentUserId, text);
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      loadConvs();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConvId || !currentUserId) return;

    setIsUploadingPhoto(true);
    try {
      const url = await uploadWebpImage('chat', currentUserId, file, selectedConvId);
      const newMsg = await sendMessage(selectedConvId, currentUserId, '📷 Photo', url);
      setMessages((prev) => [...prev, newMsg]);
      loadConvs();
    } catch (err) {
      console.error('Error sending chat photo:', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (!currentUserId) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4 text-white">
        <MessageSquare className="w-12 h-12 text-[#D4AF37] mx-auto opacity-70" />
        <h3 className="text-base font-bold">Connectez-vous pour accéder à vos messages</h3>
        <p className="text-xs text-gray-400 max-w-sm mx-auto">
          Discutez directement avec les vendeurs et acheteurs en toute sécurité.
        </p>
        <button
          onClick={onRequireAuth}
          className="px-6 py-2.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 cursor-pointer shadow-md"
        >
          Se connecter / S'inscrire
        </button>
      </div>
    );
  }

  if (loadingConv) {
    return (
      <div className="py-20 text-center text-xs text-gray-400">
        Chargement de vos conversations...
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4 text-white">
        <div className="w-16 h-16 rounded-full bg-[#181820] border border-zinc-800 flex items-center justify-center mx-auto text-[#D4AF37]">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold">Aucune conversation pour le moment</h3>
        <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
          Contactez un vendeur directement depuis une annonce pour démarrer une discussion et négocier votre achat.
        </p>
        <button
          onClick={onNavigateExplore}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 cursor-pointer shadow-md shadow-amber-500/20"
        >
          <Compass className="w-4 h-4" />
          <span>Explorer les annonces</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-3 pb-24 text-white">
      <div className="bg-[#121216] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[78vh]">
        {/* Left column: Conversations list */}
        <div
          className={`w-full md:w-80 border-r border-zinc-800 flex flex-col ${
            selectedConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-3.5 border-b border-zinc-800 bg-[#16161C]">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-gray-300">
              Mes discussions
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
            {conversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const otherName = conv.other_user?.full_name || 'Utilisateur';
              const initials = otherName
                ? otherName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                : 'AB';

              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConvId(conv.id);
                    onSelectConversation?.(conv.id);
                  }}
                  className={`w-full p-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-[#1C1C24] border-l-2 border-[#D4AF37]' : 'hover:bg-[#16161C]'
                  }`}
                >
                  {conv.other_user?.avatar_url ? (
                    <img
                      src={conv.other_user.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-[#D4AF37]/30 bg-zinc-900 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#D4AF37] to-[#F59E0B] text-black font-extrabold flex items-center justify-center text-xs shrink-0">
                      {initials}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white truncate flex items-center gap-1">
                        <span>{otherName}</span>
                        {conv.other_user?.phone_verified && (
                          <ShieldCheck className="w-3 h-3 text-[#D4AF37]" />
                        )}
                      </h4>
                      {conv.unread_count > 0 && (
                        <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {conv.last_message?.content || (conv.listing ? conv.listing.title : 'Nouvelle conversation')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: Active Chat Thread */}
        <div
          className={`flex-1 flex flex-col bg-[#0F0F13] ${
            !selectedConvId ? 'hidden md:flex items-center justify-center' : 'flex'
          }`}
        >
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="p-3 border-b border-zinc-800 bg-[#14141A] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setSelectedConvId(null)}
                    className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{activeConv.other_user?.full_name || 'Utilisateur'}</span>
                      {activeConv.other_user?.phone_verified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                      )}
                    </h3>
                    {activeConv.listing && (
                      <span className="text-[10px] text-[#D4AF37] truncate block max-w-xs">
                        Annonce : {activeConv.listing.title} ({activeConv.listing.price.toLocaleString()} {activeConv.listing.currency})
                      </span>
                    )}
                  </div>
                </div>

                {contactPhone && (
                  <button
                    onClick={() => (window.location.href = `tel:${contactPhone.replace(/\s+/g, '')}`)}
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[#D4AF37] border border-zinc-700 flex items-center gap-1 text-xs font-semibold cursor-pointer"
                    title="Appeler le vendeur"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Appeler</span>
                  </button>
                )}
              </div>

              {/* Messages scroll area */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                {messages.map((msg) => {
                  const isMe = msg.sender_id === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                          isMe
                            ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black font-medium rounded-br-xs shadow-md'
                            : 'bg-[#1D1D26] text-white rounded-bl-xs border border-zinc-800'
                        }`}
                      >
                        {msg.image_url && (
                          <div className="mb-2 rounded-xl overflow-hidden max-h-56 bg-black">
                            <img src={msg.image_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <p className="whitespace-pre-line">{msg.content}</p>
                      </div>

                      <span className="text-[9px] text-gray-500 mt-0.5 px-1 flex items-center gap-1">
                        {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {isMe && <CheckCheck className="w-3 h-3 text-[#D4AF37]" />}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <form
                onSubmit={handleSendMessage}
                className="p-2.5 sm:p-3 border-t border-zinc-800 bg-[#14141A] flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="p-2 rounded-xl bg-zinc-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Envoyer une photo"
                >
                  <ImageIcon className="w-4 h-4 text-[#D4AF37]" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSendPhoto}
                  className="hidden"
                />

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Écrivez votre message..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#1A1A22] text-base sm:text-xs text-white placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={isSending || !inputText.trim()}
                  className="p-2.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black hover:brightness-110 disabled:opacity-40 transition-colors cursor-pointer shadow-md"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                </button>
              </form>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-gray-400">
              Sélectionnez une discussion à gauche pour commencer à échanger.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
