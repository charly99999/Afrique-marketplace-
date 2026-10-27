// Supabase Edge Function: import-facebook (Projet BUSINESS)
// Runtime: Deno / TypeScript
//
// Lit les publications de la page Facebook officielle via l'API Graph v26.0,
// par lot de 5 (limit=5), mémorise le curseur de pagination pour reprendre au prochain appel,
// applique une déduplication absolue (ne jamais renvoyer une publication déjà existante),
// exclut intelligemment toutes les publications contenant de la musique ou des vidéos,
// et ne supprime JAMAIS les publications existantes.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function scrubToken(text: string, token?: string): string {
  if (!text) return "";
  let clean = String(text);
  if (token && token.length > 5) {
    clean = clean.split(token).join("[JETON_MASQUÉ]");
  }
  clean = clean.replace(/access_token=[a-zA-Z0-9%_-]+/gi, "access_token=[JETON_MASQUÉ]");
  clean = clean.replace(/EA[A-Za-z0-9_-]{20,}/g, "[JETON_MASQUÉ]");
  return clean;
}

// Détection intelligente Musique et Vidéos
function isMediaVideoOrMusic(post: {
  id?: string;
  message?: string;
  status_type?: string;
  attachments?: {
    data?: Array<{
      media_type?: string;
      type?: string;
      title?: string;
      description?: string;
      unshimmed_url?: string;
    }>;
  };
}): { isVideoOrMusic: boolean; reason?: string } {
  const statusType = String(post.status_type || "").toLowerCase();
  if (statusType.includes("video") || statusType.includes("live")) {
    return { isVideoOrMusic: true, reason: `Format vidéo Facebook (${statusType})` };
  }

  const attList = post.attachments?.data || [];
  for (const att of attList) {
    const mediaType = String(att.media_type || "").toLowerCase();
    const type = String(att.type || "").toLowerCase();
    const url = String(att.unshimmed_url || "").toLowerCase();

    if (mediaType.includes("video") || type.includes("video")) {
      return { isVideoOrMusic: true, reason: "Pièce jointe vidéo détectée" };
    }
    if (
      mediaType.includes("music") ||
      mediaType.includes("audio") ||
      type.includes("music") ||
      type.includes("audio") ||
      type.includes("song")
    ) {
      return { isVideoOrMusic: true, reason: "Pièce jointe audio ou musicale détectée" };
    }
    if (
      url.includes("youtube.com") ||
      url.includes("youtu.be") ||
      url.includes("tiktok.com") ||
      url.includes("spotify.com") ||
      url.includes("deezer.com") ||
      url.includes("audiomack.com") ||
      url.includes("soundcloud.com") ||
      url.includes("boomplay.com") ||
      url.includes("music.apple.com") ||
      url.includes("fb.watch") ||
      url.includes("facebook.com/reel")
    ) {
      return { isVideoOrMusic: true, reason: "Lien vidéo ou streaming musical détecté" };
    }
  }

  const text = (post.message || "").toLowerCase();
  if (!text) return { isVideoOrMusic: false };

  if (
    /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|tiktok\.com|spotify\.com|deezer\.com|audiomack\.com|soundcloud\.com|boomplay\.com|music\.apple\.com|fb\.watch|facebook\.com\/reel)/i.test(
      text
    )
  ) {
    return { isVideoOrMusic: true, reason: "Lien vidéo ou musique présent dans la publication" };
  }

  const musicPatterns = [
    /\b(?:nouveau\s+single|nouvel\s+album|nouveau\s+morceau|nouvelle\s+chanson|clip\s+officiel|nouveau\s+clip)\b/i,
    /\b(?:morceau\s+disponible|single\s+disponible|album\s+disponible|son\s+disponible|titre\s+disponible)\b/i,
    /\b(?:sur\s+toutes\s+les\s+plateformes|disponible\s+en\s+streaming|streamer\s+le\s+morceau|lien\s+d'écoute)\b/i,
    /\b(?:audiomack|spotify|deezer|boomplay|apple\s+music|soundcloud)\b/i,
    /\b(?:prod\s+by|beatmaker|freestyle\s+vidéo|freestyle\s+officiel|feat\.|featuring)\b/i,
    /\b(?:chanteur|chanteuse|artiste\s+musicien|rap\s+ivoire|afrobeats?|coupé\s*décalé)\b/i,
  ];

  for (const pat of musicPatterns) {
    if (pat.test(text)) {
      return { isVideoOrMusic: true, reason: "Contenu musical identifié (single, album, clip ou streaming)" };
    }
  }

  const videoPatterns = [
    /\b(?:regardez\s+la\s+vidéo|regarder\s+la\s+vidéo|voir\s+la\s+vidéo|visionnez\s+la\s+vidéo)\b/i,
    /\b(?:vidéo\s+officielle|video\s+officielle|clip\s+vidéo|court-métrage)\b/i,
    /\b(?:reels?|tiktok|chaine\s+youtube|chaîne\s+youtube|abonne-toi\s+à\s+la\s+chaîne)\b/i,
    /\b(?:en\s+direct\s+live|facebook\s+live|live\s+facebook|direct\s+vidéo)\b/i,
  ];

  for (const pat of videoPatterns) {
    if (pat.test(text)) {
      return { isVideoOrMusic: true, reason: "Contenu vidéo identifié (clip, reel, live ou vidéo Youtube/Facebook)" };
    }
  }

  return { isVideoOrMusic: false };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Trouver l'utilisateur admin (Marc Arnaud) et charger sa configuration enregistrée en base
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const adminUser = usersData?.users?.find(
      (u: any) =>
        u.email === "marcarnaudkonan2@gmail.com" ||
        u.user_metadata?.full_name?.toLowerCase().includes("marc") ||
        u.phone?.includes("2250565242349")
    ) || usersData?.users?.[0];

    const adminUserId = adminUser?.id || "d2882463-6bcf-414a-8844-6c06279e50e0";
    const dbConfig = adminUser?.user_metadata?.facebook_config || {};

    const pageId = String(dbConfig.pageId || Deno.env.get("FACEBOOK_PAGE_ID") || "").trim();
    const pageToken = String(dbConfig.pageToken || Deno.env.get("FACEBOOK_PAGE_TOKEN") || "").trim();
    const pageName = String(dbConfig.pageName || Deno.env.get("FACEBOOK_PAGE_NAME") || "Afrique Business Officiel").trim();
    const cursor = dbConfig.paginationCursor || null;

    if (!pageId || !pageToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Identifiant de Page (PAGE_ID) ou Jeton d'accès (PAGE_TOKEN) manquant. Veuillez enregistrer la configuration dans l'espace Admin.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 2. Appel de l'API Graph officielle v26.0 (limit=5 + champs pour détection vidéo/musique)
    let graphUrl = `https://graph.facebook.com/v26.0/${encodeURIComponent(pageId)}/posts?fields=id,message,full_picture,created_time,permalink_url,status_type,attachments{media_type,type,title,description,unshimmed_url}&limit=5`;
    if (cursor) {
      graphUrl += `&after=${encodeURIComponent(cursor)}`;
    }

    const fbRes = await fetch(graphUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${pageToken}`,
        Accept: "application/json",
      },
    });

    const fbData = await fbRes.json();
    if (!fbRes.ok || fbData.error) {
      const fbErr = fbData.error || {};
      const errCode = fbErr.code ?? "inconnu";
      const subCode = fbErr.error_subcode ? ` / Sous-code ${fbErr.error_subcode}` : "";
      const errType = fbErr.type ? ` (${fbErr.type})` : "";
      const rawMsg = fbErr.message || "Erreur Graph API";

      const cleanMsg = scrubToken(rawMsg, pageToken);
      const exactErrorMsg = `Facebook Graph API [Code ${errCode}${subCode}${errType}] : ${cleanMsg}`;

      return new Response(
        JSON.stringify({
          success: false,
          error: exactErrorMsg,
          code: errCode,
          subcode: fbErr.error_subcode,
          facebook_message: cleanMsg,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Mémoriser le curseur de pagination
    let nextCursor: string | null = (fbData.paging?.next && fbData.paging?.cursors?.after) ? fbData.paging.cursors.after : null;
    if ((!fbData.data || fbData.data.length === 0) && cursor) {
      nextCursor = null;
    }

    if (adminUser) {
      try {
        await supabase.auth.admin.updateUserById(adminUserId, {
          user_metadata: {
            ...adminUser.user_metadata,
            facebook_config: {
              ...dbConfig,
              paginationCursor: nextCursor,
              lastSyncAt: new Date().toISOString(),
            },
          },
        });
      } catch (saveErr) {
        console.warn("Échec sauvegarde curseur:", saveErr);
      }
    }

    const posts = Array.isArray(fbData.data) ? fbData.data : [];

    // Déduplication absolue avec la base de données : ne JAMAIS réimporter une publication existante
    const importedIds = new Set<string>();
    try {
      const { data: existingListings } = await supabase
        .from("listings")
        .select("description")
        .ilike("description", "%[FB_POST_ID:%")
        .limit(1000);

      if (existingListings) {
        for (const l of existingListings) {
          const match = l.description?.match(/\[FB_POST_ID:([a-zA-Z0-9_]+)\]/);
          if (match && match[1]) importedIds.add(match[1]);
        }
      }

      const { data: existingPosts } = await supabase
        .from("posts")
        .select("content")
        .ilike("content", "%[FB_POST_ID:%")
        .limit(1000);

      if (existingPosts) {
        for (const p of existingPosts) {
          const match = p.content?.match(/\[FB_POST_ID:([a-zA-Z0-9_]+)\]/);
          if (match && match[1]) importedIds.add(match[1]);
        }
      }
    } catch (dedupErr) {
      console.warn("Erreur déduplication:", dedupErr);
    }

    let importedListings = 0;
    let importedSocialPosts = 0;
    let ignored = 0;
    let drafts = 0;
    let errors = 0;

    for (const post of posts) {
      if (!post.id) continue;

      // 1. Déduplication stricte : si déjà présent dans l'application, on ignore
      if (importedIds.has(post.id)) {
        ignored++;
        continue;
      }

      // 2. Exclusion des vidéos et musiques ("les publications avec les musiques et vidéos n'envoie pas.. soit intelligente.")
      const mediaCheck = isMediaVideoOrMusic(post);
      if (mediaCheck.isVideoOrMusic) {
        ignored++;
        importedIds.add(post.id);
        continue;
      }

      const rawText = (post.message || "").trim();
      if (!rawText && !post.full_picture) {
        ignored++;
        importedIds.add(post.id);
        continue;
      }

      const permalink = post.permalink_url || `https://www.facebook.com/${post.id}`;

      try {
        const processPromise = (async () => {
          let decision: "listing" | "social_post" = "listing";
          let title = rawText.split("\n")[0]?.slice(0, 60) || "Article Facebook";
          let description = rawText;
          let price: number | null = null;
          let category = "autres";
          let city = "Abidjan";
          let contactPhone: string | null = null;
          let condition: "neuf" | "occasion" = "occasion";

          // Détection prix FCFA
          const priceMatch = rawText.match(/(\d[\d\s.,]{2,10})\s*(?:fcfa|f\s*cfa|cfa|frs|f\b)/i);
          if (priceMatch) {
            const num = parseInt(priceMatch[1].replace(/[^\d]/g, ""), 10);
            if (!isNaN(num) && num > 100) price = num;
          }

          // Détection téléphone
          const phoneMatch = rawText.match(/(?:\+?225\s*)?[0-9]{2}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}/);
          if (phoneMatch) {
            contactPhone = phoneMatch[0].replace(/[^\d+]/g, "");
          }

          // Détection catégorie
          const lower = rawText.toLowerCase();
          if (/voiture|véhicule|toyota|mercedes|moto|scooter|camion/i.test(lower)) category = "vehicules";
          else if (/villa|appartement|terrain|maison|parcelle|duplex|studio/i.test(lower)) category = "immobilier";
          else if (/iphone|samsung|téléphone|ordinateur|tv|playstation|laptop/i.test(lower)) category = "electronique";
          else if (/robe|chaussure|costume|sac|mode|montre|perruque/i.test(lower)) category = "mode";
          else if (/emploi|recrutement|cherche|stage|candidature/i.test(lower)) category = "emplois";
          else if (/service|plomberie|peinture|déménagement|réparation/i.test(lower)) category = "services";

          const isCommercial = Boolean(price || /à vendre|disponible|prix|vente|stock/i.test(lower));
          if (!isCommercial) {
            decision = "social_post";
          }

          if (decision === "listing") {
            const isDraft = !price || category === "autres";
            const dbStatus = isDraft ? "paused" : "active";

            const formattedDesc = `${description}

---
📢 Publié par : ${pageName}
🔗 Voir sur Facebook : ${permalink}
[FB_POST_ID:${post.id}]`;

            // Ne jamais supprimer, uniquement insérer les nouveaux
            await supabase.from("listings").insert({
              user_id: adminUserId,
              title: title.trim(),
              category,
              description: formattedDesc,
              price: price || 0,
              currency: "XOF",
              condition,
              country: "CI",
              city,
              images: post.full_picture ? [post.full_picture] : [],
              contact_phone: contactPhone,
              whatsapp_phone: contactPhone,
              status: dbStatus,
            });

            if (isDraft) drafts++;
            else importedListings++;
            importedIds.add(post.id);
          } else {
            const formattedContent = `${rawText}

---
📢 Publié par : ${pageName}
🔗 Voir sur Facebook : ${permalink}
[FB_POST_ID:${post.id}]`;

            await supabase.from("posts").insert({
              user_id: adminUserId,
              content: formattedContent,
              images: post.full_picture ? [post.full_picture] : [],
            });

            importedSocialPosts++;
            importedIds.add(post.id);
          }
        })();

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Délai d'analyse de 20s dépassé")), 20000)
        );

        await Promise.race([processPromise, timeoutPromise]);
      } catch (errPost: any) {
        errors++;
        console.warn(`[import-facebook] Échec sur publication ${post.id}:`, errPost?.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedListings + importedSocialPosts,
        importedListings,
        importedSocialPosts,
        ignored,
        drafts,
        errors,
        hasMore: Boolean(nextCursor),
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Erreur interne" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
