#!/bin/bash

echo "🚀 Starting Policy Engine Dashboard..."

# Function to cleanly kill both processes on exit
cleanup() {
    echo "🛑 Shutting down..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit
}

# Trap Ctrl+C (SIGINT) to run cleanup
trap cleanup SIGINT

# Start backend in the background
echo "-> Starting Backend (priv-tract-server)"
cargo run --bin priv-tract-server &
BACKEND_PID=$!

# Wait briefly to ensure backend starts
sleep 2

# Start frontend in the background
echo "-> Starting Frontend (Vite)"
cd frontend && npm run dev &
FRONTEND_PID=$!

echo "✅ Both servers are running!"
echo "-> Backend: http://127.0.0.1:3001"
echo "-> Frontend: http://127.0.0.1:5173"
echo "(Press Ctrl+C to stop both)"

# Wait for processes
wait $BACKEND_PID
wait $FRONTEND_PID
