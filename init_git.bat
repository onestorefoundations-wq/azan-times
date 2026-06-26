@echo off
rmdir /s /q .git
git init
git config user.name "DrShanidMalayil"
git config user.email "malayil.shandi@gmail.com"
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:DrShanidMalayil/masjid-azan-slide-display.git
git push -u origin main
