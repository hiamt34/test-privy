import { PrivyClient } from '@privy-io/node';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

/**
 * Swap tokens using Bebop API with Privy wallet
 * Based on: https://docs.privy.io/recipes/evm/bebop-swap-guide
 * 
 * @param {Object} params
 * @param {string} params.walletId - Privy wallet ID
 * @param {string} params.fromToken - Token address to sell (0x...)
 * @param {string} params.toToken - Token address to buy (0x...)
 * @param {string} params.amount - Amount to sell in token units (e.g., "1.5")
 * @param {number} params.fromChain - Source chain ID (e.g., 8453 for Base)
 * @param {number} params.toChain - Destination chain ID (must match fromChain for Bebop)
 * @param {boolean} params.gasless - Use gasless swap (default: false)
 * @param {boolean} params.skipApproval - Skip approval check/transaction (default: false)
 * @returns {Promise<Object>} Swap result with transaction hash
 */
export async function swapTokenBebop({
  walletId,
  fromToken,
  toToken,
  amount,
  fromChain,
  toChain,
  gasless = false,
  skipApproval = false
}) {
  // Validate inputs
  if (!walletId) throw new Error('walletId is required');
  if (!fromToken) throw new Error('fromToken address is required');
  if (!toToken) throw new Error('toToken address is required');
  if (!amount) throw new Error('amount is required');
  if (!fromChain) throw new Error('fromChain ID is required');
  
  // Bebop only supports same-chain swaps
  if (toChain && toChain !== fromChain) {
    throw new Error('Bebop only supports same-chain swaps. fromChain must equal toChain.');
  }

  if (!ethers.isAddress(fromToken)) {
    throw new Error(`Invalid fromToken address: ${fromToken}`);
  }
  if (!ethers.isAddress(toToken)) {
    throw new Error(`Invalid toToken address: ${toToken}`);
  }

  // Get Bebop credentials
  const BEBOP_AUTH_KEY = process.env.BEBOP_AUTH_KEY || 'bebop-auth-key';
  const BEBOP_SOURCE_ID = process.env.BEBOP_SOURCE_ID || 'privy-integration';

  const client = new PrivyClient(
    process.env.PRIVY_APP_ID,
    process.env.PRIVY_APP_SECRET
  );

  console.log('🔄 Starting Bebop Swap...');
  console.log('From Token:', fromToken);
  console.log('To Token  :', toToken);
  console.log('Amount    :', amount);
  console.log('Chain ID  :', fromChain);
  console.log('Gasless   :', gasless);

  try {
    // Step 1: Get wallet address
    console.log('\n📋 Step 1: Getting wallet address...');
    const walletInfo = await getWalletAddress(client, walletId, fromChain);
    console.log('Wallet address:', walletInfo.address);

    // Step 2: Check and approve token (if needed)
    if (!skipApproval) {
      console.log('\n✅ Step 2: Checking token approval...');
    //   await ensureTokenApproval(client, walletId, fromToken, amount, fromChain, walletInfo.address);
    } else {
      console.log('\n⏭️  Step 2: Skipping approval (skipApproval=true)');
    }

    // Step 3: Get quote from Bebop
    console.log('\n💱 Step 3: Requesting quote from Bebop...');
    const quote = await getBebopQuote({
      walletAddress: walletInfo.address,
      fromToken,
      toToken,
      amount,
      chainId: fromChain,
      gasless,
      authKey: BEBOP_AUTH_KEY,
      sourceId: BEBOP_SOURCE_ID
    });

    console.log('Quote received!');
    console.log('Sell amount:', quote.sellAmount || amount);
    console.log('Buy amount :', quote.buyAmount || 'calculated by Bebop');

    // Step 4: Execute swap
    console.log('\n🚀 Step 4: Executing swap...');
    const txHash = await executeSwap(client, walletId, quote.tx, fromChain);

    console.log('\n✅ Swap completed!');
    console.log('Transaction hash:', txHash);
    console.log('Explorer:', getExplorerUrl(fromChain, txHash));

    return {
      success: true,
      transactionHash: txHash,
      quote: {
        fromToken,
        toToken,
        sellAmount: quote.sellAmount,
        buyAmount: quote.buyAmount
      }
    };
  } catch (error) {
    console.error('\n❌ Swap failed:', error.message);
    throw error;
  }
}

/**
 * Get wallet address for the given chain
 */
async function getWalletAddress(client, walletId, chainId) {
  // For embedded wallets, wallet ID is typically the address
  // But we verify via balance API
  const caip2 = getCAIP2(chainId);
  const wallet = await client.wallets().get(walletId);
  return {
    address: wallet.address // Privy wallet ID is the address for embedded wallets
  };
}

/**
 * Ensure token is approved for Bebop settlement contract
 */
