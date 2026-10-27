import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import officialLogoImg from '../assets/images/logo_afrique_business_1792378287169.jpg';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Afrique Business - Erreur globale interceptée :', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#141418] border border-zinc-800 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[#D4AF37]/50 bg-black flex items-center justify-center mx-auto shadow-md">
              <img src={officialLogoImg} alt="Afrique Business" className="w-full h-full object-cover" />
            </div>

            <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-800 text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-extrabold text-white">Une erreur est survenue</h2>
            <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
              Une interruption inattendue s'est produite lors de l'affichage. Vous pouvez recharger l'application pour reprendre vos activités.
            </p>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-black/60 border border-zinc-800 text-[11px] font-mono text-zinc-400 text-left overflow-x-auto max-h-24">
                {this.state.error.message || 'Erreur inconnue'}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                onClick={this.handleRetry}
                className="py-3 px-5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Réessayer</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-zinc-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4 text-gray-400" />
                <span>Retour à l'accueil</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
