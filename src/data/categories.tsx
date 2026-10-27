import React from 'react';

export type CategoryKey =
  | 'vehicules'
  | 'immobilier'
  | 'electronique'
  | 'maison'
  | 'mode'
  | 'beaute'
  | 'bebes-enfants'
  | 'animaux'
  | 'alimentation-agriculture'
  | 'emplois'
  | 'services'
  | 'entreprise-industrie'
  | 'loisirs'
  | 'education'
  | 'autres'
  | 'produits'; // Alias compatibilité

export interface CategoryItem {
  id: CategoryKey;
  label: string;
  description: string;
  isRecommended?: boolean;
  subcategories: string[];
}

export const CATEGORIES_LIST: CategoryItem[] = [
  {
    id: 'vehicules',
    label: 'Véhicules',
    description: 'Voitures, motos, camions, pièces détachées et engins',
    isRecommended: true,
    subcategories: [
      'Voitures',
      'Motos & Scooters',
      'Camions & Engins lourds',
      'Pièces détachées & Accessoires',
      'Tricycles & Tuk-Tuk',
      'Vélos & Trottinettes',
      'Location de véhicules',
      'Bateaux & Nautisme',
    ],
  },
  {
    id: 'immobilier',
    label: 'Immobilier',
    description: 'Appartements, villas, terrains, bureaux et magasins',
    isRecommended: true,
    subcategories: [
      'Appartements à louer',
      'Villas & Maisons à vendre',
      'Terrains & Parcelles avec ACD',
      'Bureaux & Espaces commerciaux',
      'Magasins & Boutiques',
      'Résidences meublées & Courte durée',
      'Colocation',
      'Entrepôts & Hangars',
    ],
  },
  {
    id: 'electronique',
    label: 'Électronique',
    description: 'Smartphones, ordinateurs, TV, son et appareils connectés',
    isRecommended: true,
    subcategories: [
      'Smartphones (iPhone, Samsung...)',
      'Ordinateurs portables & PC',
      'Téléviseurs & Écrans plats',
      'Tablettes & Liseuses',
      'Consoles & Jeux vidéo',
      'Son, Écouteurs & Enceintes',
      'Appareils photo & Drones',
      'Accessoires téléphonie & chargeurs',
    ],
  },
  {
    id: 'maison',
    label: 'Maison et Meubles',
    description: 'Salons, lits, décoration, électroménager et bricolage',
    subcategories: [
      'Salons & Fauteuils',
      'Lits, Matelas & Literie',
      'Réfrigérateurs & Congélateurs',
      'Cuisinières & Fours',
      'Climatiseurs & Ventilateurs',
      'Tables, Chaises & Meubles TV',
      'Décoration & Luminaires',
      'Bricolage & Jardinage',
    ],
  },
  {
    id: 'mode',
    label: 'Mode',
    description: 'Vêtements, chaussures, pagnes, sacs et accessoires',
    subcategories: [
      'Vêtements Homme',
      'Vêtements Femme',
      'Chaussures & Baskets',
      'Tissus, Pagnes & Wax',
      'Sacs à main & Valises',
      'Montres & Bijoux',
      'Lunettes & Accessoires',
      'Costumes & Tenues de soirée',
    ],
  },
  {
    id: 'beaute',
    label: 'Beauté et soins',
    description: 'Parfums, cosmétiques, soins de la peau et coiffure',
    subcategories: [
      'Parfums & Eaux de toilette',
      'Soins du visage & Peau',
      'Maquillage & Onglerie',
      'Mèches, Perruques & Soins capillaires',
      'Produits de bain & Savons artisanaux',
      'Matériel de coiffure & Esthétique',
      'Bien-être & Massages',
    ],
  },
  {
    id: 'bebes-enfants',
    label: 'Bébés et Enfants',
    description: 'Vêtements, poussettes, jouets et matériel de puériculture',
    subcategories: [
      'Vêtements bébé & Naissance',
      'Vêtements fille & garçon',
      'Poussettes, Sièges auto & Porte-bébés',
      'Lits bébé, Berceaux & Parcs',
      'Jouets, Peluches & Éveil',
      'Chaises hautes & Biberons',
      'Couches & Produits d’hygiène bébé',
    ],
  },
  {
    id: 'animaux',
    label: 'Animaux',
    description: 'Chiens, chats, volailles, bétail et alimentation animale',
    subcategories: [
      'Chiens & Chiot (Berger, Boerbull...)',
      'Chats & Chatons',
      'Volailles (Poulets de chair, Pondeuses)',
      'Moutons, Chèvres & Bovins',
      'Aliments pour bétail & Volailles',
      'Accessoires, Cages & Aquariums',
      'Pisciculture & Poissons',
    ],
  },
  {
    id: 'alimentation-agriculture',
    label: 'Alimentation Agriculture et Élevage',
    description: 'Produits vivriers, épices, huiles, fruits et engrais',
    subcategories: [
      'Produits vivriers (Attiéké, Igname, Banane)',
      'Riz, Céréales & Féculents',
      'Huiles (Palme, Tournesol, Coco)',
      'Épices, Sauces & Condiments',
      'Fruits & Légumes frais',
      'Viandes & Poissons fumés / frais',
      'Semences, Engrais & Produits phytosanitaires',
      'Machines & Équipements agricoles',
    ],
  },
  {
    id: 'emplois',
    label: 'Emplois',
    description: 'Offres d’emploi, stages, recrutement et candidatures',
    subcategories: [
      'Offres d’emploi CDI / CDD',
      'Stages & Premier emploi',
      'Commerciaux & Vente',
      'Chauffeurs & Livreurs',
      'Comptabilité & Gestion',
      'Informatique, Télécom & Digital',
      'Restauration & Hôtellerie',
      'Demandes d’emploi & CV',
    ],
  },
  {
    id: 'services',
    label: 'Services',
    description: 'Bâtiment, plomberie, électricité, transport et informatique',
    subcategories: [
      'Bâtiment, Maçonnerie & Peinture',
      'Plomberie & Électricité',
      'Déménagement & Transport',
      'Informatique, Graphisme & Web',
      'Événementiel, Décoration & Traiteur',
      'Ménage, Gardiennage & Blanchisserie',
      'Mécanique & Dépannage auto',
      'Conseil, Juridique & Formalités',
    ],
  },
  {
    id: 'entreprise-industrie',
    label: 'Entreprise et Industrie',
    description: 'Matériel industriel, fournitures de bureau et gros volumes',
    subcategories: [
      'Machines industrielles & Outils',
      'Matières premières & Métaux',
      'Fournitures de bureau & Papeterie',
      'Groupes électrogènes & Panneaux solaires',
      'Équipement de sécurité (EPI, Caméras)',
      'Emballages, Cartons & Plasturgie',
      'Lots de déstockage B2B',
    ],
  },
  {
    id: 'loisirs',
    label: 'Loisirs et Activités',
    description: 'Instruments de musique, sports, livres, jeux et voyages',
    subcategories: [
      'Instruments de musique (Guitares, Pianos, Djembés)',
      'Matériel de fitness & Musculation',
      'Vélos & Équipements de sport',
      'Livres, Romans & Bandes dessinées',
      'Artisanat d’art & Statuettes',
      'Billets de concerts & Événements',
      'Voyages, Excursions & Tourisme',
    ],
  },
  {
    id: 'education',
    label: 'Éducation',
    description: 'Cours particuliers, manuels scolaires et formations pro',
    subcategories: [
      'Cours à domicile (Maths, Français, Anglais)',
      'Manuels & Fournitures scolaires',
      'Formations professionnelles certifiantes',
      'Apprentissage des langues',
      'Préparation aux concours',
      'Instruments de dessin & Calculatrices',
    ],
  },
  {
    id: 'autres',
    label: 'Autres',
    description: 'Objets insolites, dons, échanges et articles divers',
    subcategories: [
      'Objets divers & Brocante',
      'Antiquités & Pièces de collection',
      'Dons & Échanges',
      'Avis de recherche',
    ],
  },
];

