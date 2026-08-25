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
    display_currency: 'USDT (TRC-20)',
    full_label: 'TRC-20 / TRON',
    min_amount_usd: 5,
    explorer_base: 'https://tronscan.org/#/transaction/',
    address_explorer: 'https://tronscan.org/#/address/',
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
    display_currency: 'USDT (ERC-20)',
    full_label: 'ERC-20 / Ethereum',
    min_amount_usd: 15,
    explorer_base: 'https://etherscan.io/tx/',
    address_explorer: 'https://etherscan.io/address/',
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
    display_currency: 'USDT (BEP-20)',
    full_label: 'BEP-20 / BNB Chain',
    min_amount_usd: 5,
    explorer_base: 'https://bscscan.com/tx/',
    address_explorer: 'https://bscscan.com/address/',
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
    display_currency: 'USDT (SOL)',
    full_label: 'SOL / Solana',
    min_amount_usd: 5,
    explorer_base: 'https://solscan.io/tx/',
    address_explorer: 'https://solscan.io/account/',
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

const NETWORK_ALIASES = Object.values(USDT_NETWORKS).reduce((aliases, network) => {
  [
    network.id,
    network.network,
    network.blockchain,
    network.nowpayments_currency,
    network.nowpayments_ticker,
    network.display_currency,
    network.full_label,
  ].forEach((value) => {
    aliases[String(value).toLowerCase().replace(/[^a-z0-9]/g, '')] = network.id;
  });
  return aliases;
}, {
  tron: 'trc20',
  ethereum: 'erc20',
  eth: 'erc20',
  bsc: 'bep20',
  bnb: 'bep20',
  bnbchain: 'bep20',
  solana: 'sol',
});

/**
 * Helper to safely resolve network config from any ID or format
 */
export function getNetworkConfig(networkId) {
  if (!networkId) return USDT_NETWORKS[DEFAULT_NETWORK_ID];
  const normalized = String(networkId).toLowerCase().replace(/[^a-z0-9]/g, '');
  const resolvedId = NETWORK_ALIASES[normalized] || normalized;
  return USDT_NETWORKS[resolvedId] || null;
}
