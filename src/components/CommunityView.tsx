import React, { useState, useEffect } from 'react';
import { 
  fetchPosts, createPost, updatePost, deletePost,
  fetchComments, createComment, updateComment, deleteComment,
  blockUser, submitReport, uploadWebpImage, subscribeToRealtime,
  PostData, CommentData
} from '../lib/supabaseData';
import { 
  MessageSquare, Send, ShieldCheck, MoreVertical, 
  Trash2, Edit, Flag, Ban, Image as ImageIcon, X, 
  Share2, Repeat2, ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isValidUuid } from '../lib/storage';
import { PostReactionsBar } from './social/PostReactionsBar';
import { PostReactorsModal } from './social/PostReactorsModal';
import { PostShareModal } from './social/PostShareModal';
import { 
  PostSocialStats, ReactorItem, fetchBatchSocialStats, 
  recordPostShare, REACTION_CONFIGS, ReactionType 
} from '../lib/socialApi';

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

  // Social Stats map (postId -> stats)
  const [socialStatsMap, setSocialStatsMap] = useState<Record<string, PostSocialStats>>({});

  // Reactors Modal State
  const [activeReactorsModal, setActiveReactorsModal] = useState<{
    postId: string;
    reactors: ReactorItem[];
    stats: PostSocialStats;
  } | null>(null);

  // Share Modal State
  const [sharingPost, setSharingPost] = useState<PostData | null>(null);

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

  // Fluid transition tracking
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
    try {
      const data = await fetchPosts(currentUserId);
      setPosts(data);

      // Load batch reactions & shares
      if (data.length > 0) {
        const postIds = data.map((p) => p.id);
        const stats = await fetchBatchSocialStats(postIds, currentUserId);
        setSocialStatsMap(stats);
      }
    } catch (err) {
      console.error('Error loading posts:', err);
    } finally {
      setLoading(false);
    }
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

  // Handle Share to Social Feed
  const handleExecuteShareToFeed = async (originalPost: PostData, commentary: string) => {
    const authUid = await getAuthUserId();
    if (!authUid) {
      onRequireAuth();
      return;
    }

    // Embed structured reference to original post
    const sharedData = {
      originalPostId: originalPost.id,
      originalAuthorName: originalPost.author?.full_name || 'Membre Afrique Business',
      originalAuthorAvatar: originalPost.author?.avatar_url,
      originalAuthorVerified: Boolean(originalPost.author?.phone_verified),
      originalAuthorCity: originalPost.author?.city,
      originalContent: originalPost.content,
      originalImages: originalPost.images || [],
      originalCreatedAt: originalPost.created_at,
    };

    const combinedContent = commentary.trim() 
      ? `${commentary.trim()}\n\n[SHARED_POST_DATA:${JSON.stringify(sharedData)}]`
      : `[SHARED_POST_DATA:${JSON.stringify(sharedData)}]`;

    // Create real post in Supabase
    const newPost = await createPost(authUid, combinedContent, []);

    // Record share in backend
    const shareRes = await recordPostShare(
      originalPost.id,
      authUid,
      'social_feed',
      commentary,
      newPost.id
    );

    // Optimistically increment share count
    if (shareRes) {
      setSocialStatsMap((prev) => {
        const existing = prev[originalPost.id];
        if (!existing) return prev;
        return {
          ...prev,
          [originalPost.id]: {
            ...existing,
            sharesCount: shareRes.sharesCount,
          },
        };
      });
    }

    await loadPosts();
    setNewlyCreatedPostId(newPost.id);
    setTimeout(() => setNewlyCreatedPostId(null), 3000);
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
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 pb-28 space-y-4 bg-[#F8F9FC] text-[#172033] min-h-screen">
      {/* Create Post Header Card */}
      <div className="p-4 rounded-2xl bg-white border border-[#E5E8EF] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#C69A35]"></span>
            <span>Fil Social Panafricain</span>
          </h3>
          <span className="text-[11px] font-medium text-[#596273]">
            Échanges, opportunités & commerçants
          </span>
        </div>

        <form onSubmit={handleCreatePost} className="space-y-3">
          <div className="flex items-start gap-3">
            {currentUserAvatar ? (
              <img
                src={currentUserAvatar}
                alt=""
                className="w-10 h-10 rounded-full object-cover border border-[#E5E8EF] shrink-0 mt-0.5"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#C69A35] to-[#E7C875] text-[#172033] font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                {currentUserName ? currentUserName[0].toUpperCase() : 'AB'}
              </div>
            )}

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
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-sm text-[#172033] placeholder-[#596273] focus:bg-white focus:border-[#C69A35] focus:outline-none transition-colors"
            />
          </div>

          {/* Attached Images preview */}
          {newPostImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto py-1 pl-13">
              {newPostImages.map((img, i) => (
                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#E5E8EF] shrink-0 shadow-xs">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setNewPostImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white hover:bg-black"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1 pl-0 sm:pl-13 border-t border-[#E5E8EF]/60">
            <label 
              onClick={(e) => {
                if (!currentUserId || !isValidUuid(currentUserId)) {
                  e.preventDefault();
                  onRequireAuth();
                }
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#596273] hover:text-[#C69A35] cursor-pointer transition-colors p-1.5 rounded-lg hover:bg-[#F8F9FC]"
            >
              <ImageIcon className="w-4 h-4 text-[#C69A35]" />
              <span>{isUploadingPhoto ? 'Compression...' : 'Ajouter une photo'}</span>
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
              className="px-4 py-2 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-bold hover:brightness-105 flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40 min-h-[38px] transition-all active:scale-95"
            >
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isPublishing ? 'Envoi...' : 'Publier'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#596273]">
          Chargement du fil social panafricain...
        </div>
      ) : posts.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white border border-[#E5E8EF] text-center space-y-2 shadow-xs">
          <MessageSquare className="w-8 h-8 text-[#C69A35] mx-auto opacity-70" />
          <h4 className="text-sm font-bold text-[#172033]">Aucune publication pour le moment</h4>
          <p className="text-xs text-[#596273]">
            Soyez le premier à partager une opportunité avec la communauté panafricaine !
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const isAuthor = currentUserId && post.user_id === currentUserId;
            const authorName = post.author?.full_name || 'Membre Afrique Business';
            const authorInitials = authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

            // Extract Shared Post metadata if present
            const sharedMatch = post.content.match(/\[SHARED_POST_DATA:([\s\S]+?)\]/);
            let sharedData: any = null;
            let displayContent = post.content;

            if (sharedMatch) {
              try {
                sharedData = JSON.parse(sharedMatch[1]);
                displayContent = post.content.replace(/\[SHARED_POST_DATA:[\s\S]+?\]/, '').trim();
              } catch (e) {
                console.warn('Error parsing shared post data:', e);
              }
            }

            // Fallback: cleanup facebook tags
            const hasFb = /\[FB_POST_ID:[^\]]+\]/.test(displayContent) || /Publié par\s*:/i.test(displayContent);
            if (hasFb) {
              displayContent = displayContent
                .replace(/\[FB_POST_ID:[^\]]+\]/g, '')
                .replace(/---\s*📢\s*Publié par[^\n]+/gi, '')
                .replace(/🔗\s*Voir sur Facebook[^\n]+/gi, '')
                .trim();
            }

            const postStats = socialStatsMap[post.id] || {
              postId: post.id,
              reactionsCount: post.likes_count,
              reactionBreakdown: { like: post.likes_count, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
              activeEmojis: post.likes_count > 0 ? (['like'] as ReactionType[]) : [],
              userReaction: post.is_liked ? 'like' : null,
              sharesCount: 0,
              recentReactors: [],
            };

            return (
              <article
                key={post.id}
                id={`post-${post.id}`}
                className={`p-4 rounded-2xl bg-white border shadow-xs space-y-3 transition-all duration-300 ${
                  post.id === newlyCreatedPostId
                    ? 'animate-fade-slide-up border-[#C69A35] shadow-md shadow-[#C69A35]/10'
                    : 'border-[#E5E8EF] hover:border-[#E5E8EF]'
                }`}
              >
                {/* Repost Header if Shared */}
                {sharedData && (
                  <div className="flex items-center gap-1.5 pb-2 border-b border-[#E5E8EF]/70 text-xs font-semibold text-[#596273]">
                    <Repeat2 className="w-3.5 h-3.5 text-[#C69A35]" />
                    <span>
                      Partagé par <strong className="text-[#172033]">{authorName}</strong>
                    </span>
                  </div>
                )}

                {/* Author Info & Dropdown Menu */}
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-3">
                    {post.author?.avatar_url ? (
                      <img
                        src={post.author.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-[#E5E8EF] bg-[#F1F4F9]"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#C69A35] to-[#E7C875] text-[#172033] font-bold flex items-center justify-center text-xs">
                        {authorInitials}
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-[#172033] flex items-center gap-1">
                        <span>{authorName}</span>
                        {post.author?.phone_verified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#C69A35]" />
                        )}
                      </h4>
                      <span className="text-[10px] text-[#596273]">
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

                  {/* Context Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === post.id ? null : post.id)}
                      className="p-1 rounded-full text-[#596273] hover:text-[#172033] hover:bg-[#F8F9FC] cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === post.id && (
                      <div className="absolute right-0 top-6 w-38 rounded-xl bg-white border border-[#E5E8EF] shadow-lg py-1 z-20 text-xs">
                        {isAuthor ? (
                          <>
                            <button
                              onClick={() => {
                                setEditingPostId(post.id);
                                setEditingPostContent(post.content);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-[#172033] hover:bg-[#F8F9FC] flex items-center gap-1.5"
                            >
                              <Edit className="w-3.5 h-3.5 text-[#C69A35]" />
                              <span>Modifier</span>
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-1.5"
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
                              className="w-full px-3 py-1.5 text-left text-[#172033] hover:bg-[#F8F9FC] flex items-center gap-1.5"
                            >
                              <Flag className="w-3.5 h-3.5 text-amber-500" />
                              <span>Signaler</span>
                            </button>
                            <button
                              onClick={() => handleBlockAuthor(post.user_id)}
                              className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-1.5"
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
                      className="w-full px-3 py-2 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF] text-xs text-[#172033] focus:bg-white focus:border-[#C69A35]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingPostId(null)}
                        className="px-3 py-1 rounded-lg bg-[#F1F4F9] text-xs text-[#596273] hover:text-[#172033]"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => handleSaveEditPost(post.id)}
                        className="px-3 py-1 rounded-lg bg-[#C69A35] text-[#172033] font-bold text-xs shadow-xs"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Primary text content */}
                    {displayContent && (
                      <p className="text-xs sm:text-sm text-[#172033] leading-relaxed whitespace-pre-line font-normal">
                        {displayContent}
                      </p>
                    )}

                    {/* EMBEDDED SHARED POST CARD */}
                    {sharedData && (
                      <div className="p-3.5 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF] space-y-2.5 shadow-xs">
                        {/* Original Author */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {sharedData.originalAuthorAvatar ? (
                              <img
                                src={sharedData.originalAuthorAvatar}
                                alt=""
                                className="w-8 h-8 rounded-full object-cover border border-[#E5E8EF]"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#C69A35] text-[#172033] font-bold text-[10px] flex items-center justify-center">
                                {sharedData.originalAuthorName[0]}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-[#172033]">
                                  {sharedData.originalAuthorName}
                                </span>
                                {sharedData.originalAuthorVerified && (
                                  <ShieldCheck className="w-3.5 h-3.5 text-[#C69A35]" />
                                )}
                              </div>
                              <span className="text-[10px] text-[#596273]">
                                {sharedData.originalCreatedAt
                                  ? new Date(sharedData.originalCreatedAt).toLocaleDateString('fr-FR', {
                                      day: 'numeric',
                                      month: 'short',
                                    })
                                  : 'Publication originale'}
                              </span>
                            </div>
                          </div>

                          <a
                            href={`#post-${sharedData.originalPostId}`}
                            className="text-[10px] font-bold text-[#C69A35] hover:underline flex items-center gap-1"
                          >
                            <span>Voir l'original</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        {/* Original Content */}
                        <p className="text-xs text-[#172033] leading-relaxed whitespace-pre-line">
                          {sharedData.originalContent}
                        </p>

                        {/* Original Images */}
                        {sharedData.originalImages && sharedData.originalImages.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden pt-1">
                            {sharedData.originalImages.map((img: string, idx: number) => (
                              <div
                                key={idx}
                                className="relative aspect-video bg-[#F1F4F9] rounded-lg overflow-hidden border border-[#E5E8EF]"
                              >
                                <img
                                  src={img}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Direct Post Images (if not already embedded in shared card) */}
                {!sharedData && post.images && post.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden pt-1">
                    {post.images.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-video bg-[#F1F4F9] rounded-lg overflow-hidden border border-[#E5E8EF]"
                      >
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

                {/* STATS COUNTERS ROW (Reactions, Comments, Shares) */}
                <div className="flex items-center justify-between pt-2 border-t border-[#E5E8EF] text-xs text-[#596273]">
                  {/* Left: Reactions detail */}
                  <div className="flex items-center gap-1.5">
                    {postStats.reactionsCount > 0 ? (
                      <button
                        onClick={() =>
                          setActiveReactorsModal({
                            postId: post.id,
                            reactors: postStats.recentReactors,
                            stats: postStats,
                          })
                        }
                        className="flex items-center gap-1 hover:text-[#172033] cursor-pointer"
                      >
                        <div className="flex -space-x-1 items-center">
                          {postStats.activeEmojis.slice(0, 3).map((type) => (
                            <span
                              key={type}
                              className="w-4 h-4 rounded-full bg-white flex items-center justify-center text-[10px] shadow-xs border border-[#E5E8EF]"
                            >
                              {REACTION_CONFIGS[type].emoji}
                            </span>
                          ))}
                        </div>
                        <span className="font-semibold text-[#172033] tabular-nums">
                          {postStats.reactionsCount}
                        </span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#596273]">0 réaction</span>
                    )}
                  </div>

                  {/* Right: Comments and Shares counters */}
                  <div className="flex items-center gap-3 text-[11px]">
                    <button
                      onClick={() => handleToggleComments(post.id)}
                      className="hover:text-[#172033] cursor-pointer"
                    >
                      <strong className="text-[#172033]">{post.comments_count}</strong>{' '}
                      commentaire{post.comments_count > 1 ? 's' : ''}
                    </button>

                    <span>·</span>

                    <button
                      onClick={() => setSharingPost(post)}
                      className="hover:text-[#172033] cursor-pointer"
                    >
                      <strong className="text-[#172033]">{postStats.sharesCount}</strong>{' '}
                      partage{postStats.sharesCount > 1 ? 's' : ''}
                    </button>
                  </div>
                </div>

                {/* INTERACTIVE ACTION BUTTONS: Reaction, Comment, Share */}
                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-[#E5E8EF]/80">
                  {/* 1. Facebook-style Reactions Button */}
                  <div className="flex justify-center">
                    <PostReactionsBar
                      postId={post.id}
                      currentUserId={currentUserId}
                      currentUserName={currentUserName}
                      currentUserAvatar={currentUserAvatar}
                      initialStats={postStats}
                      onRequireAuth={onRequireAuth}
                      onOpenReactorsModal={(reactors, stats) =>
                        setActiveReactorsModal({
                          postId: post.id,
                          reactors,
                          stats,
                        })
                      }
                    />
                  </div>

                  {/* 2. Comment Button */}
                  <button
                    onClick={() => handleToggleComments(post.id)}
                    className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold text-[#596273] hover:text-[#172033] hover:bg-[#F8F9FC] transition-colors cursor-pointer min-h-[38px]"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Commenter</span>
                  </button>

                  {/* 3. Share Button */}
                  <button
                    onClick={() => setSharingPost(post)}
                    className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold text-[#596273] hover:text-[#172033] hover:bg-[#F8F9FC] transition-colors cursor-pointer min-h-[38px]"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Partager</span>
                  </button>
                </div>

                {/* Expanded Comments Section */}
                {expandedPostId === post.id && (
                  <div className="pt-3 border-t border-[#E5E8EF] space-y-3">
                    {/* Add comment */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newCommentContent}
                        onChange={(e) => setNewCommentContent(e.target.value)}
                        placeholder="Écrire un commentaire..."
                        className="flex-1 px-3 py-2 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF] text-xs text-[#172033] placeholder-[#596273] focus:bg-white focus:border-[#C69A35] focus:outline-none"
                      />
                      <button
                        onClick={() => handleCreateComment(post.id)}
                        disabled={!newCommentContent.trim()}
                        className="p-2 rounded-xl bg-[#C69A35] text-[#172033] hover:brightness-105 disabled:opacity-40 transition-all shadow-xs cursor-pointer"
                      >
                        <Send className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>

                    {/* Comments list */}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {(commentsMap[post.id] || []).map((comment) => {
                        const isCommentAuthor = currentUserId && comment.user_id === currentUserId;
                        return (
                          <div
                            key={comment.id}
                            className={`p-2.5 rounded-xl bg-[#F8F9FC] text-xs space-y-1 transition-all duration-300 border border-[#E5E8EF] ${
                              comment.id === newlyCreatedCommentId
                                ? 'animate-comment-slide-in border-[#C69A35] shadow-xs'
                                : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#172033]">
                                {comment.author?.full_name || 'Membre'}
                              </span>
                              {isCommentAuthor && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingCommentId(comment.id);
                                      setEditingCommentContent(comment.content);
                                    }}
                                    className="text-[10px] text-[#596273] hover:text-[#C69A35]"
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    onClick={() => handleDeleteComment(post.id, comment.id)}
                                    className="text-[10px] text-[#596273] hover:text-red-600"
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
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#E5E8EF] text-xs text-[#172033]"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => setEditingCommentId(null)}
                                    className="px-2 py-0.5 rounded text-[10px] text-[#596273]"
                                  >
                                    Annuler
                                  </button>
                                  <button
                                    onClick={() => handleSaveEditComment(post.id, comment.id)}
                                    className="px-2 py-0.5 rounded bg-[#C69A35] text-[#172033] font-bold text-[10px]"
                                  >
                                    OK
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[#172033] leading-relaxed">{comment.content}</p>
                            )}

                            <span className="text-[9px] text-[#596273] block">
                              {new Date(comment.created_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* REACTORS MODAL */}
      {activeReactorsModal && (
        <PostReactorsModal
          isOpen={Boolean(activeReactorsModal)}
          onClose={() => setActiveReactorsModal(null)}
          reactors={activeReactorsModal.reactors}
          reactionBreakdown={activeReactorsModal.stats.reactionBreakdown}
          totalCount={activeReactorsModal.stats.reactionsCount}
        />
      )}

      {/* SHARE MODAL */}
      {sharingPost && (
        <PostShareModal
          isOpen={Boolean(sharingPost)}
          onClose={() => setSharingPost(null)}
          post={sharingPost}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
          onShareToFeed={(commentary) => handleExecuteShareToFeed(sharingPost, commentary)}
          onExternalShareRecord={(type) => {
            if (currentUserId) {
              recordPostShare(sharingPost.id, currentUserId, type as any);
              setSocialStatsMap((prev) => {
                const existing = prev[sharingPost.id];
                if (!existing) return prev;
                return {
                  ...prev,
                  [sharingPost.id]: {
                    ...existing,
                    sharesCount: existing.sharesCount + 1,
                  },
                };
              });
            }
          }}
        />
      )}

      {/* REPORT POST MODAL */}
      {reportingPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-[#E5E8EF] p-4 space-y-3 shadow-xl text-[#172033]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#172033] flex items-center gap-1.5">
                <Flag className="w-4 h-4 text-amber-500" />
                <span>Signaler cette publication</span>
              </h4>
              <button onClick={() => setReportingPostId(null)} className="text-[#596273] hover:text-[#172033]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportFeedback ? (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold text-center">
                {reportFeedback}
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF] text-xs text-[#172033]"
                >
                  <option value="Contenu inapproprié">Contenu inapproprié</option>
                  <option value="Arnaque ou fraude">Arnaque ou fraude</option>
                  <option value="Harcèlement ou propos haineux">Harcèlement ou propos haineux</option>
                  <option value="Fausse opportunité ou spam">Fausse opportunité ou spam</option>
                </select>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setReportingPostId(null)}
                    className="px-3 py-1.5 rounded-lg text-xs text-[#596273] hover:text-[#172033]"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSubmitReportPost}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs"
                  >
                    Signaler
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