// Helper to find category item by key
export function getCategoryItem(id?: string | null): CategoryItem | undefined {
  if (!id) return undefined;
  if (id === 'produits') return CATEGORIES_LIST[0]; // fallback
  if (id === 'emploi') return CATEGORIES_LIST.find((c) => c.id === 'emplois');
  return CATEGORIES_LIST.find((c) => c.id === id);
}

export const CategoryGoldIcon: React.FC<{
  category?: CategoryKey | 'ALL' | string;
  categoryKey?: CategoryKey | 'ALL' | string;
  className?: string;
}> = ({ category, categoryKey, className = 'w-6 h-6' }) => {
  const cat = category || categoryKey || 'ALL';
  const normalized = cat === 'produits' ? 'electronique' : cat;

  switch (normalized) {
    case 'ALL':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor">
          <circle cx="12" cy="12" r="9" stroke="url(#goldGrad)" strokeWidth="1.8" />
          <path d="M12 3v18M3 12h18" stroke="url(#goldGrad)" strokeWidth="1.6" />
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
        </svg>
      );

    case 'vehicules':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M4 14l2-6h12l2 6M3 14h18v4a1 1 0 01-1 1h-1a2 2 0 01-4 0h-6a2 2 0 01-4 0H4a1 1 0 01-1-1v-4z"
            stroke="url(#goldGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="7.5" cy="19" r="1.5" fill="#D4AF37" />
          <circle cx="16.5" cy="19" r="1.5" fill="#D4AF37" />
          <path d="M6 11h12" stroke="url(#goldGrad)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'immobilier':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M3 11l9-7 9 7v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-9z"
            stroke="url(#goldGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 21v-7a1 1 0 011-1h4a1 1 0 011 1v7"
            stroke="url(#goldGrad)"
            strokeWidth="1.6"
          />
          <path d="M9 8h6" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'electronique':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect x="5" y="2" width="14" height="20" rx="3" stroke="url(#goldGrad)" strokeWidth="1.8" />
          <circle cx="12" cy="18" r="1.2" fill="#D4AF37" />
          <path d="M9 5h6" stroke="url(#goldGrad)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'maison':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M4 12V9a2 2 0 012-2h12a2 2 0 012 2v3M3 12h18v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4z"
            stroke="url(#goldGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M6 18v2M18 18v2" stroke="url(#goldGrad)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'mode':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M7 4l3 3h4l3-3 4 3-2 5h-2v8a1 1 0 01-1 1H9a1 1 0 01-1-1v-8H6L4 7l3-3z"
            stroke="url(#goldGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'beaute':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect x="7" y="9" width="10" height="12" rx="2" stroke="url(#goldGrad)" strokeWidth="1.8" />
          <path d="M10 5h4v4h-4V5zM12 2v3" stroke="url(#goldGrad)" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="15" r="2" stroke="#D4AF37" strokeWidth="1.4" />
        </svg>
      );

    case 'bebes-enfants':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="12" cy="8" r="4.5" stroke="url(#goldGrad)" strokeWidth="1.8" />
          <path
            d="M7 19c0-3 2.5-5 5-5s5 2 5 5M9 8h.01M15 8h.01M12 10.5c.5.5 1 .5 1.5 0"
            stroke="url(#goldGrad)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'animaux':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <ellipse cx="12" cy="14" rx="4.5" ry="3.5" stroke="url(#goldGrad)" strokeWidth="1.8" />
          <circle cx="6.5" cy="9.5" r="1.8" fill="#D4AF37" />
          <circle cx="10" cy="6.5" r="1.8" fill="#D4AF37" />
          <circle cx="14" cy="6.5" r="1.8" fill="#D4AF37" />
          <circle cx="17.5" cy="9.5" r="1.8" fill="#D4AF37" />
        </svg>
      );

    case 'alimentation-agriculture':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M12 3v18M12 7c-2-2-4-1-5 1s0 4 2 5c1 .5 2 .5 3 .5M12 7c2-2 4-1 5 1s0 4-2 5c-1 .5-2 .5-3 .5M12 14c-2-2-4-1-5 1s0 4 2 5c1 .5 2 .5 3 .5M12 14c2-2 4-1 5 1s0 4-2 5c-1 .5-2 .5-3 .5"
            stroke="url(#goldGrad)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'emplois':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <rect x="3" y="7" width="18" height="13" rx="2" stroke="url(#goldGrad)" strokeWidth="1.8" />
          <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18" stroke="url(#goldGrad)" strokeWidth="1.6" />
        </svg>
      );

    case 'services':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.9 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
            stroke="url(#goldGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'entreprise-industrie':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M3 21V9l5 3V9l5 3V9l8 3v9H3z"
            stroke="url(#goldGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="6" y="15" width="3" height="3" fill="#D4AF37" />
          <rect x="15" y="15" width="3" height="3" fill="#D4AF37" />
        </svg>
      );

    case 'loisirs':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <circle cx="12" cy="12" r="9" stroke="url(#goldGrad)" strokeWidth="1.8" />
          <path
            d="M12 8l2.5 5h-5L12 8zM9.5 13l-4 1.5 1.5-4L9.5 13zM14.5 13l4 1.5-1.5-4-2.5 2.5z"
            stroke="url(#goldGrad)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'education':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M2 9l10-5 10 5-10 5L2 9zM6 11.5v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5"
            stroke="url(#goldGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M22 10v6" stroke="url(#goldGrad)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'autres':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className}>
          <path
            d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.6l-6.3 4.4 2.3-7.2-6-4.4h7.6L12 2z"
            stroke="url(#goldGrad)"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};
