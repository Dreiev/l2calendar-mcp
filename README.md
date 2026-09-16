# l2calendar-mcp

MCP server for [L2 Calendar](https://l2calendar.com) — query upcoming **Lineage 2 private server openings** by chronicle directly from any MCP client (Claude Desktop, Cursor, VS Code, Windsurf, Cline...).

It wraps the free, public, CORS-enabled [L2 Calendar API](https://l2calendar.com/api/servers) and exposes it as MCP tools.

## Tools

| Tool | What it does |
|------|--------------|
| `list_servers` | List tracked servers, ordered by VIP status + opening date. Filters: `chronicle`, `only_upcoming`, `new_only`, `min_rate`, `max_rate`, `limit`. |
| `get_chronicles` | List every chronicle (slug + display name) to use as a filter. |
| `search_servers` | Free-text search across name, website, rate, chronicle, description and labels. |
| `get_server` | Full public record of one server by exact name (case-insensitive). |
| `list_labels` | Distinct labels in use (PTS, Low rate, Craft...) with colors. |

Every result is JSON, ready for the model to reason about.

## Data source

All data comes from the public API:

- `GET https://l2calendar.com/api/servers` — up to 50 servers per call, optional `?chronicle=<slug>` filter.
- `GET https://l2calendar.com/api/chronicles` — the chronicle catalog.

The API is read-only, requires no key and sends `Access-Control-Allow-Origin: *`.

Fields returned per server: `name`, `website_url`, `rate`, `opening_date`, `opening_time`, `opening_datetime_utc`, `description`, `is_vip`, `vip_level`, `multiproff`, `multicraft`, `is_new`, `chronicle` and `labels`.

> **Note:** the public API returns a single page of up to 50 servers (VIP first, then soonest opening). Tools that filter or search operate on that public page. Increase precision with the `chronicle` filter.

## Install

### Remote (HTTP) — no install

When hosted, point your client at the streamable HTTP endpoint:

```json
{
  "mcpServers": {
    "l2calendar": {
      "type": "http",
      "url": "https://<your-host>/mcp"
    }
  }
}
```

### Local (stdio) via npx

```json
{
  "mcpServers": {
    "l2calendar": {
      "command": "npx",
      "args": ["-y", "l2calendar-mcp"]
    }
  }
}
```

### Local (stdio) from source

```bash
git clone https://github.com/Dreiev/l2calendar-mcp.git
cd l2calendar-mcp
npm install
npm run build
```

```json
{
  "mcpServers": {
    "l2calendar": {
      "command": "node",
      "args": ["/absolute/path/to/l2calendar-mcp/dist/index.js"]
    }
  }
}
```

## Run the HTTP transport

```bash
node dist/index.js --http            # http://127.0.0.1:8787/mcp
node dist/index.js --http --port 9000
```

`GET /health` returns `{ "status": "ok" }` for uptime checks.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `L2CALENDAR_API_URL` | `https://l2calendar.com` | Base URL of the L2 Calendar instance to query. |

## Example prompts

- "List the Interlude servers opening soon."
- "Which Classic servers are new this week?"
- "Search for High Five servers with rate x1000."
- "Show me every chronicle L2 Calendar tracks."
- "Get the details of the server named L2Hispano."

## Development

```bash
npm install
npm run build      # tsc -> dist/
npm run dev        # run src/index.ts directly (Node >= 22)
npm run start:http # build output over HTTP
```

## About L2 Calendar

L2 Calendar is a multilingual (EN/ES/PT/RU) calendar and tracker of Lineage 2 private server openings by chronicle — [l2calendar.com](https://l2calendar.com).

## License

MIT © Dreiev
