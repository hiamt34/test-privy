import { PrivyClient } from '@privy-io/server-auth';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Get wallet balance using Privy SDK
 * Based on: https://docs.privy.io/api-reference/wallets/get-balance
 * 
 * @param {string} walletId - Wallet ID
 * @param {string|string[]} asset - Asset(s) to check: 'eth', 'usdc', 'usdt', 'pol', 'sol'
 * @param {string|string[]} chain - Chain(s) to check
 * @param {boolean} includeCurrency - Include USD conversion (default: true)
 * @returns {Promise<Object>} Balance information
 */
export async function getWalletBalance({ 
  walletId, 
  asset = 'eth', 
  chain, 
  includeCurrency = true 
}) {
  const client = new PrivyClient(
    process.env.PRIVY_APP_ID,
    process.env.PRIVY_APP_SECRET
  );

  try {
    console.log('💰 Getting wallet balance...');
    console.log('Wallet ID:', walletId);
    console.log('Asset:', asset);
    console.log('Chain:', chain);

    // Build query parameters
    const params = new URLSearchParams();
    
    // Add asset(s)
    if (Array.isArray(asset)) {
      asset.forEach(a => params.append('asset', a));
    } else {
      params.append('asset', asset);
    }
    
    // Add chain(s)
    if (Array.isArray(chain)) {
      chain.forEach(c => params.append('chain', c));
    } else {
      params.append('chain', chain);
    }
    
    // Add currency conversion
    if (includeCurrency) {
      params.append('include_currency', 'usd');
    }

    // Make API call
    const url = `https://api.privy.io/v1/wallets/${walletId}/balance?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.PRIVY_APP_ID}:${process.env.PRIVY_APP_SECRET}`).toString('base64')}`,
        'privy-app-id': process.env.PRIVY_APP_ID,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    console.log('✅ Balance retrieved!');
    console.log('\n📊 Balances:');
    data.balances.forEach((balance, index) => {
      console.log(`\n${index + 1}. ${balance.asset.toUpperCase()} on ${balance.chain}`);
      console.log(`   Raw: ${balance.raw_value} (${balance.raw_value_decimals} decimals)`);
      console.log(`   Display: ${balance.display_values[balance.asset] || balance.display_values.eth || balance.display_values.sol} ${balance.asset.toUpperCase()}`);
      if (balance.display_values.usd) {
        console.log(`   USD: $${balance.display_values.usd}`);
      }
    });

    return data;
  } catch (error) {
    console.error('❌ Error getting balance:', error.message);
    throw error;
  }
}

/**
 * Get ETH balance on specific chain
 */
export async function getETHBalance({ walletId, chain }) {
  return getWalletBalance({
    walletId,
    asset: 'eth',
    chain,
    includeCurrency: true
  });
}

/**
 * Get USDC balance on specific chain
 */
export async function getUSDCBalance({ walletId, chain }) {
  return getWalletBalance({
    walletId,
    asset: 'usdc',
    chain,
    includeCurrency: true
  });
}

/**
 * Get all balances across multiple chains
 */
export async function getAllBalances({ walletId, chains }) {
  return getWalletBalance({
    walletId,
    asset: ['eth', 'usdc', 'usdt'],
    chain: chains || ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'],
    includeCurrency: true
  });
}

/**
 * CLI usage
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const walletId = process.env.WALLET_ID;

  if (!walletId) {
    console.error('❌ WALLET_ID not set in .env');
    process.exit(1);
  }

  if (command === 'eth') {
    const chain = process.argv[3] || 'base';
    getETHBalance({ walletId, chain })
      .then(() => process.exit(0))
      .catch(error => {
        console.error('\nFailed:', error.message);
        process.exit(1);
      });
  } else if (command === 'usdc') {
    const chain = process.argv[3] || 'base';
    getUSDCBalance({ walletId, chain })
      .then(() => process.exit(0))
      .catch(error => {
        console.error('\nFailed:', error.message);
        process.exit(1);
      });
  } else if (command === 'all') {
    const chains = process.argv.slice(3);
    getAllBalances({ 
      walletId, 
      chains: chains.length > 0 ? chains : undefined 
    })
      .then(() => process.exit(0))
      .catch(error => {
        console.error('\nFailed:', error.message);
        process.exit(1);
      });
  } else if (command === 'custom') {
    const asset = process.argv[3] || 'eth';
    const chain = process.argv[4] || 'base';
    getWalletBalance({ walletId, asset, chain })
      .then(() => process.exit(0))
      .catch(error => {
        console.error('\nFailed:', error.message);
        process.exit(1);
      });
  } else {
    console.log('Privy Get Wallet Balance API\n');
    console.log('Usage:');
    console.log('  node get-wallet-balance.js eth [chain]              - Get ETH balance');
    console.log('  node get-wallet-balance.js usdc [chain]             - Get USDC balance');
    console.log('  node get-wallet-balance.js all [chains...]          - Get all balances');
    console.log('  node get-wallet-balance.js custom <asset> <chain>   - Custom query');
    console.log('\nExamples:');
    console.log('  node get-wallet-balance.js eth base');
    console.log('  node get-wallet-balance.js usdc ethereum');
    console.log('  node get-wallet-balance.js all base ethereum polygon');
    console.log('  node get-wallet-balance.js custom usdt polygon');
    console.log('\nSupported chains:');
    console.log('  ethereum, arbitrum, base, linea, optimism, polygon, solana, zksync_era');
    console.log('  sepolia, arbitrum_sepolia, base_sepolia, linea_testnet, etc.');
    console.log('\nSupported assets:');
    console.log('  eth, usdc, usdt, pol, sol');
    process.exit(0);
  }
}


