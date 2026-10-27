import React, { useState } from 'react';
import { X, ShieldCheck, FileText, AlertTriangle, Scale, CheckCircle2 } from 'lucide-react';
import officialLogoImg from '../assets/images/logo_afrique_business_1792378287169.jpg';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<'TERMS' | 'COMMUNITY' | 'PRIVACY' | 'FRAUD'>('TERMS');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl bg-[#141418] border border-zinc-800 shadow-2xl text-white max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-[#16161D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#D4AF37]/40 bg-black flex items-center justify-center shrink-0">
              <img
                src={officialLogoImg}
                alt="Afrique Business"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white">Afrique Business · Charte de Confiance</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37]">
                  Officiel
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Tout l'Afrique, un seul marché · Marketplace 100% gratuite
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-white bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center px-4 pt-3 pb-2 gap-2 border-b border-zinc-800 bg-[#181820] overflow-x-auto text-xs shrink-0 no-scrollbar">
          <button
            onClick={() => setActiveSection('TERMS')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeSection === 'TERMS'
                ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black shadow-md'
                : 'text-gray-400 hover:text-white bg-zinc-800/80'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Conditions Générales</span>
          </button>

          <button
            onClick={() => setActiveSection('COMMUNITY')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeSection === 'COMMUNITY'
                ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black shadow-md'
                : 'text-gray-400 hover:text-white bg-zinc-800/80'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Règles de la Communauté</span>
          </button>

          <button
            onClick={() => setActiveSection('PRIVACY')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeSection === 'PRIVACY'
                ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black shadow-md'
                : 'text-gray-400 hover:text-white bg-zinc-800/80'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Confidentialité & Données</span>
          </button>

          <button
            onClick={() => setActiveSection('FRAUD')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeSection === 'FRAUD'
                ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black shadow-md'
                : 'text-gray-400 hover:text-white bg-zinc-800/80'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Anti-Fraude & Sécurité</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-gray-300 leading-relaxed">
          {activeSection === 'TERMS' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-zinc-800">
                <h4 className="text-sm font-bold text-white mb-1.5 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#D4AF37]" />
                  <span>1. Objet et Gratuité de la Plateforme</span>
                </h4>
                <p>
                  Afrique Business est une plateforme panafricaine de mise en relation directe entre acheteurs et vendeurs pour le commerce de produits, véhicules, biens immobiliers et services. L'accès au service, le dépôt d'annonces et la mise en relation sont entièrement gratuits.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-zinc-800">
                <h4 className="text-sm font-bold text-white mb-1.5">2. Responsabilité des Annonceurs</h4>
                <p>
                  Chaque utilisateur certifie détenir les droits et la propriété des articles qu'il propose. Les photographies doivent refléter fidèlement l'état réel de l'objet (neuf ou occasion). La vente d'objets volés, de contrefaçons ou de produits illégaux est strictement bannie.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-zinc-800">
                <h4 className="text-sm font-bold text-white mb-1.5">3. Modalités des Transactions</h4>
                <p>
                  Les transactions sont conclues directement entre l'acheteur et le vendeur. Nous encourageons vivement les parties à convenir d'un rendez-vous dans un lieu public sécurisé pour inspecter le bien avant la remise des fonds.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'COMMUNITY' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-zinc-800 space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                  <span>Charte de Bonne Conduite Panafricaine</span>
                </h4>
                <p>
                  Notre communauté repose sur la confiance mutuelle, le respect et la fraternité panafricaine.
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-gray-300">
                  <li><strong>Courtoisie :</strong> Échangez toujours avec politesse dans les messages et les commentaires du fil social.</li>
                  <li><strong>Honnêteté sur l'état :</strong> Indiquez clairement si le produit est 100% neuf ou d'occasion avec ses éventuelles imperfections.</li>
                  <li><strong>Ponctualité :</strong> Honorez vos rendez-vous de remise en main propre.</li>
                  <li><strong>Pas de spam :</strong> Ne publiez pas plusieurs fois la même annonce dans la même catégorie.</li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'PRIVACY' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#1A1A22] border border-zinc-800 space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#D4AF37]" />
                  <span>Protection de la Vie Privée et des Données</span>
                </h4>
                <p>
                  Afrique Business s'engage à protéger l'intégrité de vos informations personnelles.
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-gray-300">
                  <li><strong>Contrôle du numéro de téléphone :</strong> Vous pouvez choisir qui a le droit de voir votre numéro (tout le monde, uniquement les membres connectés, ou personne).</li>
                  <li><strong>Suppression intégrale :</strong> Vous disposez de la fonction de suppression définitive de votre compte et de toutes vos annonces en un clic.</li>
                  <li><strong>Export de données :</strong> Vous pouvez télécharger l'ensemble de vos données au format JSON depuis les paramètres.</li>
                  <li><strong>Pas de revente :</strong> Vos coordonnées ne sont jamais vendues à des régies publicitaires tierces.</li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'FRAUD' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/50 space-y-2">
                <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#D4AF37]" />
                  <span>Conseils Clés de Sécurité pour vos Achats</span>
                </h4>
                <ul className="list-disc pl-5 space-y-2 text-gray-300">
                  <li><strong>Vérifiez avant de payer :</strong> N'envoyez jamais d'argent à l'avance à un inconnu sans avoir vu et testé le produit en personne.</li>
                  <li><strong>Lieux publics :</strong> Donnez rendez-vous dans un lieu éclairé et fréquenté (centre commercial, agence, station-service).</li>
                  <li><strong>Méfiez-vous des offres irréalistes :</strong> Un smartphone haut de gamme vendu au quart de son prix neuf cache souvent un piège.</li>
                  <li><strong>Signalez tout comportement suspect :</strong> Utilisez le bouton « Signaler » présent sur chaque annonce ou contactez immédiatement le support.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-zinc-800 bg-[#16161D] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 cursor-pointer shadow-md"
          >
            Compris et accepter
          </button>
        </div>
      </div>
    </div>
  );
};
