# Privy Blockchain MCP & Test Suite

Dự án này bao gồm:
1. **MCP Server** - Model Context Protocol server để query tài liệu Privy
2. **Node.js Implementation** - Code để test gửi transaction với Privy

## 📋 Yêu cầu

- Node.js >= 18
- Privy App ID và App Secret
- Wallet ID từ Privy
- Authorization Private Key (nếu sử dụng authorization context)

## 🚀 Cài đặt

```bash
# Clone hoặc tạo project
cd test-privy-blockchain

# Cài đặt dependencies
npm install

# Copy file .env.example thành .env và điền thông tin
cp .env.example .env
```

## ⚙️ Configuration

Chỉnh sửa file `.env`:

```env
# Privy Configuration
PRIVY_APP_ID=your_privy_app_id_here
PRIVY_APP_SECRET=your_privy_app_secret_here

# Wallet Configuration
WALLET_ID=your_wallet_id_here
AUTHORIZATION_PRIVATE_KEY=your_authorization_private_key_here

# Transaction Configuration
RECIPIENT_ADDRESS=0xE3070d3e4309afA3bC9a6b057685743CF42da77C
CHAIN_ID=8453
CAIP2=eip155:8453
```

### Common Chain IDs (CAIP2 Format)

- Ethereum Mainnet: `eip155:1`
- Sepolia Testnet: `eip155:11155111`
- Base: `eip155:8453`
- Polygon: `eip155:137`
- Arbitrum: `eip155:42161`
- Optimism: `eip155:10`

## 📚 MCP Server

MCP Server cung cấp các tools để query tài liệu Privy.

### Chạy MCP Server

```bash
npm run start:mcp
```

### Available Tools

1. **get_privy_send_transaction_docs** - Lấy tài liệu về cách gửi transaction
   - Parameters: `platform` (react | nodejs | python | all)

2. **get_chain_info** - Lấy thông tin chain ID (CAIP2)
   - Parameters: `network` (mainnet | sepolia | base | polygon | arbitrum | optimism | all)

3. **generate_transaction_code** - Generate code snippet Node.js
   - Parameters: `recipient`, `value`, `chainId`, `withGasSponsorship`

### Cấu hình MCP trong claude_desktop_config.json

Thêm vào file cấu hình Claude Desktop:

```json
{
  "mcpServers": {
    "privy-docs": {
      "command": "node",
      "args": ["/absolute/path/to/test-privy-blockchain/src/mcp-server/index.js"]
    }
  }
}
```

## 🧪 Test Transaction

### Chạy test suite

```bash
npm run test:transaction
```

## 🔌 API Functions - Get Wallet Balance

