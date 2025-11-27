import { PrivyClient } from '@privy-io/server-auth';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables
dotenv.config();

// Configuration validation
function validateConfig() {
  const required = [
    'PRIVY_APP_ID',
    'PRIVY_APP_SECRET',
    'WALLET_ID',
    'RECIPIENT_ADDRESS',
    'CAIP2'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  console.log('✓ Configuration validated');
}

// Initialize Privy client
function initPrivyClient() {
  const client = new PrivyClient(
    process.env.PRIVY_APP_ID,
    process.env.PRIVY_APP_SECRET
  );
  
  console.log('✓ Privy client initialized');
  return client;
}

// Get wallet information
// Note: Server-side SDK doesn't have getWallet method
// Wallet info is only available on client-side (React/React Native)
// For server-side, we only need walletId to send transactions
async function getWalletInfo(walletId) {
  try {
    console.log('\n📋 Wallet Information:');
    console.log('Wallet ID:', walletId);
    console.log('Note: Full wallet details only available on client-side SDK');
    console.log('For server operations, wallet ID is sufficient');
    
    return { id: walletId };
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Get account balance
async function getBalance(walletAddress, chainId) {
  try {
    console.log('\n💰 Checking wallet balance...');
    
    // Map CAIP2 to RPC URL (you should add your own RPC URLs)
    const rpcUrls = {
      'eip155:1': 'https://eth.llamarpc.com',
      'eip155:8453': 'https://mainnet.base.org',
      'eip155:11155111': 'https://rpc.sepolia.org'
    };
    
    const rpcUrl = rpcUrls[process.env.CAIP2];
    if (!rpcUrl) {
      console.log('⚠️  No RPC URL configured for chain:', process.env.CAIP2);
      return null;
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balance = await provider.getBalance(walletAddress);
    const balanceInEth = ethers.formatEther(balance);
    
    console.log('Balance:', balanceInEth, 'ETH');
    console.log('Balance (wei):', balance.toString());
    
    return balance;
  } catch (error) {
    console.error('❌ Error fetching balance:', error.message);
    return null;
  }
}

// Send a test transaction
async function sendTestTransaction(client, walletId) {
  try {
    console.log('\n🚀 Sending test transaction...');
    console.log('Recipient:', process.env.RECIPIENT_ADDRESS);
    console.log('Amount: 0.00001 ETH (10000000000000 wei)');
    console.log('Chain:', process.env.CAIP2);
    
    // Send transaction
    const result = await client.walletApi.rpc({
      walletId: walletId,
      caip2: process.env.CAIP2,
      method: 'eth_sendTransaction',
      params: {
        transaction: {
          to: process.env.RECIPIENT_ADDRESS,
          value: '0x2386F26FC10000', // 0.00001 ETH in hex
          // chainId can be omitted, it will be inferred from caip2
        }
      }
    });

    console.log('\n✅ Transaction sent successfully!');
    console.log('Transaction Hash:', result.data.hash);
    console.log('Chain:', result.data.caip2);
    
    // Generate explorer link
    const explorerUrls = {
      'eip155:1': 'https://etherscan.io/tx/',
      'eip155:8453': 'https://basescan.org/tx/',
      'eip155:11155111': 'https://sepolia.etherscan.io/tx/'
    };
    
    const explorerUrl = explorerUrls[result.data.caip2];
    if (explorerUrl) {
      console.log('View on Explorer:', explorerUrl + result.data.hash);
    }
    
    return result;
  } catch (error) {
    console.error('\n❌ Error sending transaction:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    throw error;
  }
}

// Send transaction with custom parameters
async function sendCustomTransaction(client, walletId, params) {
  try {
    console.log('\n🎯 Sending custom transaction...');
    console.log('Parameters:', JSON.stringify(params, null, 2));
    
    const result = await client.walletApi.rpc({
      walletId: walletId,
      caip2: process.env.CAIP2,
      method: 'eth_sendTransaction',
      params: {
        transaction: params.transaction,
        sponsor: params.sponsor || false
      }
    });

    console.log('\n✅ Transaction sent successfully!');
    console.log('Transaction Hash:', result.data.hash);
    
    return result;
  } catch (error) {
    console.error('\n❌ Error sending custom transaction:', error.message);
    throw error;
  }
}

// Main function
async function main() {
  console.log('='.repeat(60));
  console.log('🔐 Privy Transaction Test Suite');
  console.log('='.repeat(60));

  try {
    // Step 1: Validate configuration
    console.log('\n📝 Step 1: Validating configuration...');
    validateConfig();

    // Step 2: Initialize Privy client
    console.log('\n🔌 Step 2: Initializing Privy client...');
    const client = initPrivyClient();
    console.log('Client:', client);
    // Step 3: Get wallet information
    console.log('\n👛 Step 3: Getting wallet information...');
    const wallet = await getWalletInfo(process.env.WALLET_ID);
    console.log('Wallet:', wallet);
    // Step 4: Check balance (using wallet ID as address for embedded wallets)
    console.log('\n💵 Step 4: Checking wallet balance...');
    console.log('⚠️  To check balance, you need the wallet address');
    console.log('Get wallet address from Privy Dashboard or user object');
    await getBalance('0x0a1f55b674F8eB4f6988BD2725A10b30a7451783', process.env.CAIP2);

    // Step 5: Send test transaction
    console.log('\n📤 Step 5: Sending test transaction...');
    console.log('⚠️  This will send a real transaction!');
    
    // Uncomment the line below to actually send the transaction
    // await sendTestTransaction(client, process.env.WALLET_ID);
    
    console.log('\n⚠️  Transaction sending is commented out for safety.');
    console.log('To actually send a transaction, uncomment the sendTestTransaction call in main()');

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Test failed:', error.message);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

// Example: Send transaction with gas sponsorship
async function exampleWithGasSponsorship() {
  const client = initPrivyClient();
  
  await sendCustomTransaction(client, process.env.WALLET_ID, {
    transaction: {
      to: process.env.RECIPIENT_ADDRESS,
      value: '0x2386F26FC10000'
    },
    sponsor: true
  });
}

// Example: Send transaction with custom data (smart contract interaction)
async function exampleSmartContractInteraction() {
  const client = initPrivyClient();
  
  await sendCustomTransaction(client, process.env.WALLET_ID, {
    transaction: {
      to: '0xContractAddress',
      value: '0x0',
      data: '0xa9059cbb000000000000000000000000...' // Encoded function call
    }
  });
}

// Run main function
main();

// Export functions for external use
export {
  initPrivyClient,
  getWalletInfo,
  getBalance,
  sendTestTransaction,
  sendCustomTransaction,
//   exampleWithGasSponsorship,
  exampleSmartContractInteraction
};

