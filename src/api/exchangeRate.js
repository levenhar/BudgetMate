/**
 * Fetches the exchange rate: how many units of `toCurrency` equals 1 unit of `fromCurrency`.
 * Returns 1 immediately when currencies are the same (no network call).
 * Throws an Error if the network request fails or the API response is invalid.
 *
 * @param {string} fromCurrency - e.g. 'USD'
 * @param {string} toCurrency   - e.g. 'ILS'
 * @returns {Promise<number>}
 */
export async function fetchExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return 1;

  const url = `https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Exchange rate fetch failed: ${res.status}`);
  }

  const data = await res.json();
  const rate = data?.rates?.[toCurrency];

  if (typeof rate !== 'number' || rate <= 0) {
    throw new Error(`Invalid exchange rate received for ${fromCurrency}→${toCurrency}`);
  }

  return rate;
}