APIs để lấy wallet balance sử dụng [Privy SDK](https://docs.privy.io/api-reference/wallets/get-balance):

### 1. Get Balance by Chain & Asset

```bash
# Get ETH on Base
npm run api:balance eth base

# Get USDC on Ethereum
npm run api:balance usdc ethereum

# Get all assets on multiple chains
npm run api:balance all base ethereum polygon
```

### 2. Get Balance Across Multiple Chains

```bash
# Full portfolio overview
npm run api:balance-multi portfolio

# Testnet balances
npm run api:balance-multi testnet

# Custom chains
npm run api:balance-multi custom base,ethereum eth,usdc
```

### 3. Get Balance by Asset

```bash
# All USDC across chains
npm run api:balance-asset usdc

# All ETH across chains
npm run api:balance-asset eth

# All USDT across chains
npm run api:balance-asset usdt
```

### 4. Withdraw ETH trên Sepolia

```bash
# Withdraw 0.01 ETH tới địa chỉ cụ thể
npm run api:withdraw-sepolia 0.01 0xRecipient

# Dùng WITHDRAW_RECIPIENT trong .env
npm run api:withdraw-sepolia 0.02

# Enable gas sponsorship
npm run api:withdraw-sepolia 0.02 0xRecipient --sponsor
```

📚 **Chi tiết xem:** [src/api/README.md](src/api/README.md)

### Các chức năng

Script test sẽ thực hiện:

1. ✅ Validate configuration
2. ✅ Initialize Privy client
3. ✅ Get wallet information
4. ✅ Check wallet balance
5. ⚠️ Send test transaction (mặc định commented để an toàn)

### Gửi transaction thực

Trong file `src/test-transaction/index.js`, bỏ comment dòng này:

```javascript
// await sendTestTransaction(client, process.env.WALLET_ID);
```

Thành:

```javascript
await sendTestTransaction(client, process.env.WALLET_ID);
```

## 💡 Ví dụ sử dụng

### 1. Get ETH Balance

```javascript
import { getETHBalance } from './src/api/get-wallet-balance.js';

const result = await getETHBalance({
  walletId: 'your-wallet-id',
  chain: 'base'
});

console.log('ETH:', result.balances[0].display_values.eth);
console.log('USD:', result.balances[0].display_values.usd);
```

### 2. Get USDC Balance

```javascript
import { getUSDCBalance } from './src/api/get-wallet-balance.js';

const result = await getUSDCBalance({
  walletId: 'your-wallet-id',
  chain: 'ethereum'
});

console.log('USDC:', result.balances[0].display_values.usdc);
```

### 3. Get Full Portfolio

```javascript
import { getPortfolioOverview } from './src/api/get-balance-multiple-chains.js';

const portfolio = await getPortfolioOverview({
  walletId: 'your-wallet-id'
});

console.log('Total Value: $' + portfolio.totalUSD);
console.log('Chains:', portfolio.summary.totalChains);
```

### 4. Get All USDC

```javascript
import { getAllUSDC } from './src/api/get-balance-by-asset.js';

const result = await getAllUSDC({
  walletId: 'your-wallet-id'
});

console.log('Total USDC:', result.total.amount);
console.log('USD Value:', result.total.usd);
```

### 5. Get Multiple Assets on Multiple Chains

```javascript
import { getWalletBalance } from './src/api/get-wallet-balance.js';

const result = await getWalletBalance({
  walletId: 'your-wallet-id',
  asset: ['eth', 'usdc', 'usdt'],
  chain: ['base', 'ethereum', 'polygon'],
  includeCurrency: true
});

result.balances.forEach(b => {
  console.log(`${b.asset} on ${b.chain}:`, b.display_values[b.asset]);
});
```

## 🔍 Troubleshooting

### Lỗi: Missing required environment variables

- Kiểm tra file `.env` đã được tạo và điền đầy đủ thông tin

### Lỗi: Invalid wallet ID

- Đảm bảo WALLET_ID là wallet ID hợp lệ từ Privy
- Kiểm tra wallet có tồn tại trong Privy dashboard

### Lỗi: Insufficient funds

- Kiểm tra balance của wallet
- Đảm bảo wallet có đủ ETH để trả gas fee

### Lỗi: Invalid chain ID

- Sử dụng format CAIP2 đúng (vd: `eip155:8453`)
- Tham khảo danh sách chain IDs ở trên

## 📖 Tài liệu tham khảo

- [Privy Documentation](https://docs.privy.io/)
- [Send Transaction Guide](https://docs.privy.io/wallets/using-wallets/ethereum/send-a-transaction)
- [Privy Server Auth SDK](https://www.npmjs.com/package/@privy-io/server-auth)
- [Model Context Protocol](https://modelcontextprotocol.io/)

## ⚠️ Lưu ý bảo mật

1. **KHÔNG BAO GIỜ** commit file `.env` lên git
2. **KHÔNG BAO GIỜ** share App Secret hoặc Private Keys
3. Test trên testnet trước khi chạy trên mainnet
4. Kiểm tra kỹ địa chỉ recipient trước khi gửi transaction
5. Sử dụng authorization context để bảo mật signing

## 🤝 Contributing

Mọi đóng góp đều được hoan nghênh! Hãy tạo issue hoặc pull request.

## 📄 License

MIT

