import { PrivyClient } from '@privy-io/server-auth';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Withdraw ETH on Sepolia (eip155:11155111)
 *
 * @param {Object} params
 * @param {string} params.walletId           - Privy wallet ID that holds Sepolia ETH
 * @param {string} params.recipientAddress   - Destination address (0x...)
 * @param {string|number} params.amountEth   - Amount in ETH (e.g., "0.01")
 * @param {boolean} params.sponsorGas        - Optional gas sponsorship flag
 * @returns {Promise<Object>} Transaction result { hash, caip2 }
 */
export async function withdrawSepoliaETH({
  walletId,
  recipientAddress,
  amountEth,
  sponsorGas = false
}) {
  if (!walletId) throw new Error('walletId is required');
  if (!recipientAddress) throw new Error('recipientAddress is required');
  if (!amountEth) throw new Error('amountEth is required');

  if (!ethers.isAddress(recipientAddress)) {
    throw new Error(`Invalid recipient address: ${recipientAddress}`);
  }

  const client = new PrivyClient(
    process.env.PRIVY_APP_ID,
    process.env.PRIVY_APP_SECRET
  );

  const amountWeiHex = ethers.toBeHex(ethers.parseEther(amountEth.toString()));

  console.log('🚀 Withdrawing ETH on Sepolia...');
  console.log('Wallet ID      :', walletId);
  console.log('Recipient      :', recipientAddress);
  console.log('Amount (ETH)   :', amountEth);
  console.log('Amount (wei)   :', amountWeiHex);
  console.log('Gas sponsorship:', sponsorGas ? 'ENABLED' : 'disabled');

  try {
    const caip2 = 'eip155:11155111'; // Sepolia testnet

    const result = await client.walletApi.rpc({
      walletId,
      caip2,
      method: 'eth_sendTransaction',
      params: {
        transaction: {
          to: recipientAddress,
          value: amountWeiHex
        },
        sponsor: sponsorGas
      }
    });

    console.log('\n✅ Withdrawal sent!');
    console.log('Transaction hash:', result.data.hash);
    console.log('Chain          :', result.data.caip2);
    console.log('Explorer       : https://sepolia.etherscan.io/tx/' + result.data.hash);

    return result.data;
  } catch (error) {
    console.error('\n❌ Withdrawal failed');
    if (error.response?.data) {
      console.error('Privy response:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * CLI usage
 *
 * Examples:
 *  npm run api:withdraw-sepolia 0.01 0xRecipient
 *  PRIVY_WALLET_ID=xxx npm run api:withdraw-sepolia 0.05
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const amountArg = process.argv[2];
  const recipientArg = process.argv[3] || process.env.WITHDRAW_RECIPIENT;
  const sponsorFlag = process.argv.includes('--sponsor');

  const walletId = process.env.WALLET_ID;

  if (!walletId) {
    console.error('❌ WALLET_ID must be set in .env');
    process.exit(1);
  }

  if (!amountArg) {
    console.error('❌ Please provide amount in ETH. Example: npm run api:withdraw-sepolia 0.01 0xRecipient');
    process.exit(1);
  }

  if (!recipientArg) {
    console.error('❌ Please provide recipient address as arg or WITHDRAW_RECIPIENT in .env');
    process.exit(1);
  }

  withdrawSepoliaETH({
    walletId,
    recipientAddress: recipientArg,
    amountEth: amountArg,
    sponsorGas: sponsorFlag
  })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('\nFailed:', error.message);
      process.exit(1);
    });
}
