@echo off
if exist .git ( rmdir /s /q .git )
"C:\Program Files\Git\cmd\git.exe" init
"C:\Program Files\Git\cmd\git.exe" config user.name "DrShanidMalayil"
"C:\Program Files\Git\cmd\git.exe" config user.email "malayil.shandi@gmail.com"
"C:\Program Files\Git\cmd\git.exe" add .
"C:\Program Files\Git\cmd\git.exe" commit -m "Initial commit"
"C:\Program Files\Git\cmd\git.exe" branch -M main
"C:\Program Files\Git\cmd\git.exe" remote add origin git@github.com:DrShanidMalayil/masjid-azan-slide-display.git
"C:\Program Files\Git\cmd\git.exe" push -u origin main
