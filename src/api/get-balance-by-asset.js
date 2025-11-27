import { PrivyClient } from '@privy-io/server-auth';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Get balance for specific asset across all supported chains
 * 
 * @param {string} walletId - Wallet ID
 * @param {string} asset - Asset: 'eth', 'usdc', 'usdt', 'pol', 'sol'
 * @returns {Promise<Object>} Balance information grouped by chain
 */
export async function getBalanceByAsset({ walletId, asset }) {
  const client = new PrivyClient(
    process.env.PRIVY_APP_ID,
    process.env.PRIVY_APP_SECRET
  );

  try {
    console.log(`💎 Getting ${asset.toUpperCase()} balance across all chains...`);
    console.log('Wallet ID:', walletId);

    // Define chains based on asset
    const chainsByAsset = {
      eth: ['ethereum', 'base', 'arbitrum', 'optimism', 'linea', 'zksync_era', 'polygon', 'sepolia'],
      usdc: ['ethereum', 'base', 'arbitrum', 'optimism', 'linea', 'polygon', 'sepolia'],
      usdt: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'sepolia'],
      pol: ['polygon'],
      sol: ['solana', 'sepolia']
    };

    const chains = chainsByAsset[asset.toLowerCase()] || ['ethereum', 'base', 'polygon'];

    // Build query
    const params = new URLSearchParams();
    params.append('asset', asset);
    chains.forEach(chain => params.append('chain', chain));
    params.append('include_currency', 'usd');

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

    // Calculate totals
    let totalAmount = 0;
    let totalUSD = 0;
    const balancesByChain = {};

    data.balances.forEach(balance => {
      const displayValue = parseFloat(balance.display_values[asset] || 
                                      balance.display_values.eth || 
                                      balance.display_values.sol || '0');
      const usdValue = parseFloat(balance.display_values.usd || '0');
      
      totalAmount += displayValue;
      totalUSD += usdValue;
      
      balancesByChain[balance.chain] = {
        raw: balance.raw_value,
        decimals: balance.raw_value_decimals,
        amount: displayValue,
        usd: usdValue
      };
    });

    console.log('\n✅ Balance retrieved!\n');
    console.log('═'.repeat(60));
    console.log(`💎 ${asset.toUpperCase()} Holdings`);
    console.log('═'.repeat(60));
    
    Object.keys(balancesByChain).forEach(chain => {
      const balance = balancesByChain[chain];
      console.log(`\n  ${chain.padEnd(20)} ${balance.amount.toFixed(6)} ${asset.toUpperCase()}`);
      console.log(`  ${' '.repeat(20)} $${balance.usd.toFixed(2)}`);
    });
    
    console.log('\n' + '═'.repeat(60));
    console.log(`📊 Total ${asset.toUpperCase()}: ${totalAmount.toFixed(6)}`);
    console.log(`💵 Total USD: $${totalUSD.toFixed(2)}`);
    console.log('═'.repeat(60));

    return {
      asset,
      balances: data.balances,
      balancesByChain,
      total: {
        amount: totalAmount,
        usd: totalUSD,
        chains: Object.keys(balancesByChain).length
      }
    };
  } catch (error) {
    console.error('❌ Error getting balance:', error.message);
    throw error;
  }
}

/**
 * Get all USDC across chains
 */
export async function getAllUSDC({ walletId }) {
  return getBalanceByAsset({ walletId, asset: 'usdc' });
}

/**
 * Get all ETH across chains
 */
export async function getAllETH({ walletId }) {
  return getBalanceByAsset({ walletId, asset: 'eth' });
}

/**
 * Get all USDT across chains
 */
export async function getAllUSDT({ walletId }) {
  return getBalanceByAsset({ walletId, asset: 'usdt' });
}

/**
 * CLI usage
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const asset = process.argv[2] || 'eth';
  const walletId = process.env.WALLET_ID;

  if (!walletId) {
    console.error('❌ WALLET_ID not set in .env');
    process.exit(1);
  }

  const validAssets = ['eth', 'usdc', 'usdt', 'pol', 'sol'];
  if (!validAssets.includes(asset.toLowerCase())) {
    console.error(`❌ Invalid asset: ${asset}`);
    console.error(`   Valid assets: ${validAssets.join(', ')}`);
    process.exit(1);
  }

  getBalanceByAsset({ walletId, asset: asset.toLowerCase() })
    .then(result => {
      console.log(`\n📈 Found ${result.total.chains} chain(s) with ${asset.toUpperCase()}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\nFailed:', error.message);
      process.exit(1);
    });
}


