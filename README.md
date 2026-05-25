# wb-mcp-server

[![npm version](https://img.shields.io/npm/v/wb-mcp-server)](https://www.npmjs.com/package/wb-mcp-server)
[![license](https://img.shields.io/npm/l/wb-mcp-server)](LICENSE)

[Русская версия](README.ru.md)

MCP server for the Wildberries Seller API. Connect any AI agent (Claude Desktop, OpenClaw, or any MCP client) to your Wildberries store.

## Quick Start

### 1. Install

```bash
npm install -g wb-mcp-server
```

### 2. Get a WB API token

Create an API token in your [WB Seller Dashboard](https://seller.wildberries.ru/) under **Settings > API Access**.

### 3. Add to Claude Desktop config

```json
{
  "mcpServers": {
    "wildberries": {
      "command": "wb-mcp-server",
      "env": {
        "WB_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

> **Windows: `spawn wb-mcp-server ENOENT` error**
>
> If Claude Desktop can't find the `wb-mcp-server` command, use `npx` instead:
>
> ```json
> {
>   "mcpServers": {
>     "wildberries": {
>       "command": "npx",
>       "args": ["-y", "wb-mcp-server"],
>       "env": {
>         "WB_API_TOKEN": "your_token_here"
>       }
>     }
>   }
> }
> ```
>
> This commonly happens with the Microsoft Store version of Claude Desktop, which doesn't see the global npm packages path.

## Updating to the latest version

New versions are released regularly — for example, v0.3.0 added 5 new tools (prices, ad balance, inventory). The server does **not** auto-update — you need to update it manually.

### Step 1. Update the package

**If installed globally** (Claude Desktop config uses `"command": "wb-mcp-server"`):

```bash
npm install -g wb-mcp-server@latest
```

**If using `npx`** (Claude Desktop config uses `"command": "npx"`):

```bash
npx -y wb-mcp-server@latest
```

If `npx` keeps pulling an old cached version, clear the cache:

```bash
npm cache clean --force
```

### Step 2. Fully restart Claude Desktop

Quit the app **from the system tray** (not just closing the window), then reopen it. Otherwise Claude will keep using the old server process.

### Step 3. Verify the version

```bash
npm list -g wb-mcp-server
```

Or ask Claude: *"Which wb-mcp-server tools are available to you?"* — v0.4.0 should show 28 tools.

## Available Tools (28)

### Reviews & Questions

| Tool | Description | Type |
|---|---|---|
| `get_feedbacks` | Get customer reviews | read |
| `reply_feedback` | Reply to a review | **write** |
| `get_questions` | Get customer questions | read |
| `reply_question` | Reply to a question | **write** |
| `get_unanswered_count` | Count of unanswered reviews | read |

### Statistics & Analytics

| Tool | Description | Type |
|---|---|---|
| `get_stocks` | Warehouse stock levels | read |
| `get_orders` | Recent orders | read |
| `get_sales` | Sales data | read |
| `get_financial_report` | Detailed report: commissions, logistics, storage, penalties | read |
| `get_nm_report` | Per-product report (views, cart, orders, buyouts) | read |
| `get_warehouses_inventory` | Real-time warehouse inventory report (async) | read |
| `get_item_rating` | Seller rating + feedback increase by star | read |

### Advertising

| Tool | Description | Type |
|---|---|---|
| `get_advert_list` | Advertising campaigns list | read |
| `get_advert_stats` | Campaign statistics | read |
| `get_advert_balance` | Advertising account balance | read |
| `update_advert_bid` | Update campaign bids | **write** |

### Pricing

| Tool | Description | Type |
|---|---|---|
| `get_prices` | Product list with prices and discounts | read |
| `update_prices` | Update prices and discounts | **write** |

### Finance

| Tool | Description | Type |
|---|---|---|
| `get_seller_balance` | Current seller account balance | read |
| `get_sales_reports_summary` | Weekly sales report summaries (for dashboards) | read |
| `get_acquiring_report_list` | Acquiring expense report summaries | read |
| `get_acquiring_report` | Detailed acquiring (card-processing) fees | read |

### Product Cards

| Tool | Description | Type |
|---|---|---|
| `get_content_cards` | Product cards listing with cursor pagination | read |

### FBS Supplies

| Tool | Description | Type |
|---|---|---|
| `get_supplies` | FBS supplies list | read |
| `create_supply` | Create a new open FBS supply | **write** |

### Documents

| Tool | Description | Type |
|---|---|---|
| `get_documents` | Financial documents: invoices, reports, acts | read |

### Seller Info

| Tool | Description | Type |
|---|---|---|
| `get_seller_info` | Name, INN, trademark | read |
| `get_jam_subscription` | Jam subscription status (requires Service token) | read |

## Configuration

| Variable | Description | Required |
|---|---|---|
| `WB_API_TOKEN` | Wildberries Seller API token | Yes |

Or pass via CLI: `wb-mcp-server --token=your_token`

## Development

```bash
git clone https://github.com/dmitriykosik74-rgb/wb-mcp-server.git
cd wb-mcp-server
npm install
npm test
npm run build
```

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push and create a Pull Request

## License

[MIT](LICENSE)
