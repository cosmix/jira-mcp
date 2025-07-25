#!/bin/bash

# Test script for JIRA MCP HTTP Server

echo "Testing JIRA MCP HTTP Server..."

# Check if server is already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "Server already running on port 3000"
    SERVER_PID=""
else
    # Start the server in the background
    echo "Starting MCP HTTP server..."
    
    # Check if required env vars are set
    if [ -z "$JIRA_API_TOKEN" ] || [ -z "$JIRA_BASE_URL" ] || [ -z "$JIRA_USER_EMAIL" ]; then
        echo "Error: Required environment variables not set!"
        echo "Please set: JIRA_API_TOKEN, JIRA_BASE_URL, JIRA_USER_EMAIL"
        exit 1
    fi
    
    # Build if needed
    if [ ! -f "build/http-server.js" ]; then
        echo "Building HTTP server..."
        bun run build:http
    fi
    
    # Start server
    bun run start:http &
    SERVER_PID=$!
    
    # Wait for server to start
    echo "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/mcp >/dev/null 2>&1; then
            echo "Server started successfully"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "Error: Server failed to start after 30 seconds"
            kill $SERVER_PID 2>/dev/null
            exit 1
        fi
        sleep 1
    done
fi

# Function to cleanup on exit
cleanup() {
    if [ -n "$SERVER_PID" ]; then
        echo -e "\nStopping server..."
        kill $SERVER_PID 2>/dev/null
    fi
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Test 1: OPTIONS request (CORS preflight)
echo -e "\n1. Testing CORS preflight (OPTIONS):"
curl -X OPTIONS http://localhost:3000/mcp -v 2>&1 | grep -E "(< HTTP|Access-Control)"

# Test 2: Initialize request without auth
echo -e "\n2. Testing initialization request:"
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }' | jq .

# Test 3: List tools (with session if enabled)
echo -e "\n3. Testing list tools:"
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 2
  }' | jq .

echo -e "\nAll tests completed!"

# If we started the server, offer to keep it running
if [ -n "$SERVER_PID" ]; then
    echo -e "\nPress Enter to stop the server, or Ctrl+C to keep it running..."
    read -r
fi