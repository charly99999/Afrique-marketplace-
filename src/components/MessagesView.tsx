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
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-[#C69A35]">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-base font-extrabold text-[#172033]">Connectez-vous pour accéder à vos messages</h3>
        <p className="text-xs text-[#596273] max-w-sm mx-auto">
          Discutez directement avec les vendeurs et acheteurs en toute sécurité.
        </p>
        <button
          onClick={onRequireAuth}
          className="px-6 py-2.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black hover:brightness-105 cursor-pointer shadow-md transition-all active:scale-95"
        >
          Se connecter / S'inscrire
        </button>
      </div>
    );
  }

  if (loadingConv) {
    return (
      <div className="py-20 text-center text-xs text-[#596273]">
        Chargement de vos discussions...
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-[#C69A35]">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-base font-extrabold text-[#172033]">Aucune discussion pour le moment</h3>
        <p className="text-xs text-[#596273] max-w-sm mx-auto leading-relaxed">
          Contactez un vendeur directement depuis une annonce pour démarrer une discussion et négocier votre achat.
        </p>
        <button
          onClick={onNavigateExplore}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black hover:brightness-105 cursor-pointer shadow-md transition-all active:scale-95"
        >
          <Compass className="w-4 h-4" />
          <span>Explorer les annonces</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-3 pb-24 text-[#172033]">
      <div className="bg-white border border-[#E5E8EF] rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row h-[78vh]">
        {/* Left column: Conversations list */}
        <div
          className={`w-full md:w-80 border-r border-[#E5E8EF] flex flex-col bg-white ${
            selectedConvId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-3.5 border-b border-[#E5E8EF] bg-[#F8F9FC]">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#172033]">
              Mes discussions
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E5E8EF]">
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
                    isSelected ? 'bg-amber-50/70 border-l-4 border-[#C69A35]' : 'hover:bg-[#F8F9FC]'
                  }`}
                >
                  {conv.other_user?.avatar_url ? (
                    <img
                      src={conv.other_user.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border-2 border-[#C69A35]/40 bg-[#F1F4F9] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#C69A35] to-[#E7C875] text-[#172033] font-black flex items-center justify-center text-xs shrink-0 shadow-xs">
                      {initials}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#172033] truncate flex items-center gap-1">
                        <span>{otherName}</span>
                        {conv.other_user?.phone_verified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#C69A35]" />
                        )}
                      </h4>
                      {conv.unread_count > 0 && (
                        <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-[#596273] truncate mt-0.5">
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
          className={`flex-1 flex flex-col bg-[#F8F9FC] ${
            !selectedConvId ? 'hidden md:flex items-center justify-center' : 'flex'
          }`}
        >
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="p-3 border-b border-[#E5E8EF] bg-white flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setSelectedConvId(null)}
                    className="md:hidden p-1.5 rounded-lg text-[#596273] hover:text-[#172033]"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div>
                    <h3 className="text-xs font-extrabold text-[#172033] flex items-center gap-1.5">
                      <span>{activeConv.other_user?.full_name || 'Utilisateur'}</span>
                      {activeConv.other_user?.phone_verified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-[#C69A35]" />
                      )}
                    </h3>
                    {activeConv.listing && (
                      <span className="text-[10px] text-[#C69A35] font-bold truncate block max-w-xs">
                        Annonce : {activeConv.listing.title} ({activeConv.listing.price.toLocaleString()} {activeConv.listing.currency})
                      </span>
                    )}
                  </div>
                </div>

                {contactPhone && (
                  <button
                    onClick={() => (window.location.href = `tel:${contactPhone.replace(/\s+/g, '')}`)}
                    className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100/80 text-[#A27B20] border border-[#C69A35]/30 flex items-center gap-1 text-xs font-bold cursor-pointer"
                    title="Appeler le vendeur"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#C69A35]" />
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
                            ? 'bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] font-semibold rounded-br-xs shadow-xs'
                            : 'bg-white text-[#172033] rounded-bl-xs border border-[#E5E8EF] shadow-xs'
                        }`}
                      >
                        {msg.image_url && (
                          <div className="mb-2 rounded-xl overflow-hidden max-h-56 bg-gray-100 border border-[#E5E8EF]">
                            <img src={msg.image_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <p className="whitespace-pre-line">{msg.content}</p>
                      </div>

                      <span className="text-[9px] text-[#596273] mt-0.5 px-1 flex items-center gap-1">
                        {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {isMe && <CheckCheck className="w-3 h-3 text-[#C69A35]" />}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <form
                onSubmit={handleSendMessage}
                className="p-2.5 sm:p-3 border-t border-[#E5E8EF] bg-white flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="p-2 rounded-xl bg-[#F8F9FC] text-[#596273] hover:text-[#172033] border border-[#E5E8EF] transition-colors cursor-pointer"
                  title="Envoyer une photo"
                >
                  <ImageIcon className="w-4 h-4 text-[#C69A35]" />
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
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-base sm:text-xs text-[#172033] placeholder-gray-400 focus:border-[#C69A35] focus:bg-white focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={isSending || !inputText.trim()}
                  className="p-2.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] hover:brightness-105 disabled:opacity-40 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Send className="w-4 h-4 stroke-[2.5]" />
                </button>
              </form>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-[#596273]">
              Sélectionnez une discussion à gauche pour commencer à échanger.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
