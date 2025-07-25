#!/bin/bash

# Test script for OAuth2 functionality

echo "Testing JIRA MCP HTTP Server OAuth2 Features..."

# Check if server is already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "Server already running on port 3000"
    SERVER_PID=""
else
    # Start the server in the background
    echo "Starting MCP HTTP server with OAuth2..."
    
    # Check if required env vars are set
    if [ -z "$JIRA_API_TOKEN" ] || [ -z "$JIRA_BASE_URL" ] || [ -z "$JIRA_USER_EMAIL" ]; then
        echo "Error: Required JIRA environment variables not set!"
        echo "Please set: JIRA_API_TOKEN, JIRA_BASE_URL, JIRA_USER_EMAIL"
        exit 1
    fi
    
    # Enable OAuth2 for testing
    export MCP_OAUTH_ENABLED=true
    if [ -z "$MCP_OAUTH_INTROSPECTION_URL" ]; then
        echo "Warning: MCP_OAUTH_INTROSPECTION_URL not set, using mock URL"
        export MCP_OAUTH_INTROSPECTION_URL="https://mock-oauth.example.com/introspect"
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
        if curl -s http://localhost:3000/.well-known/oauth-protected-resource >/dev/null 2>&1; then
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

# Test 1: Check OAuth metadata endpoint
echo -e "\n1. Testing OAuth2 metadata endpoint:"
curl -s http://localhost:3000/.well-known/oauth-protected-resource | jq .

# Test 2: Request without token (should get 401 with WWW-Authenticate header)
echo -e "\n2. Testing request without token:"
curl -s -v http://localhost:3000/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' 2>&1 | grep -E "(HTTP/|WWW-Authenticate)"

# Test 3: Request with invalid token
echo -e "\n3. Testing request with invalid token:"
curl -s http://localhost:3000/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer invalid-token" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | jq .

echo -e "\nTo test with a real OAuth2 provider:"
echo "1. Set MCP_OAUTH_ENABLED=true"
echo "2. Configure MCP_OAUTH_INTROSPECTION_URL with your provider"
echo "3. Obtain a valid access token from your provider"
echo "4. Include it as: Authorization: Bearer <your-token>"

echo -e "\nAll tests completed!"

# If we started the server, offer to keep it running
if [ -n "$SERVER_PID" ]; then
    echo -e "\nPress Enter to stop the server, or Ctrl+C to keep it running..."
    read -r
fi