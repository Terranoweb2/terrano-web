@echo off
title TerranoWeb Services

:: Start the website server
cd /d "E:\Glacia Coder\terrano-web\website"
start /b node server.js

:: Wait for server to be ready
timeout /t 3 /nobreak >nul

:: Start Cloudflare tunnel
start /b cloudflared tunnel run --token eyJhIjoiMzYwMDhhYWVhYTlmODYwM2FlN2FkN2ZhNTE1MTI3NWQiLCJ0IjoiODg5ZGZiZTMtMGRiYS00ODA0LThiN2YtNzg0YTZhMTVlYzdiIiwicyI6IlltVXpZalJrTVRjdFkyUXdOaTAwWWpOakxXRXdaV0V0WkRWbE1tVm1NR1pqT1RkaiJ9
