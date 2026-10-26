@echo off
echo ====================================================
echo  Deploying Cloud Distributed Inventory to Vercel...
echo ====================================================
cd /d "%~dp0"
call "C:\Program Files\nodejs\npx.cmd" vercel --prod --yes
echo ====================================================
echo  Deployment complete!
echo ====================================================
pause
