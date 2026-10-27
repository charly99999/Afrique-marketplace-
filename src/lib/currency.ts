import { AFRICAN_COUNTRIES } from '../data/countries';
import { CountryCode } from '../types';

export function convertAndFormatPrice(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string
): { formatted: string; indicativeSecondary?: string } {
  // Find exchange rates relative to USD
  const getRate = (curr: string): number => {
    const entry = Object.values(AFRICAN_COUNTRIES).find((c) => c.currency === curr);
    if (entry) return entry.exchangeRateToUSD;
    if (curr === 'USD') return 1;
    if (curr === 'EUR') return 0.92;
    return 600;
  };

  const sourceRate = getRate(sourceCurrency);
  const targetRate = getRate(targetCurrency);

  // Source amount in USD
  const amountUSD = amount / sourceRate;

  // Primary formatted string in original currency
  const primaryFormatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: sourceCurrency === 'USD' || sourceCurrency === 'EUR' ? 2 : 0,
  }).format(amount) + ` ${sourceCurrency}`;

  // If viewing in a different currency
  if (sourceCurrency !== targetCurrency) {
    const targetAmount = amountUSD * targetRate;
    const convertedFormatted = new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: targetCurrency === 'USD' || targetCurrency === 'EUR' ? 2 : 0,
    }).format(targetAmount) + ` ${targetCurrency}`;

    return {
      formatted: primaryFormatted,
      indicativeSecondary: `≈ ${convertedFormatted}`,
    };
  }

  // Same currency: display indicative USD for cross-border buyers
  return {
    formatted: primaryFormatted,
    indicativeSecondary: `≈ $${amountUSD.toFixed(0)} USD`,
  };
}

export function getCurrencyForCountry(countryCode: CountryCode): string {
  return AFRICAN_COUNTRIES[countryCode]?.currency || 'XOF';
}
