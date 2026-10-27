import React, { useState } from 'react';
import { CategoryKey, CATEGORIES_LIST, CategoryGoldIcon, getCategoryItem } from '../data/categories';
import { Search, X, ArrowLeft, Check, Sparkles } from 'lucide-react';

interface CategorySelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategory?: CategoryKey;
  selectedSubcategory?: string;
  onSelect: (category: CategoryKey, subcategory?: string) => void;
}

export const CategorySelectModal: React.FC<CategorySelectModalProps> = ({
  isOpen,
  onClose,
  selectedCategory,
  selectedSubcategory = '',
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentStep, setCurrentStep] = useState<'category' | 'subcategory'>('category');
  const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(selectedCategory || null);
  const [customSubcategory, setCustomSubcategory] = useState(selectedSubcategory || '');

  if (!isOpen) return null;

  const filteredCategories = CATEGORIES_LIST.filter((cat) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const matchLabel = cat.label.toLowerCase().includes(q);
    const matchDesc = cat.description.toLowerCase().includes(q);
    const matchSubs = cat.subcategories.some((s) => s.toLowerCase().includes(q));
    return matchLabel || matchDesc || matchSubs;
  });

  const recommendedCategories = filteredCategories.filter((c) => c.isRecommended);
  const otherCategories = filteredCategories.filter((c) => !c.isRecommended);

  const activeCategoryItem = activeCategory ? getCategoryItem(activeCategory) : undefined;

  const handlePickCategory = (catId: CategoryKey) => {
    setActiveCategory(catId);
    setCurrentStep('subcategory');
  };

  const handleConfirmSubcategory = (subcat: string) => {
    if (!activeCategory) return;
    onSelect(activeCategory, subcat.trim() || undefined);
    onClose();
    setCurrentStep('category');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-[#141418] border border-zinc-800 shadow-2xl text-white flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {currentStep === 'subcategory' && (
              <button
                onClick={() => setCurrentStep('category')}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-gray-300 hover:text-white transition-colors cursor-pointer"
                title="Retour aux catégories"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h3 className="text-base font-extrabold text-white">
                {currentStep === 'category' ? 'Choisir une catégorie' : 'Préciser la sous-catégorie'}
              </h3>
              <p className="text-[11px] text-gray-400">
                {currentStep === 'category'
                  ? 'Sélectionnez la catégorie adaptée à votre annonce'
                  : `Catégorie : ${activeCategoryItem?.label || ''}`}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              setCurrentStep('category');
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: CATEGORY SELECTION */}
        {currentStep === 'category' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Input */}
            <div className="p-3.5 border-b border-zinc-800 bg-[#16161C]">
              <div className="relative">
                <Search className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher une catégorie..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-700 bg-[#101014] text-xs text-white placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Section: Recommandé */}
              {!searchTerm.trim() && recommendedCategories.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Recommandé</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {recommendedCategories.map((cat) => {
                      const isSelected = activeCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => handlePickCategory(cat.id)}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer group min-h-[96px] ${
                            isSelected
                              ? 'bg-amber-950/40 border-[#D4AF37] shadow-md shadow-amber-500/10'
                              : 'bg-[#181820] border-zinc-800 hover:border-[#D4AF37]/50 hover:bg-[#1E1E28]'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-lg bg-black/60 border border-[#D4AF37]/40 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                            <CategoryGoldIcon category={cat.id} className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block group-hover:text-[#D4AF37] transition-colors">
                              {cat.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section: Toutes les catégories */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  {searchTerm.trim() ? 'Résultats de recherche' : 'Toutes les catégories'}
                </span>

                <div className="divide-y divide-zinc-800/80 rounded-2xl bg-[#181820] border border-zinc-800 overflow-hidden">
                  {(searchTerm.trim() ? filteredCategories : otherCategories).map((cat) => {
                    const isSelected = activeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handlePickCategory(cat.id)}
                        className={`w-full p-3.5 flex items-center justify-between transition-colors cursor-pointer text-left ${
                          isSelected ? 'bg-amber-950/40 text-[#D4AF37]' : 'hover:bg-zinc-800/50 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-black/60 border border-[#D4AF37]/40 flex items-center justify-center shrink-0">
                            <CategoryGoldIcon category={cat.id} className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">{cat.label}</span>
                            <span className="text-[11px] text-gray-400 line-clamp-1">{cat.description}</span>
                          </div>
                        </div>

                        {isSelected && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
                      </button>
                    );
                  })}

                  {filteredCategories.length === 0 && (
                    <div className="p-8 text-center text-xs text-gray-400">
                      Aucune catégorie trouvée pour « {searchTerm} ».
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: SUBCATEGORY SELECTION */}
        {currentStep === 'subcategory' && activeCategoryItem && (
          <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
            {/* Active category pill */}
            <div className="p-3 rounded-xl bg-[#181820] border border-[#D4AF37]/40 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-black/60 border border-[#D4AF37]/50 flex items-center justify-center shrink-0">
                <CategoryGoldIcon category={activeCategoryItem.id} className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="text-xs font-extrabold text-[#D4AF37] block">
                  {activeCategoryItem.label}
                </span>
                <span className="text-[11px] text-gray-400 block">{activeCategoryItem.description}</span>
              </div>
            </div>

            {/* Subcategory suggestions chips */}
            <div className="space-y-2 flex-1 overflow-y-auto">
              <label className="text-xs font-bold text-gray-300 block">
                Sélectionnez une sous-catégorie fréquente :
              </label>

              <div className="flex flex-wrap gap-2">
                {activeCategoryItem.subcategories.map((sub) => {
                  const isChosen = customSubcategory === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => {
                        setCustomSubcategory(sub);
                        handleConfirmSubcategory(sub);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isChosen
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold shadow-md'
                          : 'bg-[#181820] hover:bg-zinc-800 text-gray-200 border-zinc-700 hover:border-[#D4AF37]/50'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>

              {/* Free text custom subcategory */}
              <div className="pt-3 border-t border-zinc-800 space-y-2">
                <label className="text-xs font-bold text-gray-300 block">
                  Ou écrivez une sous-catégorie personnalisée :
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSubcategory}
                    onChange={(e) => setCustomSubcategory(e.target.value)}
                    placeholder="Ex: Pièces moteur, Meubles en teck..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#181820] text-xs text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleConfirmSubcategory(customSubcategory)}
                    className="px-4 py-2.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-extrabold hover:brightness-110 cursor-pointer shadow-md"
                  >
                    Valider
                  </button>
                </div>
              </div>
            </div>

            {/* Quick validate without subcategory */}
            <div className="pt-2 border-t border-zinc-800 flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => setCurrentStep('category')}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                Changer de catégorie
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSubcategory('')}
                className="text-[#D4AF37] hover:underline font-semibold cursor-pointer"
              >
                Continuer sans sous-catégorie →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
