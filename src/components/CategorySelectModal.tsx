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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-[#E5E8EF] shadow-2xl text-[#172033] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#E5E8EF] flex items-center justify-between bg-[#F8F9FC]">
          <div className="flex items-center gap-2.5">
            {currentStep === 'subcategory' && (
              <button
                onClick={() => setCurrentStep('category')}
                className="p-1.5 rounded-lg bg-white hover:bg-gray-100 text-[#596273] hover:text-[#172033] border border-[#E5E8EF] transition-colors cursor-pointer"
                title="Retour aux catégories"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h3 className="text-base font-extrabold text-[#172033]">
                {currentStep === 'category' ? 'Choisir une catégorie' : 'Préciser la sous-catégorie'}
              </h3>
              <p className="text-[11px] text-[#596273]">
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
            className="p-1.5 rounded-lg text-[#596273] hover:text-[#172033] hover:bg-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: CATEGORY SELECTION */}
        {currentStep === 'category' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Input */}
            <div className="p-3.5 border-b border-[#E5E8EF] bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-[#C69A35] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher une catégorie..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-xs text-[#172033] placeholder-gray-400 focus:border-[#C69A35] focus:bg-white focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Section: Recommandé */}
              {!searchTerm.trim() && recommendedCategories.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#A27B20] uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-[#C69A35]" />
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
                              ? 'bg-amber-50/80 border-[#C69A35] shadow-xs'
                              : 'bg-white border-[#E5E8EF] hover:border-[#C69A35]/50 hover:bg-[#F8F9FC]'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                            <CategoryGoldIcon categoryKey={cat.id} className="w-5 h-5 text-[#C69A35]" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#172033] block group-hover:text-[#C69A35] transition-colors">
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
                <span className="text-xs font-bold text-[#596273] uppercase tracking-wider block">
                  {searchTerm.trim() ? 'Résultats de recherche' : 'Toutes les catégories'}
                </span>

                <div className="divide-y divide-[#E5E8EF] rounded-2xl bg-white border border-[#E5E8EF] overflow-hidden shadow-xs">
                  {(searchTerm.trim() ? filteredCategories : otherCategories).map((cat) => {
                    const isSelected = activeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handlePickCategory(cat.id)}
                        className={`w-full p-3.5 flex items-center justify-between transition-colors cursor-pointer text-left ${
                          isSelected ? 'bg-amber-50/60 text-[#C69A35]' : 'hover:bg-[#F8F9FC] text-[#172033]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                            <CategoryGoldIcon categoryKey={cat.id} className="w-5 h-5 text-[#C69A35]" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#172033] block">{cat.label}</span>
                            <span className="text-[11px] text-[#596273] line-clamp-1">{cat.description}</span>
                          </div>
                        </div>

                        {isSelected && <Check className="w-4 h-4 text-[#C69A35] shrink-0" />}
                      </button>
                    );
                  })}

                  {filteredCategories.length === 0 && (
                    <div className="p-8 text-center text-xs text-[#596273]">
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
            <div className="p-3 rounded-xl bg-amber-50/70 border border-[#C69A35]/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100/80 border border-[#C69A35]/40 flex items-center justify-center shrink-0">
                <CategoryGoldIcon categoryKey={activeCategoryItem.id} className="w-5 h-5 text-[#C69A35]" />
              </div>
              <div className="flex-1">
                <span className="text-xs font-extrabold text-[#A27B20] block">
                  {activeCategoryItem.label}
                </span>
                <span className="text-[11px] text-[#596273] block">{activeCategoryItem.description}</span>
              </div>
            </div>

            {/* Subcategory suggestions chips */}
            <div className="space-y-2 flex-1 overflow-y-auto">
              <label className="text-xs font-bold text-[#172033] block">
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
                          ? 'bg-[#C69A35] text-white border-[#C69A35] font-bold shadow-xs'
                          : 'bg-white hover:bg-[#F8F9FC] text-[#172033] border-[#E5E8EF] hover:border-[#C69A35]/50'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>

              {/* Free text custom subcategory */}
              <div className="pt-3 border-t border-[#E5E8EF] space-y-2">
                <label className="text-xs font-bold text-[#172033] block">
                  Ou écrivez une sous-catégorie personnalisée :
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSubcategory}
                    onChange={(e) => setCustomSubcategory(e.target.value)}
                    placeholder="Ex: Pièces moteur, Meubles en teck..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#E5E8EF] bg-[#F8F9FC] text-xs text-[#172033] placeholder-gray-400 focus:border-[#C69A35] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleConfirmSubcategory(customSubcategory)}
                    className="px-4 py-2.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-extrabold hover:brightness-105 cursor-pointer shadow-xs"
                  >
                    Valider
                  </button>
                </div>
              </div>
            </div>

            {/* Quick validate without subcategory */}
            <div className="pt-2 border-t border-[#E5E8EF] flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => setCurrentStep('category')}
                className="text-[#596273] hover:text-[#172033] cursor-pointer"
              >
                Changer de catégorie
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSubcategory('')}
                className="text-[#C69A35] hover:underline font-bold cursor-pointer"
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
