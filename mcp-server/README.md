# Local MCP server

The server uses Node's built-in modules and speaks MCP over stdio. Configure your MCP client with the server script and set the working directory to the project whose state it should manage. Example client configuration (field names vary by client):

```json
{
  "mcpServers": {
    "contextbridge": {
      "command": "node",
      "args": ["/absolute/path/to/contextbridge/mcp-server/server.mjs"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

Create `.contextbridge/project_state.json` in that project by copying `project_state.json` from an exported ContextBridge ZIP. The server offers `read_project_state` and `update_project_state`. Update replaces the complete state and keeps one timestamped backup. It does not accept arbitrary paths, access the network, or sync with the web app. Review every proposed change from the AI client before accepting it.
