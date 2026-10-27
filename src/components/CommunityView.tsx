import React, { useState, useEffect } from 'react';
import { 
  fetchPosts, createPost, updatePost, deletePost, togglePostLike,
  fetchComments, createComment, updateComment, deleteComment,
  blockUser, submitReport, uploadWebpImage, subscribeToRealtime,
  PostData, CommentData
} from '../lib/supabaseData';
import { 
  Heart, MessageSquare, Send, ShieldCheck, MoreVertical, 
  Trash2, Edit, Flag, Ban, Image as ImageIcon, X, CornerDownRight, ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isValidUuid } from '../lib/storage';

interface CommunityViewProps {
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  onRequireAuth: () => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onRequireAuth,
}) => {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);

  // New post state
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Editing post state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState('');

  // Comments open state (postId -> list of comments)
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, CommentData[]>>({});
  const [newCommentContent, setNewCommentContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  // Fluid transition tracking for newly added posts and comments
  const [newlyCreatedPostId, setNewlyCreatedPostId] = useState<string | null>(null);
  const [newlyCreatedCommentId, setNewlyCreatedCommentId] = useState<string | null>(null);

  // Active menu dropdown (postId)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Report modal
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('Contenu inapproprié');
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  const loadPosts = async () => {
    setLoading(true);
    const data = await fetchPosts(currentUserId);
    setPosts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPosts();

    // Subscribe to realtime updates on posts
    const unsubPosts = subscribeToRealtime('posts', () => {
      loadPosts();
    });

    return () => {
      unsubPosts();
    };
  }, [currentUserId]);

  const getAuthUserId = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id && isValidUuid(session.user.id)) {
      return session.user.id;
    }
    if (currentUserId && isValidUuid(currentUserId)) {
      return currentUserId;
    }
    return null;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const authUid = await getAuthUserId();
    if (!authUid) {
      e.target.value = '';
      onRequireAuth();
      return;
    }

    setIsUploadingPhoto(true);
    const file = e.target.files[0];
    try {
      const url = await uploadWebpImage('posts', authUid, file);
      setNewPostImages((prev) => [...prev, url]);
    } catch (err: any) {
      console.error(err);
      alert(`Erreur photo : ${err.message || 'Téléversement échoué'}`);
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const authUid = await getAuthUserId();
    if (!authUid) {
      onRequireAuth();
      return;
    }
    if (!newPostContent.trim()) return;

    setIsPublishing(true);
    try {
      const post = await createPost(authUid, newPostContent.trim(), newPostImages);
      await loadPosts();
      setNewlyCreatedPostId(post.id);
      setTimeout(() => setNewlyCreatedPostId(null), 3000);
      setNewPostContent('');
      setNewPostImages([]);
    } catch (err: any) {
      console.error(err);
      alert(`Publication impossible : ${err.message || 'Erreur inconnue'}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleLike = async (postId: string) => {
    const authUid = await getAuthUserId();
    if (!authUid) {
      onRequireAuth();
      return;
    }

    try {
      await togglePostLike(postId, authUid);
      await loadPosts();
    } catch (err: any) {
      console.error('Like error:', err);
    }
  };

  const handleToggleComments = async (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }

    setExpandedPostId(postId);
    const comments = await fetchComments(postId);
    setCommentsMap((prev) => ({ ...prev, [postId]: comments }));
  };

  const handleCreateComment = async (postId: string) => {
    const authUid = await getAuthUserId();
    if (!authUid) {
      onRequireAuth();
      return;
    }
    if (!newCommentContent.trim()) return;

    try {
      const comment = await createComment(postId, authUid, newCommentContent.trim());
      const comments = await fetchComments(postId);
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: comments,
      }));
      setNewlyCreatedCommentId(comment.id);
      setTimeout(() => setNewlyCreatedCommentId(null), 2500);
      setNewCommentContent('');
      await loadPosts();
    } catch (err: any) {
      alert(`Commentaire impossible : ${err.message}`);
    }
  };

  const handleDeletePost = async (postId: string) => {
    const authUid = await getAuthUserId();
    if (!authUid) return;
    if (confirm('Voulez-vous vraiment supprimer cette publication ?')) {
      try {
        await deletePost(postId, authUid);
        await loadPosts();
        setActiveMenuId(null);
      } catch (err: any) {
        alert(`Suppression impossible : ${err.message}`);
      }
    }
  };

  const handleSaveEditPost = async (postId: string) => {
    const authUid = await getAuthUserId();
    if (!authUid || !editingPostContent.trim()) return;
    try {
      await updatePost(postId, authUid, editingPostContent.trim());
      await loadPosts();
      setEditingPostId(null);
      setActiveMenuId(null);
    } catch (err: any) {
      alert(`Modification impossible : ${err.message}`);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const authUid = await getAuthUserId();
    if (!authUid) return;
    if (confirm('Supprimer votre commentaire ?')) {
      await deleteComment(commentId, authUid);
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
      }));
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p))
      );
    }
  };

  const handleSaveEditComment = async (postId: string, commentId: string) => {
    const authUid = await getAuthUserId();
    if (!authUid || !editingCommentContent.trim()) return;
    await updateComment(commentId, authUid, editingCommentContent.trim());
    setCommentsMap((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).map((c) =>
        c.id === commentId ? { ...c, content: editingCommentContent.trim() } : c
      ),
    }));
    setEditingCommentId(null);
  };

  const handleBlockAuthor = async (authorId: string) => {
    const authUid = await getAuthUserId();
    if (!authUid) {
      onRequireAuth();
      return;
    }
    if (confirm('Voulez-vous bloquer cet utilisateur ? Ses publications et annonces ne s’afficheront plus.')) {
      await blockUser(authUid, authorId);
      setPosts((prev) => prev.filter((p) => p.user_id !== authorId));
      setActiveMenuId(null);
    }
  };

  const handleSubmitReportPost = async () => {
    const authUid = await getAuthUserId();
    if (!authUid || !reportingPostId) {
      onRequireAuth();
      return;
    }
    await submitReport({
      reporter_id: authUid,
      target_type: 'post',
      target_id: reportingPostId,
      reason: reportReason,
    });
    setReportFeedback('Publication signalée à la modération.');
    setTimeout(() => {
      setReportingPostId(null);
      setReportFeedback(null);
    }, 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-3.5 sm:px-6 py-4 pb-28 space-y-4 text-white">
      {/* Create Post Header */}
      <div className="p-4 rounded-2xl bg-[#131317] border border-zinc-800 shadow-md">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          Fil Communautaire Panafricain
        </h3>
        <form onSubmit={handleCreatePost} className="space-y-3">
          <textarea
            rows={2}
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            onClick={() => {
              if (!currentUserId || !isValidUuid(currentUserId)) {
                onRequireAuth();
              }
            }}
            placeholder={
              currentUserId && isValidUuid(currentUserId)
                ? "Partagez une actualité commerciale, arrivage de conteneurs, opportunités d'affaires..."
                : "Connectez-vous pour publier un message sur le fil..."
            }
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#17171C] text-base text-white placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none"
          />

          {/* Attached Images preview */}
          {newPostImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto py-1">
              {newPostImages.map((img, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setNewPostImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/80 text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <label 
              onClick={(e) => {
                if (!currentUserId || !isValidUuid(currentUserId)) {
                  e.preventDefault();
                  onRequireAuth();
                }
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-[#D4AF37] cursor-pointer transition-colors"
            >
              <ImageIcon className="w-4 h-4 text-[#D4AF37]" />
              <span>{isUploadingPhoto ? 'Compression...' : 'Photo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={isUploadingPhoto}
                className="hidden"
              />
            </label>

            <button
              type="submit"
              disabled={isPublishing || !newPostContent.trim()}
              className="px-4 py-2 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50 min-h-[40px]"
            >
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isPublishing ? 'Envoi...' : 'Publier'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">
          Chargement du fil social...
        </div>
      ) : posts.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#131317] border border-zinc-800 text-center space-y-2">
          <MessageSquare className="w-8 h-8 text-[#D4AF37] mx-auto opacity-70" />
          <h4 className="text-sm font-bold text-white">Aucune publication pour le moment</h4>
          <p className="text-xs text-gray-400">
            Soyez le premier à partager une opportunité avec la communauté panafricaine !
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const isAuthor = currentUserId && post.user_id === currentUserId;
            const authorInitials = post.author?.full_name
              ? post.author.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
              : 'AB';

            return (
              <div
                key={post.id}
                className={`p-4 rounded-2xl bg-[#131317] border shadow-md space-y-3 transition-all duration-300 ${
                  post.id === newlyCreatedPostId
                    ? 'animate-fade-slide-up border-[#D4AF37] shadow-amber-500/10'
                    : 'border-zinc-800 hover:border-zinc-700/80'
                }`}
              >
                {/* Author & Menu */}
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-3">
                    {post.author?.avatar_url ? (
                      <img
                        src={post.author.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-[#D4AF37]/40 bg-zinc-900"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#D4AF37] to-[#F59E0B] text-black font-extrabold flex items-center justify-center text-xs">
                        {authorInitials}
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1">
                        <span>{post.author?.full_name || 'Membre'}</span>
                        {post.author?.phone_verified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                        )}
                      </h4>
                      <span className="text-[10px] text-gray-400">
                        {post.author?.city ? `${post.author.city} · ` : ''}
                        {new Date(post.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === post.id ? null : post.id)}
                      className="p-1 rounded-full text-gray-400 hover:text-white cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === post.id && (
                      <div className="absolute right-0 top-6 w-36 rounded-xl bg-[#1B1B22] border border-zinc-700 shadow-xl py-1 z-20 text-xs">
                        {isAuthor ? (
                          <>
                            <button
                              onClick={() => {
                                setEditingPostId(post.id);
                                setEditingPostContent(post.content);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-gray-200 hover:bg-zinc-800 flex items-center gap-1.5"
                            >
                              <Edit className="w-3.5 h-3.5 text-[#D4AF37]" />
                              <span>Modifier</span>
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-red-950/40 flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Supprimer</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setReportingPostId(post.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-gray-200 hover:bg-zinc-800 flex items-center gap-1.5"
                            >
                              <Flag className="w-3.5 h-3.5 text-amber-400" />
                              <span>Signaler</span>
                            </button>
                            <button
                              onClick={() => handleBlockAuthor(post.user_id)}
                              className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-red-950/40 flex items-center gap-1.5"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Bloquer l'auteur</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content / Edit Mode */}
                {editingPostId === post.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={editingPostContent}
                      onChange={(e) => setEditingPostContent(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#17171C] border border-zinc-700 text-xs text-white"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingPostId(null)}
                        className="px-3 py-1 rounded-lg bg-zinc-800 text-xs text-gray-300"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => handleSaveEditPost(post.id)}
                        className="px-3 py-1 rounded-lg bg-[#D4AF37] text-black font-bold text-xs"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs sm:text-sm text-gray-200 leading-relaxed whitespace-pre-line">
                      {(() => {
                        const hasFb = /\[FB_POST_ID:[^\]]+\]/.test(post.content) || /Publié par\s*:/i.test(post.content);
                        if (!hasFb) return post.content;
                        return post.content
                          .replace(/\[FB_POST_ID:[^\]]+\]/g, '')
                          .replace(/---\s*📢\s*Publié par[^\n]+/gi, '')
                          .replace(/🔗\s*Voir sur Facebook[^\n]+/gi, '')
                          .trim();
                      })()}
                    </p>

                    {/* Facebook Attribution */}
                    {(() => {
                      const pageMatch = post.content.match(/Publié par\s*:\s*([^\n\r]+)/i);
                      const urlMatch = post.content.match(/(?:Voir sur Facebook\s*:\s*|Lien Facebook\s*:\s*)(https?:\/\/[^\s\n\r]+)/i);
                      const hasFb = /\[FB_POST_ID:[^\]]+\]/.test(post.content) || pageMatch;
                      if (!hasFb) return null;

                      const pageName = pageMatch ? pageMatch[1].trim() : 'Page Facebook';
                      const fbUrl = urlMatch ? urlMatch[1].trim() : null;

                      return (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-[#1877F2]/10 border border-[#1877F2]/30 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-[#1877F2] text-white flex items-center justify-center shrink-0">
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                              </svg>
                            </div>
                            <span className="text-[11px] font-bold text-gray-200">
                              Publié par <strong className="text-white">{pageName}</strong>
                            </span>
                          </div>
                          {fbUrl && (
                            <a
                              href={fbUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-[10px] inline-flex items-center gap-1 shrink-0 transition-colors"
                            >
                              <span>Voir sur Facebook</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Post Images */}
                {post.images && post.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden">
                    {post.images.map((img, idx) => (
                      <div key={idx} className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
                        <img 
                          src={img} 
                          alt="Photo publication" 
                          className="w-full h-full object-cover" 
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Like & Comments Stats Bar */}
                <div className="flex items-center gap-4 pt-2 border-t border-zinc-800/80">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      post.is_liked ? 'text-[#D4AF37]' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${post.is_liked ? 'fill-current' : ''}`} />
                    <span>{post.likes_count}</span>
                  </button>

                  <button
                    onClick={() => handleToggleComments(post.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.comments_count} commentaires</span>
                  </button>
                </div>

                {/* Expanded Comments Section */}
                {expandedPostId === post.id && (
                  <div className="pt-3 border-t border-zinc-800/80 space-y-3">
                    {/* Add comment */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newCommentContent}
                        onChange={(e) => setNewCommentContent(e.target.value)}
                        placeholder="Écrire un commentaire..."
                        className="flex-1 px-3 py-2 rounded-xl bg-[#17171C] border border-zinc-700 text-base sm:text-xs text-white placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                      />
                      <button
                        onClick={() => handleCreateComment(post.id)}
                        disabled={!newCommentContent.trim()}
                        className="p-2 rounded-xl bg-[#D4AF37] text-black hover:bg-[#F59E0B] disabled:opacity-40 transition-colors"
                      >
                        <Send className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>

                    {/* Comments list */}
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {(commentsMap[post.id] || []).map((comment) => {
                        const isCommentAuthor = currentUserId && comment.user_id === currentUserId;
                        return (
                          <div
                            key={comment.id}
                            className={`p-2.5 rounded-xl bg-[#181820] text-xs space-y-1 transition-all duration-300 ${
                              comment.id === newlyCreatedCommentId
                                ? 'animate-comment-slide-in border border-[#D4AF37]/70 shadow-sm'
                                : 'border border-zinc-800/60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-200">
                                {comment.author?.full_name || 'Membre'}
                              </span>
                              {isCommentAuthor && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingCommentId(comment.id);
                                      setEditingCommentContent(comment.content);
                                    }}
                                    className="text-[10px] text-gray-400 hover:text-[#D4AF37]"
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    onClick={() => handleDeleteComment(post.id, comment.id)}
                                    className="text-[10px] text-gray-400 hover:text-red-400"
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              )}
                            </div>

                            {editingCommentId === comment.id ? (
                              <div className="space-y-1.5 pt-1">
                                <input
                                  type="text"
                                  value={editingCommentContent}
                                  onChange={(e) => setEditingCommentContent(e.target.value)}
                                  className="w-full px-2 py-1 rounded-lg bg-[#121216] border border-zinc-700 text-xs text-white"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => setEditingCommentId(null)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-zinc-800"
                                  >
                                    Annuler
                                  </button>
                                  <button
                                    onClick={() => handleSaveEditComment(post.id, comment.id)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-[#D4AF37] text-black font-bold"
                                  >
                                    Enregistrer
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-gray-300">{comment.content}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Report Modal */}
      {reportingPostId && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#141418] border border-zinc-800 p-5 text-white">
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-red-400">
              <Flag className="w-4 h-4" />
              <span>Signaler cette publication</span>
            </h4>
            {reportFeedback ? (
              <p className="text-xs text-[#D4AF37] py-4 text-center">{reportFeedback}</p>
            ) : (
              <div className="space-y-3">
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1A1A22] border border-zinc-700 text-xs text-white"
                >
                  <option value="Contenu inapproprié">Contenu inapproprié</option>
                  <option value="Arnaque ou escroquerie">Arnaque ou escroquerie</option>
                  <option value="Spam ou publicité abusive">Spam ou publicité abusive</option>
                  <option value="Harcèlement ou diffamation">Harcèlement ou diffamation</option>
                </select>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setReportingPostId(null)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSubmitReportPost}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-xs font-bold"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
