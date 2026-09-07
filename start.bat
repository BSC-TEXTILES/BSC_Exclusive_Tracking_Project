@echo off
echo Starting BSC Exclusive Tracking Project...

cd backend
start cmd /k "npm run dev"

cd ../frontend
start cmd /k "npm run dev"

echo Both frontend and backend are starting in new windows...
