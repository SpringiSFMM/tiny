#!/bin/bash

echo "Installing dashboard dependencies..."
npm install

echo "Creating .env file if it doesn't exist..."
if [ ! -f ".env" ]; then
  echo "VITE_DISCORD_CLIENT_ID=1396171389109452900" > .env
  echo "VITE_DISCORD_REDIRECT_URI=http://localhost:5173/auth/callback" >> .env
  echo ".env file created with default values."
fi

echo "Starting dashboard development server..."
npm run dev 