async function ensureTokenApproval(client, walletId, tokenAddress, amount, chainId, walletAddress) {
  const BEBOP_SETTLEMENT = '0xbbbbbBB520d69a9775E85b458C58c648259FAD5F';
  
  console.log('Approving', tokenAddress, 'for Bebop settlement...');
  console.log('Settlement contract:', BEBOP_SETTLEMENT);

  // Encode ERC20 approve function call
  const erc20Abi = ['function approve(address spender, uint256 amount) returns (bool)'];
  const iface = new ethers.Interface(erc20Abi);
  
  // Use max uint256 for unlimited approval
  const data = iface.encodeFunctionData('approve', [
    BEBOP_SETTLEMENT,
    ethers.MaxUint256
  ]);

  const caip2 = getCAIP2(chainId);

  const result = await client.walletApi.rpc({
    walletId,
    caip2,
    method: 'eth_sendTransaction',
    params: {
      transaction: {
        to: tokenAddress,
        data: data,
        value: '0x0'
      }
    }
  });

  console.log('Approval tx hash:', result.data.hash);
  console.log('Waiting for approval confirmation...');
  
  // Wait a bit for tx to be mined
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return result.data.hash;
}

/**
 * Get quote from Bebop API
 */
async function getBebopQuote({
  walletAddress,
  fromToken,
  toToken,
  amount,
  chainId,
  gasless,
  authKey,
  sourceId
}) {
  const chainName = getChainName(chainId);
  const url = `https://api.bebop.xyz/pmm/${chainName}/v3/quote`;

  // Convert amount to wei (assuming 18 decimals, adjust if needed)
  const amountWei = ethers.parseEther(amount.toString()).toString();

  const params = {
    buy_tokens: toToken,
    sell_tokens: fromToken,
    sell_amounts: amountWei,
    taker_address: walletAddress,
    gasless: gasless,
    approval_type: 'Standard',
    // source: sourceId
  };

  console.log('Quote request:', params);

  const response = await axios.get(url, {
    params,
    // headers: {
    //   'source-auth': authKey
    // }
  });
  console.log('response', response.url);
  console.log('response', response.data);
  if (response.data.error) {
    throw new Error(`Bebop quote error: ${response.data.error}`);
  }

  return {
    tx: response.data.tx,
    sellAmount: amountWei,
    buyAmount: response.data.buyAmount || response.data.tx.buyAmount
  };
}

/**
 * Execute swap transaction
 */
async function executeSwap(client, walletId, rawTransaction, chainId) {
  const caip2 = getCAIP2(chainId);

  const result = await client.walletApi.rpc({
    walletId,
    caip2,
    method: 'eth_sendTransaction',
    params: {
      transaction: {
        to: rawTransaction.to,
        data: rawTransaction.data,
        value: rawTransaction.value || '0x0'
      }
    }
  });

  return result.data.hash;
}

/**
 * Helper: Convert chain ID to CAIP2 format
 */
function getCAIP2(chainId) {
  return `eip155:${chainId}`;
}

/**
 * Helper: Get chain name for Bebop API
 */
function getChainName(chainId) {
  const chains = {
    1: 'ethereum',
    8453: 'base',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism',
    11155111: 'sepolia'
  };
  
  const name = chains[chainId];
  if (!name) {
    throw new Error(`Unsupported chain ID: ${chainId}. Supported: ${Object.keys(chains).join(', ')}`);
  }
  
  return name;
}

/**
 * Helper: Get block explorer URL
 */
function getExplorerUrl(chainId, txHash) {
  const explorers = {
    1: 'https://etherscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    137: 'https://polygonscan.com/tx/',
    42161: 'https://arbiscan.io/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
    11155111: 'https://sepolia.etherscan.io/tx/'
  };
  
  return (explorers[chainId] || 'https://etherscan.io/tx/') + txHash;
}

/**
 * CLI usage
 * 
 * Examples:
 *   # Swap 1 WETH to USDC on Base
 *   npm run api:swap 0x4200000000000000000000000000000000000006 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 1 8453
 *   
 *   # Gasless swap
 *   npm run api:swap [from] [to] [amount] [chain] --gasless
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const fromToken = process.argv[2];
  const toToken = process.argv[3];
  const amount = process.argv[4];
  const chainId = parseInt(process.argv[5]) || 8453;
  const gasless = process.argv.includes('--gasless');
  const skipApproval = process.argv.includes('--skip-approval');

  const walletId = process.env.WALLET_ID;

  if (!walletId) {
    console.error('❌ WALLET_ID must be set in .env');
    process.exit(1);
  }

  if (!fromToken || !toToken || !amount) {
    console.error('Usage: npm run api:swap <fromToken> <toToken> <amount> [chainId] [--gasless] [--skip-approval]');
    console.error('\nExamples:');
    console.error('  # Swap 1 WETH to USDC on Base');
    console.error('  npm run api:swap 0x4200000000000000000000000000000000000006 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 1 8453');
    console.error('\nCommon tokens on Base:');
    console.error('  WETH: 0x4200000000000000000000000000000000000006');
    console.error('  USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    console.error('\nChain IDs:');
    console.error('  Ethereum: 1, Base: 8453, Polygon: 137, Arbitrum: 42161, Optimism: 10');
    process.exit(1);
  }

  swapTokenBebop({
    walletId,
    fromToken,
    toToken,
    amount,
    fromChain: chainId,
    toChain: chainId,
    gasless,
    skipApproval
  })
    .then((result) => {
      console.log('\n🎉 Swap successful!');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Swap failed:', error.message);
      process.exit(1);
    });
}

export default swapTokenBebop;



