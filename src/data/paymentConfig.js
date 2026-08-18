/**
 * Central Payment Network Configuration for GeeLark Flows
 * Authoritative single source of truth for all USDT payment networks.
 */

export const USDT_NETWORKS = {
  trc20: {
    id: 'trc20',
    asset: 'USDT',
    network: 'TRC-20',
    blockchain: 'TRON',
    nowpayments_currency: 'usdttrc20',
    nowpayments_ticker: 'USDTTRC20',
    symbol: 'USDT',
    shortLabel: 'TRC-20',
    chainLabel: 'TRON',
    badge: 'Fastest',
    addressFormat: 'TRON Base58 (starts with T)',
    warning: 'Send USDT on the TRON (TRC-20) network only.',
  },
  erc20: {
    id: 'erc20',
    asset: 'USDT',
    network: 'ERC-20',
    blockchain: 'Ethereum',
    nowpayments_currency: 'usdterc20',
    nowpayments_ticker: 'USDTERC20',
    symbol: 'USDT',
    shortLabel: 'ERC-20',
    chainLabel: 'Ethereum',
    badge: 'EVM',
    addressFormat: 'Ethereum Hex (starts with 0x)',
    warning: 'Send USDT on the Ethereum (ERC-20) network only.',
  },
  bep20: {
    id: 'bep20',
    asset: 'USDT',
    network: 'BEP-20',
    blockchain: 'BNB Smart Chain',
    nowpayments_currency: 'usdtbsc',
    nowpayments_ticker: 'USDTBSC',
    symbol: 'USDT',
    shortLabel: 'BEP-20',
    chainLabel: 'BNB Chain',
    badge: 'Low Gas',
    addressFormat: 'BNB Chain Hex (starts with 0x)',
    warning: 'Send USDT on the BNB Smart Chain (BEP-20) network only.',
  },
  sol: {
    id: 'sol',
    asset: 'USDT',
    network: 'SOL',
    blockchain: 'Solana',
    nowpayments_currency: 'usdtsol',
    nowpayments_ticker: 'USDTSOL',
    symbol: 'USDT',
    shortLabel: 'SOL',
    chainLabel: 'Solana',
    badge: 'Instant',
    addressFormat: 'Solana Base58 address',
    warning: 'Send USDT on the Solana (SPL) network only.',
  },
};

export const DEFAULT_NETWORK_ID = 'trc20';

export const USDT_NETWORKS_LIST = Object.values(USDT_NETWORKS);

/**
 * Helper to safely resolve network config from any ID or format
 */
export function getNetworkConfig(networkId) {
  if (!networkId) return USDT_NETWORKS[DEFAULT_NETWORK_ID];
  const normalized = String(networkId).toLowerCase().replace(/[^a-z0-9]/g, '');
  return USDT_NETWORKS[normalized] || USDT_NETWORKS[networkId] || null;
}
